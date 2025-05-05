// utils/storage.ts - Version optimisée avec compression et gestion intelligente de la mémoire

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { events, EVENT_TYPES } from './events';

// Types d'entités
export interface Table {
  id: number;
  name: string;
  section: string;
  status: 'available' | 'occupied' | 'reserved';
  seats: number;
  guests?: number;
  order?: Order;
}

export interface OrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface Order {
  id: number;
  items: OrderItem[];
  guests: number;
  status: 'active' | 'completed';
  timestamp: string;
  total: number;
}

export interface Bill {
  id: number;
  tableNumber: number;
  amount: number;
  items: number;
  status: 'pending' | 'paid' | 'split';
  timestamp: string;
  tableName?: string;
  section?: string;
  paymentMethod?: 'card' | 'cash' | 'check';
  paymentType?: 'full' | 'split' | 'custom' | 'items';
  paidItems?: any[];
}

export interface MenuItemAvailability {
  id: number;
  available: boolean;
  name: string;
  price: number;
}

export interface CustomMenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  type: 'resto' | 'boisson';
  available: boolean;
}

// Constantes optimisées
export const TABLE_SECTIONS = {
  EAU: 'Eau',
  BUIS: 'Buis',
} as const;

// Clés pour AsyncStorage avec versioning
const STORAGE_PREFIX = 'manjo_carn_';
const STORAGE_VERSION = 'v4'; // Incrémenté pour la nouvelle version optimisée

const STORAGE_KEYS = {
  TABLES: `${STORAGE_PREFIX}tables_${STORAGE_VERSION}`,
  BILLS: `${STORAGE_PREFIX}bills_${STORAGE_VERSION}`,
  BILLS_ARCHIVE: `${STORAGE_PREFIX}bills_archive_${STORAGE_VERSION}`,
  MENU_AVAILABILITY: `${STORAGE_PREFIX}menu_availability_${STORAGE_VERSION}`,
  FIRST_LAUNCH: `${STORAGE_PREFIX}first_launch_${STORAGE_VERSION}`,
  APP_VERSION: `${STORAGE_PREFIX}app_version_${STORAGE_VERSION}`,
  LAST_SYNC: `${STORAGE_PREFIX}last_sync_${STORAGE_VERSION}`,
  CUSTOM_MENU_ITEMS: `${STORAGE_PREFIX}custom_menu_items_${STORAGE_VERSION}`,
  SETTINGS_STORAGE_KEY: `${STORAGE_PREFIX}restaurant_settings_${STORAGE_VERSION}`,
  CACHE: `${STORAGE_PREFIX}cache_${STORAGE_VERSION}`,
  SETTINGS: `${STORAGE_PREFIX}settings_${STORAGE_VERSION}`,
} as const;

// Configuration optimisée
const CONFIG = {
  APP_VERSION: '1.0.0',
  MAX_BILLS: 1000,
  MAX_ARCHIVE_AGE_DAYS: 90,
  CACHE_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes
  MAX_STORAGE_SIZE_MB: 5,
  COMPRESSION_ENABLED: false,
  BATCH_SIZE: 100,
} as const;

// Cache en mémoire
class MemoryCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > CONFIG.CACHE_EXPIRY_MS) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Système de compression simple
class CompressionManager {
  static compress(data: any): string {
    try {
      const jsonStr = JSON.stringify(data);
      // Implémentation d'une compression basique (peut être améliorée avec LZ-string)
      const compressed = jsonStr.replace(/(.)\1+/g, (match, char) => {
        return char + match.length;
      });
      return compressed;
    } catch (error) {
      console.error('Compression error:', error);
      return JSON.stringify(data);
    }
  }

  static decompress(data: string): any {
    try {
      // Décompresser
      const decompressed = data.replace(/(.)\d+/g, (match, char) => {
        const count = parseInt(match.substring(1), 10);
        return char.repeat(count);
      });
      return JSON.parse(decompressed);
    } catch (error) {
      console.error('Decompression error:', error);
      return JSON.parse(data);
    }
  }
}

