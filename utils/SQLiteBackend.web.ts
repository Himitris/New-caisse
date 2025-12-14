// utils/SQLiteBackend.web.ts - Stub pour web (SQLite non disponible)
// Ce fichier ne sera jamais utilisé car on utilise AsyncStorage sur web

import type { StorageBackend } from './DatabaseService.types';

// Export un stub qui ne sera jamais appelé sur web
export class SQLiteBackend implements StorageBackend {
  async initialize(): Promise<void> {
    throw new Error('SQLite is not available on web platform');
  }

  async getAllBills(): Promise<any[]> {
    throw new Error('SQLite is not available on web platform');
  }

  async getTotalCount(): Promise<number> {
    throw new Error('SQLite is not available on web platform');
  }

  async getBillById(): Promise<any> {
    throw new Error('SQLite is not available on web platform');
  }

  async getBillsPage(): Promise<any> {
    throw new Error('SQLite is not available on web platform');
  }

  async getRecentBills(): Promise<any[]> {
    throw new Error('SQLite is not available on web platform');
  }

  async getFilteredBills(): Promise<any[]> {
    throw new Error('SQLite is not available on web platform');
  }

  async getBillsForDate(): Promise<any[]> {
    throw new Error('SQLite is not available on web platform');
  }

  async getStatistics(): Promise<any> {
    throw new Error('SQLite is not available on web platform');
  }

  async addBill(): Promise<void> {
    throw new Error('SQLite is not available on web platform');
  }

  async deleteBill(): Promise<void> {
    throw new Error('SQLite is not available on web platform');
  }

  async deleteBills(): Promise<void> {
    throw new Error('SQLite is not available on web platform');
  }

  async clearAllBills(): Promise<void> {
    throw new Error('SQLite is not available on web platform');
  }

  async setBills(): Promise<void> {
    throw new Error('SQLite is not available on web platform');
  }

  async performMaintenance(): Promise<number> {
    throw new Error('SQLite is not available on web platform');
  }
}
