// utils/BillsCache.ts - Système de cache intelligent pour les factures
// Optimise les performances en évitant les rechargements constants depuis AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bill } from './storage';

const STORAGE_KEY = 'manjo_carn_bills';
const INDEX_KEY = 'manjo_carn_bills_index';
const STATS_KEY = 'manjo_carn_bills_stats';
const MAX_BILLS = 1000;

// Interface pour les statistiques pré-calculées
export interface BillsStatistics {
  totalBills: number;
  totalAmount: number;
  averageAmount: number;
  oldestBillTimestamp: string | null;
  newestBillTimestamp: string | null;
  lastUpdated: string;
  // Compteurs par période (mis à jour à la demande)
  billsToday?: number;
  billsThisWeek?: number;
  billsThisMonth?: number;
  amountToday?: number;
  amountThisWeek?: number;
  amountThisMonth?: number;
}

// Interface pour les index de recherche rapide
interface BillsIndex {
  // Index par date (YYYY-MM-DD -> [billIds])
  byDate: Record<string, number[]>;
  // Index par méthode de paiement
  byPaymentMethod: Record<string, number[]>;
  // Index par section
  bySection: Record<string, number[]>;
  // Liste triée par date (plus récent en premier) - IDs uniquement
  sortedByDateDesc: number[];
  // Timestamp de dernière mise à jour
  lastUpdated: string;
}

// Cache singleton
class BillsCacheManager {
  private static instance: BillsCacheManager;

  private bills: Bill[] | null = null;
  private billsMap: Map<number, Bill> = new Map();
  private index: BillsIndex | null = null;
  private stats: BillsStatistics | null = null;
  private isLoaded: boolean = false;
  private isLoading: Promise<void> | null = null;
  private isDirty: boolean = false;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  // Listeners pour notifier les changements
  private listeners: Set<() => void> = new Set();

  private constructor() {}

  static getInstance(): BillsCacheManager {
    if (!BillsCacheManager.instance) {
      BillsCacheManager.instance = new BillsCacheManager();
    }
    return BillsCacheManager.instance;
  }

  // Ajouter un listener pour les mises à jour
  addListener(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach((callback) => callback());
  }

  // Charger les données depuis le stockage
  async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;

    if (this.isLoading) {
      await this.isLoading;
      return;
    }

