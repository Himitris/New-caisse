// utils/BillsCache.ts - Couche d'abstraction sur SQLite
// Maintient la même API pour compatibilité avec le code existant

import { DatabaseService, Bill, BillsStatistics } from './DatabaseService';

// Re-export des types pour compatibilité
export type { Bill, BillsStatistics };

// Classe de cache qui délègue à DatabaseService
class BillsCacheManager {
  private static instance: BillsCacheManager;

  private constructor() {}

  static getInstance(): BillsCacheManager {
    if (!BillsCacheManager.instance) {
      BillsCacheManager.instance = new BillsCacheManager();
    }
    return BillsCacheManager.instance;
  }

  // Ajouter un listener pour les mises à jour
  addListener(callback: () => void): () => void {
    return DatabaseService.addListener(callback);
  }

  // Initialiser la base de données
  async ensureLoaded(): Promise<void> {
    await DatabaseService.initialize();
  }

  // === API PUBLIQUE (compatibilité avec l'ancienne API) ===

  // Obtenir toutes les factures
  async getAllBills(): Promise<Bill[]> {
    return DatabaseService.getAllBills();
  }

  // Obtenir le nombre total de factures (O(1))
  async getTotalCount(): Promise<number> {
    return DatabaseService.getTotalCount();
  }

  // Obtenir une facture par ID
  async getBillById(id: number): Promise<Bill | null> {
    return DatabaseService.getBillById(id);
  }

  // Obtenir les factures paginées
  async getBillsPage(page: number = 0, pageSize: number = 20): Promise<{
    bills: Bill[];
    total: number;
    hasMore: boolean;
  }> {
    return DatabaseService.getBillsPage(page, pageSize);
  }

  // Obtenir les N factures les plus récentes
  async getRecentBills(limit: number = 200): Promise<Bill[]> {
    return DatabaseService.getRecentBills(limit);
  }

  // Filtrer les factures
  async getFilteredBills(filters: {
    searchText?: string;
    date?: Date;
    dateRange?: { start: Date; end: Date };
    paymentMethod?: string;
    section?: string;
  }): Promise<Bill[]> {
    return DatabaseService.getFilteredBills(filters);
  }

  // Obtenir les factures d'une journée
  async getBillsForDate(date: Date): Promise<Bill[]> {
    return DatabaseService.getBillsForDate(date);
  }

  // Obtenir les statistiques
  async getStatistics(): Promise<BillsStatistics> {
    return DatabaseService.getStatistics();
  }

  // Ajouter une facture
  async addBill(bill: Bill): Promise<void> {
    return DatabaseService.addBill(bill);
  }

  // Supprimer une facture
  async deleteBill(billId: number): Promise<void> {
    return DatabaseService.deleteBill(billId);
  }

  // Supprimer plusieurs factures
  async deleteBills(billIds: number[]): Promise<void> {
    return DatabaseService.deleteBills(billIds);
  }

  // Supprimer toutes les factures
  async clearAllBills(): Promise<void> {
    return DatabaseService.clearAllBills();
  }

  // Remplacer toutes les factures
  async setBills(bills: Bill[]): Promise<void> {
    return DatabaseService.setBills(bills);
  }

  // Maintenance
  async performMaintenance(maxBills: number = 1000): Promise<number> {
    return DatabaseService.performMaintenance(maxBills);
  }

  // Invalider le cache (pour compatibilité - ne fait rien avec SQLite)
  invalidate(): void {
    // SQLite n'a pas besoin d'invalidation de cache
  }

  // Vérifier si prêt (toujours vrai après init)
  isReady(): boolean {
    return true;
  }

  // Forcer la sauvegarde (pour compatibilité - ne fait rien avec SQLite)
  async forceSave(): Promise<void> {
    // SQLite sauvegarde automatiquement
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