// Fonction améliorée de log avec horodatage et niveaux
const log = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[INFO][${timestamp}][${Platform.OS}] ${message}`, data || '');
  },
  error: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.error(
      `[ERROR][${timestamp}][${Platform.OS}] ${message}`,
      data || ''
    );
  },
  perf: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[PERF][${timestamp}][${Platform.OS}] ${message}`, data || '');
  },
};

// Classe utilitaire améliorée pour gérer le stockage
class StorageManager {
  private static memoryCache = new MemoryCache();
  private static performanceMonitor = new Map<
    string,
    { reads: number; writes: number }
  >();

  static async resetApplicationData(): Promise<void> {
    try {
      const keysToReset = [
        STORAGE_KEYS.BILLS,
        STORAGE_KEYS.BILLS_ARCHIVE,
        STORAGE_KEYS.MENU_AVAILABILITY,
        STORAGE_KEYS.LAST_SYNC,
        STORAGE_KEYS.CACHE,
      ];

      for (const key of keysToReset) {
        await AsyncStorage.removeItem(key);
      }

      this.memoryCache.clear();
      log.info("Les données de l'application ont été réinitialisées");

      await AsyncStorage.setItem(STORAGE_KEYS.APP_VERSION, CONFIG.APP_VERSION);
    } catch (error) {
      log.error('Erreur lors de la réinitialisation des données:', error);
      throw error;
    }
  }

  static async save<T>(
    key: string,
    data: T,
    compress: boolean = CONFIG.COMPRESSION_ENABLED
  ): Promise<void> {
    const startTime = Date.now();
    try {
      let jsonValue: string;

      if (compress && this.shouldCompress(data)) {
        jsonValue = CompressionManager.compress(data);
      } else {
        jsonValue = JSON.stringify(data);
      }

      await AsyncStorage.setItem(key, jsonValue);
      this.memoryCache.set(key, data);

      this.trackPerformance(key, 'write');
      log.perf(`Saved data to ${key}`, { duration: Date.now() - startTime });
    } catch (error) {
      log.error(`Error saving data to ${key}:`, error);
      throw error;
    }
  }

  static async load<T>(key: string, defaultValue: T): Promise<T> {
    const startTime = Date.now();
    try {
      // Vérifier le cache en mémoire
      const cachedData = this.memoryCache.get<T>(key);
      if (cachedData !== null) {
        log.perf(`Cache hit for ${key}`, { duration: Date.now() - startTime });
        return cachedData;
      }

      const jsonValue = await AsyncStorage.getItem(key);
      if (jsonValue === null) {
        log.info(`No data found for ${key}, using default value`);
        return defaultValue;
      }

      let parsedData: T;
      try {
        parsedData = JSON.parse(jsonValue) as T;
      } catch (parseError) {
        // Tenter de décompresser si parse échoue
        parsedData = CompressionManager.decompress(jsonValue) as T;
      }

      this.memoryCache.set(key, parsedData);
      this.trackPerformance(key, 'read');
      log.perf(`Loaded data from ${key}`, { duration: Date.now() - startTime });

      return parsedData;
    } catch (error) {
      log.error(`Error loading data from ${key}:`, error);
      return defaultValue;
    }
  }

  private static shouldCompress(data: any): boolean {
    const jsonStr = JSON.stringify(data);
    return jsonStr.length > 1024; // Compress si > 1KB
  }

  private static trackPerformance(
    key: string,
    operation: 'read' | 'write'
  ): void {
    if (!this.performanceMonitor.has(key)) {
      this.performanceMonitor.set(key, { reads: 0, writes: 0 });
    }

    const stats = this.performanceMonitor.get(key)!;
    if (operation === 'read') {
      stats.reads++;
    } else {
      stats.writes++;
    }
  }

  static getPerformanceStats(): Array<{
    key: string;
    reads: number;
    writes: number;
  }> {
    const stats: Array<{ key: string; reads: number; writes: number }> = [];
    this.performanceMonitor.forEach((value, key) => {
      stats.push({ key, ...value });
    });
    return stats;
  }