    this.isLoading = this.loadFromStorage();
    await this.isLoading;
    this.isLoading = null;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const [billsData, indexData, statsData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(INDEX_KEY),
        AsyncStorage.getItem(STATS_KEY),
      ]);

      // Charger les factures
      this.bills = billsData ? JSON.parse(billsData) : [];

      // Construire la map pour accès rapide par ID
      this.billsMap.clear();
      this.bills!.forEach((bill) => {
        if (bill.id) {
          this.billsMap.set(bill.id, bill);
        }
      });

      // Charger ou reconstruire l'index
      if (indexData) {
        this.index = JSON.parse(indexData);
      } else {
        this.rebuildIndex();
      }

      // Charger ou recalculer les stats
      if (statsData) {
        this.stats = JSON.parse(statsData);
      } else {
        this.recalculateStats();
      }

      this.isLoaded = true;
    } catch (error) {
      console.error('Erreur chargement cache factures:', error);
      this.bills = [];
      this.billsMap.clear();
      this.rebuildIndex();
      this.recalculateStats();
      this.isLoaded = true;
    }
  }

  // Reconstruire l'index de recherche
  private rebuildIndex(): void {
    const index: BillsIndex = {
      byDate: {},
      byPaymentMethod: {},
      bySection: {},
      sortedByDateDesc: [],
      lastUpdated: new Date().toISOString(),
    };

    if (!this.bills) {
      this.index = index;
      return;
    }

    // Trier les factures par date (décroissant)
    const sortedBills = [...this.bills].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    sortedBills.forEach((bill) => {
      if (!bill.id) return;

      // Index trié par date
      index.sortedByDateDesc.push(bill.id);

      // Index par date (YYYY-MM-DD)
      const dateKey = bill.timestamp.substring(0, 10);
      if (!index.byDate[dateKey]) {
        index.byDate[dateKey] = [];
      }
      index.byDate[dateKey].push(bill.id);

      // Index par méthode de paiement
      const paymentKey = bill.paymentMethod || 'unknown';
      if (!index.byPaymentMethod[paymentKey]) {
        index.byPaymentMethod[paymentKey] = [];
      }
      index.byPaymentMethod[paymentKey].push(bill.id);

      // Index par section
      const sectionKey = bill.section || 'unknown';
      if (!index.bySection[sectionKey]) {
        index.bySection[sectionKey] = [];
      }
      index.bySection[sectionKey].push(bill.id);
    });

    this.index = index;
  }

  // Recalculer les statistiques (une seule passe)
  private recalculateStats(): void {
    if (!this.bills || this.bills.length === 0) {
      this.stats = {
        totalBills: 0,
        totalAmount: 0,
        averageAmount: 0,
        oldestBillTimestamp: null,
        newestBillTimestamp: null,
        lastUpdated: new Date().toISOString(),
      };
      return;
    }

    let totalAmount = 0;
    let oldestTimestamp: string | null = null;
    let newestTimestamp: string | null = null;

    // UNE SEULE PASSE pour calculer toutes les stats
    for (const bill of this.bills) {
      totalAmount += bill.amount;

      if (!oldestTimestamp || bill.timestamp < oldestTimestamp) {
        oldestTimestamp = bill.timestamp;
      }
      if (!newestTimestamp || bill.timestamp > newestTimestamp) {
        newestTimestamp = bill.timestamp;
      }
    }

    this.stats = {
      totalBills: this.bills.length,
      totalAmount,
      averageAmount: totalAmount / this.bills.length,
      oldestBillTimestamp: oldestTimestamp,
      newestBillTimestamp: newestTimestamp,
      lastUpdated: new Date().toISOString(),
    };
  }

  // Sauvegarder avec debounce pour éviter trop d'écritures
  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.isDirty = true;
    this.saveTimeout = setTimeout(() => {
      this.persistToStorage();
    }, 500); // Debounce de 500ms
  }

  private async persistToStorage(): Promise<void> {
    if (!this.isDirty) return;

    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.bills)),
        AsyncStorage.setItem(INDEX_KEY, JSON.stringify(this.index)),
        AsyncStorage.setItem(STATS_KEY, JSON.stringify(this.stats)),
      ]);
      this.isDirty = false;
    } catch (error) {
      console.error('Erreur sauvegarde cache factures:', error);
      throw error;
    }
  }

  // Forcer la sauvegarde immédiate
  async forceSave(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    await this.persistToStorage();
  }

  // === API PUBLIQUE ===

  // Obtenir toutes les factures (éviter si possible)
  async getAllBills(): Promise<Bill[]> {
    await this.ensureLoaded();
    return this.bills ? [...this.bills] : [];
  }

  // Obtenir le nombre total de factures (très rapide)
  async getTotalCount(): Promise<number> {
    await this.ensureLoaded();
    return this.bills?.length || 0;
  }

  // Obtenir une facture par ID (O(1))
  async getBillById(id: number): Promise<Bill | null> {
    await this.ensureLoaded();
    return this.billsMap.get(id) || null;
  }

  // Obtenir les factures paginées (utilise l'index)
  async getBillsPage(page: number = 0, pageSize: number = 20): Promise<{
    bills: Bill[];
    total: number;
    hasMore: boolean;
  }> {
    await this.ensureLoaded();

    if (!this.index || !this.bills) {
      return { bills: [], total: 0, hasMore: false };
    }

    const start = page * pageSize;
    const end = start + pageSize;
    const billIds = this.index.sortedByDateDesc.slice(start, end);

    const bills = billIds
      .map((id) => this.billsMap.get(id))
      .filter((bill): bill is Bill => bill !== undefined);

    return {
      bills,
      total: this.index.sortedByDateDesc.length,
      hasMore: end < this.index.sortedByDateDesc.length,
    };
  }

  // Obtenir les N factures les plus récentes (optimisé)
  async getRecentBills(limit: number = 200): Promise<Bill[]> {
    await this.ensureLoaded();

    if (!this.index) {
      return [];
    }

    const billIds = this.index.sortedByDateDesc.slice(0, limit);
    return billIds
      .map((id) => this.billsMap.get(id))
      .filter((bill): bill is Bill => bill !== undefined);
  }

  // Filtrer les factures (utilise les index)
  async getFilteredBills(filters: {
    searchText?: string;
    date?: Date;
    dateRange?: { start: Date; end: Date };
    paymentMethod?: string;
    section?: string;
  }): Promise<Bill[]> {
    await this.ensureLoaded();

    if (!this.index || !this.bills) {
      return [];
    }

    let candidateIds: Set<number> | null = null;

    // Filtrer par date exacte (utilise l'index)
    if (filters.date) {
      const dateKey = filters.date.toISOString().substring(0, 10);
      const idsForDate = this.index.byDate[dateKey] || [];
      candidateIds = new Set(idsForDate);
    }

    // Filtrer par plage de dates
    if (filters.dateRange) {
      const startStr = filters.dateRange.start.toISOString().substring(0, 10);
      const endStr = filters.dateRange.end.toISOString().substring(0, 10);

      const idsInRange: number[] = [];
      for (const [dateKey, ids] of Object.entries(this.index.byDate)) {
        if (dateKey >= startStr && dateKey <= endStr) {
          idsInRange.push(...ids);
        }
      }

      if (candidateIds) {
        candidateIds = new Set([...candidateIds].filter((id) => idsInRange.includes(id)));
      } else {
        candidateIds = new Set(idsInRange);
      }
    }

    // Filtrer par méthode de paiement (utilise l'index)
    if (filters.paymentMethod) {
      const idsForMethod = this.index.byPaymentMethod[filters.paymentMethod] || [];
      if (candidateIds) {
        candidateIds = new Set([...candidateIds].filter((id) => idsForMethod.includes(id)));
      } else {
        candidateIds = new Set(idsForMethod);
      }
    }

    // Filtrer par section (utilise l'index)
    if (filters.section) {
      const idsForSection = this.index.bySection[filters.section] || [];
      if (candidateIds) {
        candidateIds = new Set([...candidateIds].filter((id) => idsForSection.includes(id)));
      } else {
        candidateIds = new Set(idsForSection);
      }
    }

    // Récupérer les factures candidates
    let results: Bill[];
    if (candidateIds) {
      results = [...candidateIds]
        .map((id) => this.billsMap.get(id))
        .filter((bill): bill is Bill => bill !== undefined);
    } else {
      results = [...this.bills];
    }

    // Filtrer par texte (nécessite une recherche linéaire)
    if (filters.searchText) {
      const search = filters.searchText.toLowerCase();
      results = results.filter((bill) => {
        const tableName = bill.tableName || `Table ${bill.tableNumber}`;
        return (
          tableName.toLowerCase().includes(search) ||
          bill.amount.toString().includes(search) ||
          (bill.section && bill.section.toLowerCase().includes(search))
        );
      });
    }

    // Trier par date décroissante
    results.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return results;
  }

  // Obtenir les factures d'une journée (utilise l'index)
  async getBillsForDate(date: Date): Promise<Bill[]> {
    await this.ensureLoaded();

    if (!this.index) {
      return [];
    }

    const dateKey = date.toISOString().substring(0, 10);
    const billIds = this.index.byDate[dateKey] || [];

    return billIds
      .map((id) => this.billsMap.get(id))
      .filter((bill): bill is Bill => bill !== undefined)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // Obtenir les statistiques (très rapide)
  async getStatistics(): Promise<BillsStatistics> {
    await this.ensureLoaded();

    if (!this.stats) {
      this.recalculateStats();
    }

    // Calculer les stats temporelles à la demande
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let billsToday = 0, billsThisWeek = 0, billsThisMonth = 0;
    let amountToday = 0, amountThisWeek = 0, amountThisMonth = 0;

    if (this.bills) {
      for (const bill of this.bills) {
        const billDate = new Date(bill.timestamp);

        if (billDate >= todayStart) {
          billsToday++;
          amountToday += bill.amount;
        }
        if (billDate >= weekAgo) {
          billsThisWeek++;
          amountThisWeek += bill.amount;
        }
        if (billDate >= monthAgo) {
          billsThisMonth++;
          amountThisMonth += bill.amount;
        }
      }
    }

    return {
      ...this.stats!,
      billsToday,
      billsThisWeek,
      billsThisMonth,
      amountToday,
      amountThisWeek,
      amountThisMonth,
    };
  }

  // Ajouter une facture (mise à jour incrémentale)
  async addBill(bill: Bill): Promise<void> {
    await this.ensureLoaded();

    if (!this.bills || !this.index || !this.stats) {
      this.bills = [];
      this.rebuildIndex();
      this.recalculateStats();
    }

    // Ajouter à la liste
    this.bills!.push(bill);

    // Ajouter à la map
    if (bill.id) {
      this.billsMap.set(bill.id, bill);
    }

    // Mise à jour incrémentale de l'index
    this.updateIndexForBill(bill, 'add');

    // Mise à jour incrémentale des stats
    this.stats!.totalBills++;
    this.stats!.totalAmount += bill.amount;
    this.stats!.averageAmount = this.stats!.totalAmount / this.stats!.totalBills;

    if (!this.stats!.oldestBillTimestamp || bill.timestamp < this.stats!.oldestBillTimestamp) {
      this.stats!.oldestBillTimestamp = bill.timestamp;
    }
    if (!this.stats!.newestBillTimestamp || bill.timestamp > this.stats!.newestBillTimestamp) {
      this.stats!.newestBillTimestamp = bill.timestamp;
    }
    this.stats!.lastUpdated = new Date().toISOString();

    // Maintenance: limiter le nombre de factures
    if (this.bills!.length > MAX_BILLS) {
      await this.performMaintenance();
    }

    this.scheduleSave();
    this.notifyListeners();
  }

  // Supprimer une facture
  async deleteBill(billId: number): Promise<void> {
    await this.ensureLoaded();

    if (!this.bills) return;

    const billIndex = this.bills.findIndex((b) => b.id === billId);
    if (billIndex === -1) return;

    const bill = this.bills[billIndex];

    // Retirer de la liste
    this.bills.splice(billIndex, 1);

    // Retirer de la map
    this.billsMap.delete(billId);

    // Mise à jour incrémentale de l'index
    this.updateIndexForBill(bill, 'remove');

    // Mise à jour incrémentale des stats
    if (this.stats) {
      this.stats.totalBills--;
      this.stats.totalAmount -= bill.amount;
      this.stats.averageAmount = this.stats.totalBills > 0
        ? this.stats.totalAmount / this.stats.totalBills
        : 0;
      this.stats.lastUpdated = new Date().toISOString();
    }

    this.scheduleSave();
    this.notifyListeners();
  }

  // Supprimer plusieurs factures
  async deleteBills(billIds: number[]): Promise<void> {
    await this.ensureLoaded();

    if (!this.bills) return;

    const idsSet = new Set(billIds);
    const billsToRemove = this.bills.filter((b) => idsSet.has(b.id));

    // Retirer de la liste
    this.bills = this.bills.filter((b) => !idsSet.has(b.id));

    // Retirer de la map et mettre à jour les stats
    let amountRemoved = 0;
    for (const bill of billsToRemove) {
      this.billsMap.delete(bill.id);
      this.updateIndexForBill(bill, 'remove');
      amountRemoved += bill.amount;
    }

    // Mise à jour des stats
    if (this.stats) {
      this.stats.totalBills -= billsToRemove.length;
      this.stats.totalAmount -= amountRemoved;
      this.stats.averageAmount = this.stats.totalBills > 0
        ? this.stats.totalAmount / this.stats.totalBills
        : 0;
      this.stats.lastUpdated = new Date().toISOString();
    }

    this.scheduleSave();
    this.notifyListeners();
  }

  // Supprimer toutes les factures
  async clearAllBills(): Promise<void> {
    this.bills = [];
    this.billsMap.clear();
    this.rebuildIndex();
    this.recalculateStats();

    await this.forceSave();
    this.notifyListeners();
  }

  // Remplacer toutes les factures (pour import/restore)
  async setBills(bills: Bill[]): Promise<void> {
    this.bills = bills;

    this.billsMap.clear();
    bills.forEach((bill) => {
      if (bill.id) {
        this.billsMap.set(bill.id, bill);
      }
    });

    this.rebuildIndex();
    this.recalculateStats();

    await this.forceSave();
    this.notifyListeners();
  }

  // Mise à jour incrémentale de l'index
  private updateIndexForBill(bill: Bill, action: 'add' | 'remove'): void {
    if (!this.index || !bill.id) return;

    const dateKey = bill.timestamp.substring(0, 10);
    const paymentKey = bill.paymentMethod || 'unknown';
    const sectionKey = bill.section || 'unknown';

    if (action === 'add') {
      // Ajouter aux index
      if (!this.index.byDate[dateKey]) {
        this.index.byDate[dateKey] = [];
      }
      this.index.byDate[dateKey].push(bill.id);

      if (!this.index.byPaymentMethod[paymentKey]) {
        this.index.byPaymentMethod[paymentKey] = [];
      }
      this.index.byPaymentMethod[paymentKey].push(bill.id);

      if (!this.index.bySection[sectionKey]) {
        this.index.bySection[sectionKey] = [];
      }
      this.index.bySection[sectionKey].push(bill.id);

      // Insérer dans la liste triée à la bonne position
      const billTime = new Date(bill.timestamp).getTime();
      let insertIndex = 0;
      for (let i = 0; i < this.index.sortedByDateDesc.length; i++) {
        const existingBill = this.billsMap.get(this.index.sortedByDateDesc[i]);
        if (existingBill && new Date(existingBill.timestamp).getTime() < billTime) {
          insertIndex = i;
          break;
        }
        insertIndex = i + 1;
      }
      this.index.sortedByDateDesc.splice(insertIndex, 0, bill.id);

    } else {
      // Retirer des index
      const removeFromArray = (arr: number[] | undefined, id: number) => {
        if (!arr) return;
        const idx = arr.indexOf(id);
        if (idx !== -1) arr.splice(idx, 1);
      };

      removeFromArray(this.index.byDate[dateKey], bill.id);
      removeFromArray(this.index.byPaymentMethod[paymentKey], bill.id);
      removeFromArray(this.index.bySection[sectionKey], bill.id);
      removeFromArray(this.index.sortedByDateDesc, bill.id);
    }

    this.index.lastUpdated = new Date().toISOString();
  }

  // Maintenance: garder seulement les 800 factures les plus récentes
  private async performMaintenance(): Promise<void> {
    if (!this.bills || this.bills.length <= MAX_BILLS) return;

    // Trier par date et garder les 800 plus récentes
    const sorted = [...this.bills].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    this.bills = sorted.slice(0, 800);

    // Reconstruire la map et les index
    this.billsMap.clear();
    this.bills.forEach((bill) => {
      if (bill.id) {
        this.billsMap.set(bill.id, bill);
      }
    });

    this.rebuildIndex();
    this.recalculateStats();
  }

  // Invalider le cache (forcer le rechargement)
  invalidate(): void {
    this.isLoaded = false;
    this.bills = null;
    this.billsMap.clear();
    this.index = null;
    this.stats = null;
  }

  // Vérifier si le cache est chargé
  isReady(): boolean {
    return this.isLoaded;
  }
}

// Export du singleton
export const BillsCache = BillsCacheManager.getInstance();

// Fonctions utilitaires pour rétrocompatibilité
export const getCachedBills = () => BillsCache.getAllBills();
export const getCachedBillsPage = (page: number, pageSize: number) =>
  BillsCache.getBillsPage(page, pageSize);
export const getCachedRecentBills = (limit: number) =>
  BillsCache.getRecentBills(limit);
export const getCachedBillsStatistics = () =>
  BillsCache.getStatistics();
export const addCachedBill = (bill: Bill) =>
  BillsCache.addBill(bill);
export const deleteCachedBill = (billId: number) =>
  BillsCache.deleteBill(billId);
export const deleteCachedBills = (billIds: number[]) =>
  BillsCache.deleteBills(billIds);
export const clearCachedBills = () =>
  BillsCache.clearAllBills();
export const setCachedBills = (bills: Bill[]) =>
  BillsCache.setBills(bills);
