// utils/DatabaseService.ts - Service de base de données multi-plateforme
// SQLite sur mobile, AsyncStorage optimisé sur web

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Bill, BillRecord, BillsStatistics, StorageBackend } from './DatabaseService.types';

// Re-export des types
export type { Bill, BillRecord, BillsStatistics, StorageBackend };

// Clés de stockage
const BILLS_KEY = 'manjo_carn_bills';
const MIGRATION_KEY = 'manjo_carn_sqlite_migrated';

// ============================================
// Backend AsyncStorage (Web + Fallback)
// ============================================
class AsyncStorageBackend implements StorageBackend {
  private cache: Bill[] | null = null;
  private cacheValid: boolean = false;

  async initialize(): Promise<void> {
    await this.loadCache();
    console.log('✅ AsyncStorage backend initialized (web mode)');
  }

  private async loadCache(): Promise<Bill[]> {
    if (this.cacheValid && this.cache !== null) {
      return this.cache;
    }

    try {
      const data = await AsyncStorage.getItem(BILLS_KEY);
      this.cache = data ? JSON.parse(data) : [];
      this.cacheValid = true;
      return this.cache;
    } catch (error) {
      console.error('Error loading bills from AsyncStorage:', error);
      this.cache = [];
      this.cacheValid = true;
      return this.cache;
    }
  }

  private async saveCache(): Promise<void> {
    if (this.cache === null) return;
    try {
      await AsyncStorage.setItem(BILLS_KEY, JSON.stringify(this.cache));
    } catch (error) {
      console.error('Error saving bills to AsyncStorage:', error);
    }
  }

  async getAllBills(): Promise<Bill[]> {
    const bills = await this.loadCache();
    return [...bills].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async getTotalCount(): Promise<number> {
    const bills = await this.loadCache();
    return bills.length;
  }

  async getBillById(id: number): Promise<Bill | null> {
    const bills = await this.loadCache();
    return bills.find(b => b.id === id) || null;
  }

  async getBillsPage(page: number, pageSize: number): Promise<{ bills: Bill[]; total: number; hasMore: boolean }> {
    const allBills = await this.getAllBills();
    const start = page * pageSize;
    const bills = allBills.slice(start, start + pageSize);
    return {
      bills,
      total: allBills.length,
      hasMore: start + pageSize < allBills.length,
    };
  }

  async getRecentBills(limit: number): Promise<Bill[]> {
    const allBills = await this.getAllBills();
    return allBills.slice(0, limit);
  }

  async getFilteredBills(filters: {
    searchText?: string;
    date?: Date;
    dateRange?: { start: Date; end: Date };
    paymentMethod?: string;
    section?: string;
  }): Promise<Bill[]> {
    let bills = await this.getAllBills();

    if (filters.date) {
      const dateStr = filters.date.toISOString().substring(0, 10);
      bills = bills.filter(b => b.timestamp.substring(0, 10) === dateStr);
    }

    if (filters.dateRange) {
      const start = filters.dateRange.start.getTime();
      const end = filters.dateRange.end.getTime();
      bills = bills.filter(b => {
        const t = new Date(b.timestamp).getTime();
        return t >= start && t <= end;
      });
    }

    if (filters.paymentMethod) {
      bills = bills.filter(b => b.paymentMethod === filters.paymentMethod);
    }

    if (filters.section) {
      bills = bills.filter(b => b.section === filters.section);
    }

    if (filters.searchText) {
      const search = filters.searchText.toLowerCase();
      bills = bills.filter(b =>
        (b.tableName?.toLowerCase().includes(search)) ||
        (b.section?.toLowerCase().includes(search)) ||
        b.amount.toString().includes(search)
      );
    }

    return bills;
  }

  async getBillsForDate(date: Date): Promise<Bill[]> {
    return this.getFilteredBills({ date });
  }

  async getStatistics(): Promise<BillsStatistics> {
    const bills = await this.loadCache();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let totalAmount = 0;
    let oldestTimestamp: string | null = null;
    let newestTimestamp: string | null = null;
    let billsToday = 0, billsThisWeek = 0, billsThisMonth = 0;
    let amountToday = 0, amountThisWeek = 0, amountThisMonth = 0;

    for (const bill of bills) {
      totalAmount += bill.amount;
      const billTime = new Date(bill.timestamp);

      if (!oldestTimestamp || bill.timestamp < oldestTimestamp) {
        oldestTimestamp = bill.timestamp;
      }
      if (!newestTimestamp || bill.timestamp > newestTimestamp) {
        newestTimestamp = bill.timestamp;
      }

      if (billTime >= todayStart) {
        billsToday++;
        amountToday += bill.amount;
      }
      if (billTime >= weekAgo) {
        billsThisWeek++;
        amountThisWeek += bill.amount;
      }
      if (billTime >= monthAgo) {
        billsThisMonth++;
        amountThisMonth += bill.amount;
      }
    }

    return {
      totalBills: bills.length,
      totalAmount,
      averageAmount: bills.length > 0 ? totalAmount / bills.length : 0,
      oldestBillTimestamp: oldestTimestamp,
      newestBillTimestamp: newestTimestamp,
      billsToday,
      billsThisWeek,
      billsThisMonth,
      amountToday,
      amountThisWeek,
      amountThisMonth,
    };
  }

  async addBill(bill: Bill): Promise<void> {
    const bills = await this.loadCache();
    bills.push(bill);
    this.cache = bills;
    await this.saveCache();
  }

  async deleteBill(billId: number): Promise<void> {
    const bills = await this.loadCache();
    this.cache = bills.filter(b => b.id !== billId);
    await this.saveCache();
  }

  async deleteBills(billIds: number[]): Promise<void> {
    const idSet = new Set(billIds);
    const bills = await this.loadCache();
    this.cache = bills.filter(b => !idSet.has(b.id));
    await this.saveCache();
  }

  async clearAllBills(): Promise<void> {
    this.cache = [];
    await this.saveCache();
  }

  async setBills(bills: Bill[]): Promise<void> {
    this.cache = bills;
    await this.saveCache();
  }

  async performMaintenance(maxBills: number): Promise<number> {
    const bills = await this.loadCache();
    if (bills.length <= maxBills) return 0;

    const sorted = [...bills].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const toDelete = bills.length - maxBills;
    this.cache = sorted.slice(0, maxBills);
    await this.saveCache();
    return toDelete;
  }
}

// ============================================
// Service principal avec sélection automatique du backend
// ============================================
class DatabaseServiceClass {
  private static instance: DatabaseServiceClass;
  private backend: StorageBackend | null = null;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private listeners: Set<() => void> = new Set();

