// utils/DatabaseService.ts - Service de base de données multi-plateforme
// SQLite sur mobile, AsyncStorage optimisé sur web

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types pour les factures
export interface BillRecord {
  id: number;
  tableNumber: number;
  tableName: string | null;
  section: string | null;
  amount: number;
  items: number;
  status: 'pending' | 'paid' | 'split';
  timestamp: string;
  paymentMethod: string | null;
  paymentType: string | null;
  paidItems: string | null; // JSON string
  offeredAmount: number | null;
  guests: number | null;
}

// Interface compatible avec l'ancien système
export interface Bill {
  id: number;
  tableNumber: number;
  tableName?: string;
  section?: string;
  amount: number;
  items: number;
  status: 'pending' | 'paid' | 'split';
  timestamp: string;
  paymentMethod?: 'card' | 'cash' | 'check';
  paymentType?: 'full' | 'split' | 'custom' | 'items';
  paidItems?: any[];
  offeredAmount?: number;
  guests?: number;
}

// Statistiques
export interface BillsStatistics {
  totalBills: number;
  totalAmount: number;
  averageAmount: number;
  oldestBillTimestamp: string | null;
  newestBillTimestamp: string | null;
  billsToday: number;
  billsThisWeek: number;
  billsThisMonth: number;
  amountToday: number;
  amountThisWeek: number;
  amountThisMonth: number;
}

// Clés de stockage
const BILLS_KEY = 'manjo_carn_bills';
const MIGRATION_KEY = 'manjo_carn_sqlite_migrated';
const DB_NAME = 'manjo_carn.db';

