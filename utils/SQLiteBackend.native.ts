// utils/SQLiteBackend.native.ts - Backend SQLite pour plateformes natives uniquement
// Ce fichier ne doit JAMAIS être importé sur web

import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Bill, BillRecord, BillsStatistics, StorageBackend } from './DatabaseService.types';

const BILLS_KEY = 'manjo_carn_bills';
const MIGRATION_KEY = 'manjo_carn_sqlite_migrated_v2'; // Version 2 pour forcer re-migration
const DB_NAME = 'manjo_carn.db';
const SCHEMA_VERSION = 2;

export class SQLiteBackend implements StorageBackend {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.ensureSchema();
      await this.migrateFromAsyncStorageIfNeeded();
      console.log('✅ SQLite backend initialized (native mode)');
    } catch (error) {
      console.error('SQLite initialization error:', error);
      throw error;
    }
  }

  // Vérifie et met à jour le schéma si nécessaire
  private async ensureSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not open');

    try {
      // Vérifier si la table existe et a les bonnes colonnes
      const tableInfo = await this.db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(bills)"
      );

      const columns = tableInfo.map(col => col.name);
      const requiredColumns = ['id', 'tableNumber', 'tableName', 'section', 'amount',
                               'items', 'status', 'timestamp', 'paymentMethod',
                               'paymentType', 'paidItems', 'offeredAmount', 'guests'];

      const hasAllColumns = requiredColumns.every(col => columns.includes(col));

      if (!hasAllColumns || columns.length === 0) {
        console.log('📦 Schema outdated or missing, recreating tables...');
        await this.recreateTables();
      }
    } catch (error) {
      console.log('📦 Creating new database schema...');
      await this.recreateTables();
    }
  }

  // Recrée les tables avec le bon schéma
  private async recreateTables(): Promise<void> {
    if (!this.db) throw new Error('Database not open');

    // Sauvegarder les données existantes si possible
    let existingBills: Bill[] = [];
    try {
      const rows = await this.db.getAllAsync<any>('SELECT * FROM bills');
      existingBills = rows.map(row => this.rowToBill(row)).filter(b => b !== null) as Bill[];
      console.log(`💾 Backed up ${existingBills.length} existing bills`);
    } catch (e) {
      // Table doesn't exist or is corrupted, ignore
    }

    // Supprimer l'ancienne table
    await this.db.execAsync('DROP TABLE IF EXISTS bills');

    // Créer la nouvelle table
    await this.db.execAsync(`
      CREATE TABLE bills (
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

    // Restaurer les données sauvegardées
    if (existingBills.length > 0) {
      await this.insertBillsBatch(existingBills);
      console.log(`✅ Restored ${existingBills.length} bills`);
    }

    // Réinitialiser le flag de migration pour forcer la re-migration depuis AsyncStorage
    await AsyncStorage.removeItem(MIGRATION_KEY);
  }

  // Convertit une row brute en Bill (gère les anciens schémas)
  private rowToBill(row: any): Bill | null {
    try {
      return {
        id: row.id,
        tableNumber: row.tableNumber || row.table_number || 0,
        tableName: row.tableName || row.table_name || undefined,
        section: row.section || undefined,
        amount: row.amount || 0,
        items: row.items || 0,
        status: row.status || 'pending',
        timestamp: row.timestamp || row.created_at || new Date().toISOString(),
        paymentMethod: row.paymentMethod || row.payment_method || undefined,
        paymentType: row.paymentType || row.payment_type || undefined,
        paidItems: row.paidItems ? (typeof row.paidItems === 'string' ? JSON.parse(row.paidItems) : row.paidItems) : undefined,
        offeredAmount: row.offeredAmount || row.offered_amount || undefined,
        guests: row.guests || undefined,
      };
    } catch (e) {
      return null;
    }
  }

  private async migrateFromAsyncStorageIfNeeded(): Promise<void> {
    const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
    if (migrated) return;

    try {
      const legacyData = await AsyncStorage.getItem(BILLS_KEY);
      if (legacyData) {
        const bills: Bill[] = JSON.parse(legacyData);
        if (bills.length > 0) {
          // Vérifier si des bills sont déjà dans SQLite
          const count = await this.getTotalCount();
          if (count === 0) {
            console.log(`📦 Migrating ${bills.length} bills from AsyncStorage to SQLite...`);
            await this.insertBillsBatch(bills);
            console.log(`✅ Migration completed`);
          }
        }
      }
      await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    } catch (error) {
      console.error('Migration error:', error);
    }
  }

  private async insertBillsBatch(bills: Bill[]): Promise<void> {
    if (!this.db || bills.length === 0) return;

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
          bill.timestamp || new Date().toISOString(),
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
    return rows.map((r) => this.recordToBill(r));
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
      bills: rows.map((r) => this.recordToBill(r)),
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
    return rows.map((r) => this.recordToBill(r));
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
    return rows.map((r) => this.recordToBill(r));
  }

  async getBillsForDate(date: Date): Promise<Bill[]> {
    if (!this.db) throw new Error('Database not open');
    const dateStr = date.toISOString().substring(0, 10);
    const rows = await this.db.getAllAsync<BillRecord>(
      'SELECT * FROM bills WHERE date(timestamp) = ? ORDER BY timestamp DESC',
      [dateStr]
    );
    return rows.map((r) => this.recordToBill(r));
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
        bill.timestamp || new Date().toISOString(),
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