  private constructor() {}

  static getInstance(): DatabaseServiceClass {
    if (!DatabaseServiceClass.instance) {
      DatabaseServiceClass.instance = new DatabaseServiceClass();
    }
    return DatabaseServiceClass.instance;
  }

  // Ajouter un listener pour les changements
  addListener(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = this._doInitialize();
    await this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      // Choisir le backend selon la plateforme
      if (Platform.OS === 'web') {
        console.log('📱 Platform: Web - using AsyncStorage backend');
        this.backend = new AsyncStorageBackend();
      } else {
        console.log('📱 Platform: Native - using SQLite backend');
        try {
          // Import dynamique pour éviter le bundling sur web
          const { SQLiteBackend } = require('./SQLiteBackend');
          this.backend = new SQLiteBackend();
        } catch (error) {
          console.warn('⚠️ SQLite not available, falling back to AsyncStorage');
          this.backend = new AsyncStorageBackend();
        }
      }

      await this.backend.initialize();
      this.isInitialized = true;
      console.log('✅ Database service initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization error:', error);
      // Fallback vers AsyncStorage si SQLite échoue
      if (Platform.OS !== 'web' && !(this.backend instanceof AsyncStorageBackend)) {
        console.log('⚠️ Falling back to AsyncStorage backend');
        this.backend = new AsyncStorageBackend();
        await this.backend.initialize();
        this.isInitialized = true;
      } else {
        throw error;
      }
    }
  }

  private async getBackend(): Promise<StorageBackend> {
    await this.initialize();
    if (!this.backend) throw new Error('Backend not initialized');
    return this.backend;
  }

  // === API PUBLIQUE ===