// Interface pour le backend de stockage
interface StorageBackend {
  initialize(): Promise<void>;
  getAllBills(): Promise<Bill[]>;
  getTotalCount(): Promise<number>;
  getBillById(id: number): Promise<Bill | null>;
  getBillsPage(page: number, pageSize: number): Promise<{ bills: Bill[]; total: number; hasMore: boolean }>;
  getRecentBills(limit: number): Promise<Bill[]>;
  getFilteredBills(filters: {
    searchText?: string;
    date?: Date;
    dateRange?: { start: Date; end: Date };
    paymentMethod?: string;
    section?: string;
  }): Promise<Bill[]>;
  getBillsForDate(date: Date): Promise<Bill[]>;
  getStatistics(): Promise<BillsStatistics>;
  addBill(bill: Bill): Promise<void>;
  deleteBill(billId: number): Promise<void>;
  deleteBills(billIds: number[]): Promise<void>;
  clearAllBills(): Promise<void>;
  setBills(bills: Bill[]): Promise<void>;
  performMaintenance(maxBills: number): Promise<number>;
}

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

  private invalidateCache(): void {
    this.cacheValid = false;
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
// Backend SQLite (Mobile natif)
// ============================================
class SQLiteBackend implements StorageBackend {
  private db: any = null; // SQLite.SQLiteDatabase
  private SQLite: any = null;

  async initialize(): Promise<void> {
    try {
      // Import dynamique pour éviter l'erreur sur web
      this.SQLite = await import('expo-sqlite');
      this.db = await this.SQLite.openDatabaseAsync(DB_NAME);
      await this.createTables();
      await this.migrateIfNeeded();
      console.log('✅ SQLite backend initialized (native mode)');
    } catch (error) {
      console.error('SQLite initialization error:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not open');

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY,
        tableNumber INTEGER NOT NULL,
        tableName TEXT,
        section TEXT,
        amount REAL NOT NULL DEFAULT 0,
        items INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        timestamp TEXT NOT NULL,
        paymentMethod TEXT,
        paymentType TEXT,
        paidItems TEXT,
        offeredAmount REAL,
        guests INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_bills_timestamp ON bills(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(date(timestamp));
      CREATE INDEX IF NOT EXISTS idx_bills_payment_method ON bills(paymentMethod);
      CREATE INDEX IF NOT EXISTS idx_bills_section ON bills(section);
      CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
    `);
  }

  private async migrateIfNeeded(): Promise<void> {
    const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
    if (migrated) return;

    try {
      const legacyData = await AsyncStorage.getItem(BILLS_KEY);
      if (legacyData) {
        const bills: Bill[] = JSON.parse(legacyData);
        if (bills.length > 0) {
          console.log(`📦 Migrating ${bills.length} bills to SQLite...`);
          await this.insertBillsBatch(bills);
          console.log(`✅ Migration completed`);
        }
      }
      await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    } catch (error) {
      console.error('Migration error:', error);
    }
  }

  private async insertBillsBatch(bills: Bill[]): Promise<void> {
    if (!this.db) throw new Error('Database not open');

    const statement = await this.db.prepareAsync(`
      INSERT OR REPLACE INTO bills
      (id, tableNumber, tableName, section, amount, items, status, timestamp,
       paymentMethod, paymentType, paidItems, offeredAmount, guests)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      for (const bill of bills) {
        await statement.executeAsync([
          bill.id,
          bill.tableNumber,
          bill.tableName || null,
          bill.section || null,
          bill.amount,
          bill.items,
          bill.status,
          bill.timestamp,
          bill.paymentMethod || null,
          bill.paymentType || null,
          bill.paidItems ? JSON.stringify(bill.paidItems) : null,
          bill.offeredAmount || null,
          bill.guests || null,
        ]);
      }
    } finally {
      await statement.finalizeAsync();
    }
  }

  private recordToBill(record: BillRecord): Bill {
    return {
      id: record.id,
      tableNumber: record.tableNumber,
      tableName: record.tableName || undefined,
      section: record.section || undefined,
      amount: record.amount,
      items: record.items,
      status: record.status,
      timestamp: record.timestamp,
      paymentMethod: record.paymentMethod as Bill['paymentMethod'],
      paymentType: record.paymentType as Bill['paymentType'],
      paidItems: record.paidItems ? JSON.parse(record.paidItems) : undefined,
      offeredAmount: record.offeredAmount || undefined,
      guests: record.guests || undefined,
    };
  }

  async getAllBills(): Promise<Bill[]> {
    if (!this.db) throw new Error('Database not open');
    const rows = await this.db.getAllAsync<BillRecord>(
      'SELECT * FROM bills ORDER BY timestamp DESC'
    );
    return rows.map((r: BillRecord) => this.recordToBill(r));
  }

  async getTotalCount(): Promise<number> {
    if (!this.db) throw new Error('Database not open');
    const result = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM bills'
    );
    return result?.count || 0;
  }

  async getBillById(id: number): Promise<Bill | null> {
    if (!this.db) throw new Error('Database not open');
    const row = await this.db.getFirstAsync<BillRecord>(
      'SELECT * FROM bills WHERE id = ?',
      [id]
    );
    return row ? this.recordToBill(row) : null;
  }

  async getBillsPage(page: number, pageSize: number): Promise<{ bills: Bill[]; total: number; hasMore: boolean }> {
    if (!this.db) throw new Error('Database not open');
    const offset = page * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db.getAllAsync<BillRecord>(
        'SELECT * FROM bills ORDER BY timestamp DESC LIMIT ? OFFSET ?',
        [pageSize, offset]
      ),
      this.db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM bills'),
    ]);

    const total = countResult?.count || 0;
    return {
      bills: rows.map((r: BillRecord) => this.recordToBill(r)),
      total,
      hasMore: offset + rows.length < total,
    };
  }

  async getRecentBills(limit: number): Promise<Bill[]> {
    if (!this.db) throw new Error('Database not open');
    const rows = await this.db.getAllAsync<BillRecord>(
      'SELECT * FROM bills ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
    return rows.map((r: BillRecord) => this.recordToBill(r));
  }

  async getFilteredBills(filters: {
    searchText?: string;
    date?: Date;
    dateRange?: { start: Date; end: Date };
    paymentMethod?: string;
    section?: string;
  }): Promise<Bill[]> {
    if (!this.db) throw new Error('Database not open');

    let query = 'SELECT * FROM bills WHERE 1=1';
    const params: any[] = [];

    if (filters.date) {
      const dateStr = filters.date.toISOString().substring(0, 10);
      query += ' AND date(timestamp) = ?';
      params.push(dateStr);
    }

    if (filters.dateRange) {
      query += ' AND timestamp >= ? AND timestamp <= ?';
      params.push(filters.dateRange.start.toISOString());
      params.push(filters.dateRange.end.toISOString());
    }

    if (filters.paymentMethod) {
      query += ' AND paymentMethod = ?';
      params.push(filters.paymentMethod);
    }

    if (filters.section) {
      query += ' AND section = ?';
      params.push(filters.section);
    }

    if (filters.searchText) {
      const search = `%${filters.searchText}%`;
      query += ' AND (tableName LIKE ? OR section LIKE ? OR CAST(amount AS TEXT) LIKE ?)';
      params.push(search, search, search);
    }

    query += ' ORDER BY timestamp DESC';

    const rows = await this.db.getAllAsync<BillRecord>(query, params);
    return rows.map((r: BillRecord) => this.recordToBill(r));
  }

  async getBillsForDate(date: Date): Promise<Bill[]> {
    if (!this.db) throw new Error('Database not open');
    const dateStr = date.toISOString().substring(0, 10);
    const rows = await this.db.getAllAsync<BillRecord>(
      'SELECT * FROM bills WHERE date(timestamp) = ? ORDER BY timestamp DESC',
      [dateStr]
    );
    return rows.map((r: BillRecord) => this.recordToBill(r));
  }

  async getStatistics(): Promise<BillsStatistics> {
    if (!this.db) throw new Error('Database not open');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const stats = await this.db.getFirstAsync<{
      totalBills: number;
      totalAmount: number;
      oldestBill: string | null;
      newestBill: string | null;
    }>(`
      SELECT
        COUNT(*) as totalBills,
        COALESCE(SUM(amount), 0) as totalAmount,
        MIN(timestamp) as oldestBill,
        MAX(timestamp) as newestBill
      FROM bills
    `);

    const todayStats = await this.db.getFirstAsync<{ count: number; amount: number }>(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as amount
      FROM bills WHERE timestamp >= ?
    `, [todayStart]);

    const weekStats = await this.db.getFirstAsync<{ count: number; amount: number }>(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as amount
      FROM bills WHERE timestamp >= ?
    `, [weekAgo]);

    const monthStats = await this.db.getFirstAsync<{ count: number; amount: number }>(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as amount
      FROM bills WHERE timestamp >= ?
    `, [monthAgo]);

    const totalBills = stats?.totalBills || 0;
    const totalAmount = stats?.totalAmount || 0;

    return {
      totalBills,
      totalAmount,
      averageAmount: totalBills > 0 ? totalAmount / totalBills : 0,
      oldestBillTimestamp: stats?.oldestBill || null,
      newestBillTimestamp: stats?.newestBill || null,
      billsToday: todayStats?.count || 0,
      billsThisWeek: weekStats?.count || 0,
      billsThisMonth: monthStats?.count || 0,
      amountToday: todayStats?.amount || 0,
      amountThisWeek: weekStats?.amount || 0,
      amountThisMonth: monthStats?.amount || 0,
    };
  }

  async addBill(bill: Bill): Promise<void> {
    if (!this.db) throw new Error('Database not open');
    await this.db.runAsync(
      `INSERT INTO bills
       (id, tableNumber, tableName, section, amount, items, status, timestamp,
        paymentMethod, paymentType, paidItems, offeredAmount, guests)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bill.id,
        bill.tableNumber,
        bill.tableName || null,
        bill.section || null,
        bill.amount,
        bill.items,
        bill.status,
        bill.timestamp,
        bill.paymentMethod || null,
        bill.paymentType || null,
        bill.paidItems ? JSON.stringify(bill.paidItems) : null,
        bill.offeredAmount || null,
        bill.guests || null,
      ]
    );
  }

  async deleteBill(billId: number): Promise<void> {
    if (!this.db) throw new Error('Database not open');
    await this.db.runAsync('DELETE FROM bills WHERE id = ?', [billId]);
  }

  async deleteBills(billIds: number[]): Promise<void> {
    if (!this.db || billIds.length === 0) return;
    const placeholders = billIds.map(() => '?').join(',');
    await this.db.runAsync(`DELETE FROM bills WHERE id IN (${placeholders})`, billIds);
  }

  async clearAllBills(): Promise<void> {
    if (!this.db) throw new Error('Database not open');
    await this.db.runAsync('DELETE FROM bills');
  }

  async setBills(bills: Bill[]): Promise<void> {
    if (!this.db) throw new Error('Database not open');
    await this.db.execAsync('BEGIN TRANSACTION');
    try {
      await this.db.runAsync('DELETE FROM bills');
      await this.insertBillsBatch(bills);
      await this.db.execAsync('COMMIT');
    } catch (error) {
      await this.db.execAsync('ROLLBACK');
      throw error;
    }
  }

  async performMaintenance(maxBills: number): Promise<number> {
    if (!this.db) throw new Error('Database not open');
    const count = await this.getTotalCount();
    if (count <= maxBills) return 0;

    const toDelete = count - maxBills;
    await this.db.runAsync(`
      DELETE FROM bills WHERE id IN (
        SELECT id FROM bills ORDER BY timestamp ASC LIMIT ?
      )
    `, [toDelete]);
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
        this.backend = new SQLiteBackend();
      }

      await this.backend.initialize();
      this.isInitialized = true;
      console.log('✅ Database service initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization error:', error);
      // Fallback vers AsyncStorage si SQLite échoue
      if (Platform.OS !== 'web') {
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
    return this.backend instanceof SQLiteBackend ? 'sqlite' : 'asyncstorage';
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
