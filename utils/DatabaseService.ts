// utils/DatabaseService.ts - Service de base de données SQLite
// Migration depuis AsyncStorage pour de meilleures performances

import * as SQLite from 'expo-sqlite';
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

// Clés de migration
const MIGRATION_KEY = 'manjo_carn_sqlite_migrated';
const LEGACY_BILLS_KEY = 'manjo_carn_bills';
const DB_NAME = 'manjo_carn.db';

class DatabaseServiceClass {
  private static instance: DatabaseServiceClass;
  private db: SQLite.SQLiteDatabase | null = null;
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

  // Initialiser la base de données
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
      // Ouvrir la base de données
      this.db = await SQLite.openDatabaseAsync(DB_NAME);

      // Créer les tables
      await this.createTables();

      // Vérifier si migration nécessaire
      const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
      if (!migrated) {
        await this.migrateFromAsyncStorage();
        await AsyncStorage.setItem(MIGRATION_KEY, 'true');
      }

      this.isInitialized = true;
      console.log('✅ SQLite database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization error:', error);
      throw error;
    }
  }

  // Créer les tables
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not open');

    // Table des factures avec index
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

      -- Index pour les recherches fréquentes
      CREATE INDEX IF NOT EXISTS idx_bills_timestamp ON bills(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(date(timestamp));
      CREATE INDEX IF NOT EXISTS idx_bills_payment_method ON bills(paymentMethod);
      CREATE INDEX IF NOT EXISTS idx_bills_section ON bills(section);
      CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
    `);

    console.log('✅ Tables and indexes created');
  }

  // Migration depuis AsyncStorage
  private async migrateFromAsyncStorage(): Promise<void> {
    try {
      const legacyData = await AsyncStorage.getItem(LEGACY_BILLS_KEY);
      if (!legacyData) {
        console.log('No legacy data to migrate');
        return;
      }

      const bills: Bill[] = JSON.parse(legacyData);
      if (bills.length === 0) {
        console.log('No bills to migrate');
        return;
      }

      console.log(`📦 Migrating ${bills.length} bills to SQLite...`);

      // Insérer par lots de 100 pour les performances
      const batchSize = 100;
      for (let i = 0; i < bills.length; i += batchSize) {
        const batch = bills.slice(i, i + batchSize);
        await this.insertBillsBatch(batch);
      }

      console.log(`✅ Migration completed: ${bills.length} bills migrated`);
    } catch (error) {
      console.error('❌ Migration error:', error);
      throw error;
    }
  }

  // Insérer un lot de factures
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

  // === API PUBLIQUE ===

  // Obtenir toutes les factures
  async getAllBills(): Promise<Bill[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not open');

    const rows = await this.db.getAllAsync<BillRecord>(
      'SELECT * FROM bills ORDER BY timestamp DESC'
    );

    return rows.map(this.recordToBill);
  }

  // Obtenir le nombre total de factures (O(1) avec COUNT)
  async getTotalCount(): Promise<number> {
    await this.initialize();
    if (!this.db) throw new Error('Database not open');

    const result = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM bills'
    );

    return result?.count || 0;
  }

  // Obtenir une facture par ID
  async getBillById(id: number): Promise<Bill | null> {
    await this.initialize();
    if (!this.db) throw new Error('Database not open');

    const row = await this.db.getFirstAsync<BillRecord>(
      'SELECT * FROM bills WHERE id = ?',
      [id]
    );

    return row ? this.recordToBill(row) : null;
  }

  // Obtenir les factures avec pagination (vraie pagination SQL)
  async getBillsPage(page: number = 0, pageSize: number = 20): Promise<{
    bills: Bill[];
    total: number;
    hasMore: boolean;
  }> {
    await this.initialize();
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
      bills: rows.map(this.recordToBill),
      total,
      hasMore: offset + rows.length < total,
    };
  }

  // Obtenir les N factures les plus récentes
  async getRecentBills(limit: number = 200): Promise<Bill[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not open');

    const rows = await this.db.getAllAsync<BillRecord>(
      'SELECT * FROM bills ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );

    return rows.map(this.recordToBill);
  }

  // Filtrer les factures (utilise les index SQL)
  async getFilteredBills(filters: {
    searchText?: string;
    date?: Date;
    dateRange?: { start: Date; end: Date };
    paymentMethod?: string;
    section?: string;
  }): Promise<Bill[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not open');

    let query = 'SELECT * FROM bills WHERE 1=1';
    const params: any[] = [];

    // Filtre par date exacte
    if (filters.date) {
      const dateStr = filters.date.toISOString().substring(0, 10);
      query += ' AND date(timestamp) = ?';
      params.push(dateStr);
    }

    // Filtre par plage de dates
    if (filters.dateRange) {
      query += ' AND timestamp >= ? AND timestamp <= ?';
      params.push(filters.dateRange.start.toISOString());
      params.push(filters.dateRange.end.toISOString());
    }

    // Filtre par méthode de paiement
    if (filters.paymentMethod) {
      query += ' AND paymentMethod = ?';
      params.push(filters.paymentMethod);
    }

    // Filtre par section
    if (filters.section) {
      query += ' AND section = ?';
      params.push(filters.section);
    }

    // Filtre par texte (recherche dans tableName et section)
    if (filters.searchText) {
      const search = `%${filters.searchText}%`;
      query += ' AND (tableName LIKE ? OR section LIKE ? OR CAST(amount AS TEXT) LIKE ?)';
      params.push(search, search, search);
    }

    query += ' ORDER BY timestamp DESC';

    const rows = await this.db.getAllAsync<BillRecord>(query, params);
    return rows.map(this.recordToBill);
  }

  // Obtenir les factures d'une journée spécifique
  async getBillsForDate(date: Date): Promise<Bill[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not open');

    const dateStr = date.toISOString().substring(0, 10);

    const rows = await this.db.getAllAsync<BillRecord>(
      'SELECT * FROM bills WHERE date(timestamp) = ? ORDER BY timestamp DESC',
      [dateStr]
    );

    return rows.map(this.recordToBill);
  }

  // Obtenir les statistiques (une seule requête SQL)
  async getStatistics(): Promise<BillsStatistics> {
    await this.initialize();
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

    const todayStats = await this.db.getFirstAsync<{
      count: number;
      amount: number;
    }>(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as amount
      FROM bills WHERE timestamp >= ?
    `, [todayStart]);

    const weekStats = await this.db.getFirstAsync<{
      count: number;
      amount: number;
    }>(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as amount
      FROM bills WHERE timestamp >= ?
    `, [weekAgo]);

    const monthStats = await this.db.getFirstAsync<{
      count: number;
      amount: number;
    }>(`
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

  // Ajouter une facture
  async addBill(bill: Bill): Promise<void> {
    await this.initialize();
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

    this.notifyListeners();
  }

  // Supprimer une facture
  async deleteBill(billId: number): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not open');

    await this.db.runAsync('DELETE FROM bills WHERE id = ?', [billId]);
    this.notifyListeners();
  }

  // Supprimer plusieurs factures
  async deleteBills(billIds: number[]): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not open');

    if (billIds.length === 0) return;

    const placeholders = billIds.map(() => '?').join(',');
    await this.db.runAsync(
      `DELETE FROM bills WHERE id IN (${placeholders})`,
      billIds
    );

    this.notifyListeners();
  }

  // Supprimer toutes les factures
  async clearAllBills(): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not open');

    await this.db.runAsync('DELETE FROM bills');
    this.notifyListeners();
  }

  // Remplacer toutes les factures (pour import/restore)
  async setBills(bills: Bill[]): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not open');

    // Transaction pour atomicité
    await this.db.execAsync('BEGIN TRANSACTION');

    try {
      await this.db.runAsync('DELETE FROM bills');
      await this.insertBillsBatch(bills);
      await this.db.execAsync('COMMIT');
    } catch (error) {
      await this.db.execAsync('ROLLBACK');
      throw error;
    }

    this.notifyListeners();
  }

  // Maintenance: garder seulement les N factures les plus récentes
  async performMaintenance(maxBills: number = 1000): Promise<number> {
    await this.initialize();
    if (!this.db) throw new Error('Database not open');

    const count = await this.getTotalCount();
    if (count <= maxBills) return 0;

    const toDelete = count - maxBills;

    // Supprimer les plus anciennes
    await this.db.runAsync(`
      DELETE FROM bills WHERE id IN (
        SELECT id FROM bills ORDER BY timestamp ASC LIMIT ?
      )
    `, [toDelete]);

    this.notifyListeners();
    return toDelete;
  }

  // Forcer la réinitialisation (pour debug)
  async reset(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
    this.isInitialized = false;
    this.initPromise = null;
    await AsyncStorage.removeItem(MIGRATION_KEY);
  }

  // Convertir un enregistrement DB en Bill
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