  async getAllBills(): Promise<Bill[]> {
    const backend = await this.getBackend();
    return backend.getAllBills();
  }

  async getTotalCount(): Promise<number> {
    const backend = await this.getBackend();
    return backend.getTotalCount();
  }

  async getBillById(id: number): Promise<Bill | null> {
    const backend = await this.getBackend();
    return backend.getBillById(id);
  }

  async getBillsPage(page: number = 0, pageSize: number = 20): Promise<{
    bills: Bill[];
    total: number;
    hasMore: boolean;
  }> {
    const backend = await this.getBackend();
    return backend.getBillsPage(page, pageSize);
  }

  async getRecentBills(limit: number = 200): Promise<Bill[]> {
    const backend = await this.getBackend();
    return backend.getRecentBills(limit);
  }

  async getFilteredBills(filters: Parameters<StorageBackend['getFilteredBills']>[0]): Promise<Bill[]> {
    const backend = await this.getBackend();
    return backend.getFilteredBills(filters);
  }

  async getBillsForDate(date: Date): Promise<Bill[]> {
    const backend = await this.getBackend();
    return backend.getBillsForDate(date);
  }

  async getStatistics(): Promise<BillsStatistics> {
    const backend = await this.getBackend();
    return backend.getStatistics();
  }

  async addBill(bill: Bill): Promise<void> {
    const backend = await this.getBackend();
    await backend.addBill(bill);
    this.notifyListeners();
  }

  async deleteBill(billId: number): Promise<void> {
    const backend = await this.getBackend();
    await backend.deleteBill(billId);
    this.notifyListeners();
  }

  async deleteBills(billIds: number[]): Promise<void> {
    const backend = await this.getBackend();
    await backend.deleteBills(billIds);
    this.notifyListeners();
  }

  async clearAllBills(): Promise<void> {
    const backend = await this.getBackend();
    await backend.clearAllBills();
    this.notifyListeners();
  }

  async setBills(bills: Bill[]): Promise<void> {
    const backend = await this.getBackend();
    await backend.setBills(bills);
    this.notifyListeners();
  }

  async performMaintenance(maxBills: number = 1000): Promise<number> {
    const backend = await this.getBackend();
    const deleted = await backend.performMaintenance(maxBills);
    if (deleted > 0) this.notifyListeners();
    return deleted;
  }

  // Pour debug uniquement
  async reset(): Promise<void> {
    this.isInitialized = false;
    this.initPromise = null;
    this.backend = null;
    await AsyncStorage.removeItem(MIGRATION_KEY);
  }

  // Getter pour savoir quel backend est utilisé
  getBackendType(): 'sqlite' | 'asyncstorage' | 'not_initialized' {
    if (!this.backend) return 'not_initialized';
    return this.backend instanceof AsyncStorageBackend ? 'asyncstorage' : 'sqlite';
  }
}

// Export du singleton
export const DatabaseService = DatabaseServiceClass.getInstance();

// Fonctions utilitaires pour compatibilité
export const initDatabase = () => DatabaseService.initialize();
export const getAllBillsFromDB = () => DatabaseService.getAllBills();
export const getBillsCountFromDB = () => DatabaseService.getTotalCount();
export const getRecentBillsFromDB = (limit: number) => DatabaseService.getRecentBills(limit);
export const getBillsPageFromDB = (page: number, pageSize: number) =>
  DatabaseService.getBillsPage(page, pageSize);
export const getFilteredBillsFromDB = (filters: Parameters<typeof DatabaseService.getFilteredBills>[0]) =>
  DatabaseService.getFilteredBills(filters);
export const getBillsForDateFromDB = (date: Date) => DatabaseService.getBillsForDate(date);
export const getBillsStatisticsFromDB = () => DatabaseService.getStatistics();
export const addBillToDB = (bill: Bill) => DatabaseService.addBill(bill);
export const deleteBillFromDB = (id: number) => DatabaseService.deleteBill(id);
export const deleteBillsFromDB = (ids: number[]) => DatabaseService.deleteBills(ids);
export const clearAllBillsFromDB = () => DatabaseService.clearAllBills();
export const setBillsInDB = (bills: Bill[]) => DatabaseService.setBills(bills);