  static async isFirstLaunch(): Promise<boolean> {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_LAUNCH);
    return value === null || value === 'true';
  }

  static async markAppLaunched(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.FIRST_LAUNCH, 'false');
    await AsyncStorage.setItem(STORAGE_KEYS.APP_VERSION, CONFIG.APP_VERSION);
  }

  static async checkForMigrations(): Promise<boolean> {
    const storedVersion = await AsyncStorage.getItem(STORAGE_KEYS.APP_VERSION);
    return storedVersion !== CONFIG.APP_VERSION;
  }

  static async clearAllData(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter((key) =>
        key.startsWith(STORAGE_PREFIX)
      );
      await AsyncStorage.multiRemove(keysToRemove);
      this.memoryCache.clear();
      log.info(`Cleared ${keysToRemove.length} storage keys`);
    } catch (error) {
      log.error('Error clearing data:', error);
      throw error;
    }
  }
}

// Données par défaut pour les tables (inchangé)
export const defaultTables: Table[] = [
  // EAU Section
  {
    id: 1,
    name: 'Doc 1',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 4,
  },
  {
    id: 2,
    name: 'Doc 2',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 4,
  },
  {
    id: 3,
    name: 'Doc 3',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 4,
  },
  {
    id: 4,
    name: 'Vue 1',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 4,
  },
  {
    id: 5,
    name: 'Vue 2',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 4,
  },
  {
    id: 6,
    name: 'R1',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 2,
  },
  {
    id: 7,
    name: 'R2',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 2,
  },
  {
    id: 8,
    name: 'R3',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 2,
  },
  {
    id: 9,
    name: 'R4',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 2,
  },
  {
    id: 10,
    name: 'Poteau',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 4,
  },
  {
    id: 11,
    name: 'Ext 1',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 4,
  },
  {
    id: 12,
    name: 'Ext 2',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 4,
  },
  {
    id: 13,
    name: 'Ext Rge',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 6,
  },

  // BUIS Section
  {
    id: 14,
    name: 'Bas 0',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 15,
    name: 'Bas 1',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 16,
    name: 'Arbre 1',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 17,
    name: 'Arbre 2',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 18,
    name: 'Tronc',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 2,
  },
  {
    id: 19,
    name: 'Caillou',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 2,
  },
  {
    id: 20,
    name: 'Escalier 1',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 21,
    name: 'Escalier 2',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 22,
    name: 'Transfo',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 6,
  },
  {
    id: 23,
    name: 'Bache 1',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 24,
    name: 'Bache 2',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 25,
    name: 'Bache 3',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 26,
    name: 'Che 1',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 27,
    name: 'Che 2',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 28,
    name: 'PDC 1',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 29,
    name: 'PDC 2',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 30,
    name: 'Eve Rgb',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 6,
  },
  {
    id: 31,
    name: 'Eve Bois',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 6,
  },
  {
    id: 32,
    name: 'HDB',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 33,
    name: 'Lukas 1',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 34,
    name: 'Lukas 2',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 35,
    name: 'Route 1',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 36,
    name: 'Route 2',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 37,
    name: 'Sous Cabane',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 6,
  },
];

// Classe de gestion des tables optimisée
class TableManager {
  private static readonly CACHE_KEY = 'tables_cache';

  static async initializeTables(): Promise<Table[]> {
    try {
      const existingTables = await StorageManager.load<Table[]>(
        STORAGE_KEYS.TABLES,
        []
      );

      if (existingTables.length > 0) {
        log.info('Tables already exist, skipping initialization');
        return existingTables;
      }

      log.info('First initialization of tables with default data');
      await StorageManager.save(STORAGE_KEYS.TABLES, defaultTables);
      await StorageManager.markAppLaunched();
      return defaultTables;
    } catch (error) {
      log.error('Error initializing tables:', error);
      return defaultTables;
    }
  }

  static async getTables(): Promise<Table[]> {
    try {
      let tables = await StorageManager.load<Table[]>(STORAGE_KEYS.TABLES, []);

      if (tables.length === 0) {
        log.info('No tables found, initializing with defaults');
        return await TableManager.initializeTables();
      }

      const needsCorrection = tables.some((table) => !table.section);
      if (needsCorrection) {
        log.info('Found tables with missing section, correcting...');
        tables = tables.map((table) => {
          if (!table.section) {
            const defaultTable = defaultTables.find((t) => t.id === table.id);
            return {
              ...table,
              section: defaultTable?.section || TABLE_SECTIONS.EAU,
            };
          }
          return table;
        });
        await StorageManager.save(STORAGE_KEYS.TABLES, tables);
      }

      return tables;
    } catch (error) {
      log.error('Error retrieving tables:', error);
      return defaultTables;
    }
  }

  static async saveTables(tables: Table[]): Promise<void> {
    return StorageManager.save(STORAGE_KEYS.TABLES, tables);
  }

  static async getTable(id: number): Promise<Table | null> {
    try {
      const tables = await TableManager.getTables();
      return tables.find((table) => table.id === id) || null;
    } catch (error) {
      log.error(`Error getting table ${id}:`, error);
      return null;
    }
  }

  static async updateTable(updatedTable: Table): Promise<void> {
    try {
      const tables = await TableManager.getTables();

      const existingIndex = tables.findIndex(
        (table) => table.id === updatedTable.id
      );

      if (existingIndex >= 0) {
        tables[existingIndex] = updatedTable;
      } else {
        tables.push(updatedTable);
      }

      await TableManager.saveTables(tables);
      log.info(`Updated table ${updatedTable.id} successfully`);
    } catch (error) {
      log.error(`Error updating table ${updatedTable.id}:`, error);
      throw error;
    }
  }

  static async resetTable(tableId: number): Promise<void> {
    try {
      const tables = await TableManager.getTables();
      const tableIndex = tables.findIndex((table) => table.id === tableId);

      if (tableIndex >= 0) {
        const defaultTable = defaultTables.find((t) => t.id === tableId);

        tables[tableIndex] = {
          ...(defaultTable || tables[tableIndex]),
          name: tables[tableIndex].name,
          section: tables[tableIndex].section,
          status: 'available',
          guests: undefined,
          order: undefined,
        };

        await TableManager.saveTables(tables);
        log.info(`Reset table ${tableId} to available state`);
      } else {
        log.info(`Table ${tableId} not found for reset`);
      }
    } catch (error) {
      log.error(`Error resetting table ${tableId}:`, error);
      throw error;
    }
  }

  static async resetAllTables(): Promise<void> {
    try {
      const currentTables = await TableManager.getTables();

      const resetTables = defaultTables.map((defaultTable) => {
        const existingTable = currentTables.find(
          (t) => t.id === defaultTable.id
        );
        return {
          ...defaultTable,
          name: existingTable?.name || defaultTable.name,
          section: existingTable?.section || defaultTable.section,
        };
      });

      await TableManager.saveTables(resetTables);
      log.info('All tables have been reset to default state');
    } catch (error) {
      log.error('Error resetting all tables:', error);
      throw error;
    }
  }
}

// Classe de gestion des factures optimisée
class BillManager {
  static async getBills(): Promise<Bill[]> {
    return StorageManager.load<Bill[]>(STORAGE_KEYS.BILLS, []);
  }

  static async saveBills(bills: Bill[]): Promise<void> {
    return StorageManager.save(STORAGE_KEYS.BILLS, bills);
  }

  static async addBill(bill: Bill): Promise<void> {
    try {
      const bills = await BillManager.getBills();
      bills.push(bill);

      // Nettoyer les anciennes factures si nécessaire
      const cleanedBills = await BillManager.cleanOldBills(bills);

      await BillManager.saveBills(cleanedBills);
      log.info(`Added new bill ID ${bill.id} for table ${bill.tableNumber}`);

      events.emit(EVENT_TYPES.PAYMENT_ADDED, bill.tableNumber, bill);
    } catch (error) {
      log.error(`Error adding bill:`, error);
      throw error;
    }
  }

  private static async cleanOldBills(bills: Bill[]): Promise<Bill[]> {
    if (bills.length <= CONFIG.MAX_BILLS) {
      return bills;
    }

    // Trier par date et garder les plus récents
    const sortedBills = [...bills].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Archiver les anciens
    const toArchive = sortedBills.slice(CONFIG.MAX_BILLS);
    await BillManager.archiveOldBills(toArchive);

    // Garder les plus récents
    const cleanedBills = sortedBills.slice(0, CONFIG.MAX_BILLS);

    log.info(`Cleaned ${bills.length - cleanedBills.length} old bills`);

    return cleanedBills;
  }

  private static async archiveOldBills(bills: Bill[]): Promise<void> {
    try {
      const existingArchive = await StorageManager.load<Bill[]>(
        STORAGE_KEYS.BILLS_ARCHIVE,
        []
      );
      const updatedArchive = [...existingArchive, ...bills];

      // Nettoyer l'archive si elle devient trop grande
      const cleanedArchive = BillManager.pruneArchive(updatedArchive);

      await StorageManager.save(STORAGE_KEYS.BILLS_ARCHIVE, cleanedArchive);
      log.info(`Archived ${bills.length} bills`);
    } catch (error) {
      log.error('Error archiving bills:', error);
    }
  }

  private static pruneArchive(archive: Bill[]): Bill[] {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() - CONFIG.MAX_ARCHIVE_AGE_DAYS);

    return archive.filter((bill) => new Date(bill.timestamp) > maxDate);
  }

  static async clearAllBills(): Promise<void> {
    try {
      await StorageManager.save(STORAGE_KEYS.BILLS, []);
      log.info('Toutes les factures ont été supprimées');
    } catch (error) {
      log.error('Erreur lors de la suppression des factures:', error);
      throw error;
    }
  }

  static async deleteBill(billId: number): Promise<void> {
    try {
      const bills = await BillManager.getBills();
      const updatedBills = bills.filter((bill) => bill.id !== billId);

      if (bills.length !== updatedBills.length) {
        await BillManager.saveBills(updatedBills);
        log.info(`Deleted bill ID ${billId}`);
      } else {
        log.info(`Bill ID ${billId} not found for deletion`);
      }
    } catch (error) {
      log.error(`Error deleting bill ${billId}:`, error);
      throw error;
    }
  }

  static async getBillsForTable(tableId: number): Promise<Bill[]> {
    try {
      const bills = await BillManager.getBills();

      const tableBills = bills.filter((bill) => bill.tableNumber === tableId);

      tableBills.sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return dateB - dateA;
      });

      return tableBills;
    } catch (error) {
      log.error(`Error getting bills for table ${tableId}:`, error);
      return [];
    }
  }

  static async getBillsByDate(date: Date): Promise<Bill[]> {
    try {
      const bills = await BillManager.getBills();
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      return bills.filter((bill) => {
        const billDate = new Date(bill.timestamp);
        return billDate >= startOfDay && billDate <= endOfDay;
      });
    } catch (error) {
      log.error(`Error getting bills by date:`, error);
      return [];
    }
  }
}

// Classe de gestion de la disponibilité des articles du menu
class MenuManager {
  static async getMenuAvailability(): Promise<MenuItemAvailability[]> {
    return StorageManager.load<MenuItemAvailability[]>(
      STORAGE_KEYS.MENU_AVAILABILITY,
      []
    );
  }

  static async saveMenuAvailability(
    items: MenuItemAvailability[]
  ): Promise<void> {
    try {
      const validItems = items.filter(
        (item) =>
          typeof item.id === 'number' &&
          typeof item.available === 'boolean' &&
          typeof item.name === 'string' &&
          typeof item.price === 'number'
      );

      if (validItems.length > 0) {
        await StorageManager.save(STORAGE_KEYS.MENU_AVAILABILITY, validItems);
        log.info(
          `Saved availability status for ${validItems.length} menu items`
        );
      } else {
        log.info('No valid menu items to save');
      }
    } catch (error) {
      log.error(`Error saving menu availability:`, error);
      throw error;
    }
  }

  static async updateItemAvailability(
    itemId: number,
    available: boolean
  ): Promise<void> {
    try {
      const items = await MenuManager.getMenuAvailability();
      const existingItemIndex = items.findIndex((item) => item.id === itemId);

      if (existingItemIndex >= 0) {
        items[existingItemIndex].available = available;
      } else {
        log.info(
          `Cannot update availability for item ${itemId} - not found in availability list`
        );
        return;
      }

      await MenuManager.saveMenuAvailability(items);
      log.info(`Updated availability of item ${itemId} to ${available}`);
    } catch (error) {
      log.error(`Error updating item availability:`, error);
      throw error;
    }
  }
}

class CustomMenuManager {
  static async getCustomMenuItems(): Promise<CustomMenuItem[]> {
    return StorageManager.load<CustomMenuItem[]>(
      STORAGE_KEYS.CUSTOM_MENU_ITEMS,
      []
    );
  }

  static async saveCustomMenuItems(items: CustomMenuItem[]): Promise<void> {
    return StorageManager.save(STORAGE_KEYS.CUSTOM_MENU_ITEMS, items);
  }

  static async addCustomMenuItem(item: CustomMenuItem): Promise<void> {
    try {
      const items = await CustomMenuManager.getCustomMenuItems();
      items.push(item);
      await CustomMenuManager.saveCustomMenuItems(items);
      log.info(`Added new custom menu item ID ${item.id}: ${item.name}`);
    } catch (error) {
      log.error(`Error adding custom menu item:`, error);
      throw error;
    }
  }

  static async updateCustomMenuItem(
    updatedItem: CustomMenuItem
  ): Promise<void> {
    try {
      const items = await CustomMenuManager.getCustomMenuItems();
      const index = items.findIndex((item) => item.id === updatedItem.id);

      if (index >= 0) {
        items[index] = updatedItem;
        await CustomMenuManager.saveCustomMenuItems(items);
        log.info(`Updated custom menu item ID ${updatedItem.id}`);
      } else {
        log.info(`Custom menu item ID ${updatedItem.id} not found for update`);
      }
    } catch (error) {
      log.error(`Error updating custom menu item:`, error);
      throw error;
    }
  }

  // Supprimer un article personnalisé
  static async deleteCustomMenuItem(itemId: number): Promise<void> {
    try {
      const items = await CustomMenuManager.getCustomMenuItems();
      const updatedItems = items.filter((item) => item.id !== itemId);

      if (items.length !== updatedItems.length) {
        await CustomMenuManager.saveCustomMenuItems(updatedItems);
        log.info(`Deleted custom menu item ID ${itemId}`);
      } else {
        log.info(`Custom menu item ID ${itemId} not found for deletion`);
      }
    } catch (error) {
      log.error(`Error deleting custom menu item ${itemId}:`, error);
      throw error;
    }
  }
}

// Exporter les classes de gestion pour utilisation dans l'application
export {
  StorageManager,
  TableManager,
  BillManager,
  MenuManager,
  CustomMenuManager,
};

// Pour maintenir la compatibilité avec le code existant, réexporter les fonctions
// avec les mêmes noms que dans l'ancien système
export const initializeTables = TableManager.initializeTables;
export const getTables = TableManager.getTables;
export const saveTables = TableManager.saveTables;
export const getTable = TableManager.getTable;
export const updateTable = TableManager.updateTable;
export const resetTable = TableManager.resetTable;
export const resetAllTables = TableManager.resetAllTables;
export const getBills = BillManager.getBills;
export const saveBills = BillManager.saveBills;
export const addBill = BillManager.addBill;
export const getMenuAvailability = MenuManager.getMenuAvailability;
export const saveMenuAvailability = MenuManager.saveMenuAvailability;
export const getCustomMenuItems = CustomMenuManager.getCustomMenuItems;
export const saveCustomMenuItems = CustomMenuManager.saveCustomMenuItems;
export const addCustomMenuItem = CustomMenuManager.addCustomMenuItem;
export const updateCustomMenuItem = CustomMenuManager.updateCustomMenuItem;
export const deleteCustomMenuItem = CustomMenuManager.deleteCustomMenuItem;
