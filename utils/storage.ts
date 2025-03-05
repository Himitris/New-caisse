// utils/storage.ts - Version optimisée avec système de stockage structuré

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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
  paymentMethod?: 'card' | 'cash';
}

export interface MenuItemAvailability {
  id: number;
  available: boolean;
  name: string;
  price: number;
}

// Constantes
export const TABLE_SECTIONS = {
  EAU: 'Eau',
  BUIS: 'Buis'
};

// Clés pour AsyncStorage - utiliser un préfixe commun pour faciliter la gestion
const STORAGE_PREFIX = 'manjo_carn_';
const STORAGE_KEYS = {
  TABLES: `${STORAGE_PREFIX}tables_v3`,
  BILLS: `${STORAGE_PREFIX}bills`,
  MENU_AVAILABILITY: `${STORAGE_PREFIX}menu_availability`,
  FIRST_LAUNCH: `${STORAGE_PREFIX}first_launch_v3`,
  APP_VERSION: `${STORAGE_PREFIX}app_version`,
  LAST_SYNC: `${STORAGE_PREFIX}last_sync`,
};

// Version de l'application pour la gestion des migrations
const CURRENT_APP_VERSION = '1.0.0';

// Fonction améliorée de log avec horodatage
const log = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const platform = Platform.OS;
  console.log(`[${timestamp}][${platform}] ${message}`, data || '');
};

// Classe utilitaire pour gérer le stockage
class StorageManager {
  // Méthode générique pour sauvegarder des données
  static async save<T>(key: string, data: T): Promise<void> {
    try {
      const jsonValue = JSON.stringify(data);
      await AsyncStorage.setItem(key, jsonValue);
      log(`Saved data to ${key}`);
    } catch (error) {
      log(`Error saving data to ${key}:`, error);
      throw error;
    }
  }

  // Méthode générique pour charger des données
  static async load<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      if (jsonValue === null) {
        log(`No data found for ${key}, using default value`);
        return defaultValue;
      }
      return JSON.parse(jsonValue) as T;
    } catch (error) {
      log(`Error loading data from ${key}:`, error);
      return defaultValue;
    }
  }

  // Méthode pour vérifier si c'est le premier lancement
  static async isFirstLaunch(): Promise<boolean> {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_LAUNCH);
    return value === null || value === 'true';
  }

  // Méthode pour marquer que l'application a été lancée
  static async markAppLaunched(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.FIRST_LAUNCH, 'false');
    await AsyncStorage.setItem(STORAGE_KEYS.APP_VERSION, CURRENT_APP_VERSION);
  }

  // Méthode pour vérifier si une migration est nécessaire
  static async checkForMigrations(): Promise<boolean> {
    const storedVersion = await AsyncStorage.getItem(STORAGE_KEYS.APP_VERSION);
    return storedVersion !== CURRENT_APP_VERSION;
  }

  // Méthode pour nettoyer le stockage (utile pour le débogage ou reset complet)
  static async clearAllData(): Promise<void> {
    try {
      // Récupération de toutes les clés commençant par le préfixe
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(key => key.startsWith(STORAGE_PREFIX));
      await AsyncStorage.multiRemove(keysToRemove);
      log(`Cleared ${keysToRemove.length} storage keys`);
    } catch (error) {
      log('Error clearing data:', error);
      throw error;
    }
  }
}

// Données par défaut pour les tables
export const defaultTables: Table[] = [
  // EAU Section
  { id: 1, name: 'Doc 1', section: TABLE_SECTIONS.EAU, status: 'available', seats: 4 },
  { id: 2, name: 'Doc 2', section: TABLE_SECTIONS.EAU, status: 'available', seats: 4 },
  { id: 3, name: 'Doc 3', section: TABLE_SECTIONS.EAU, status: 'available', seats: 4 },
  { id: 4, name: 'Vue 1', section: TABLE_SECTIONS.EAU, status: 'available', seats: 4 },
  { id: 5, name: 'Vue 2', section: TABLE_SECTIONS.EAU, status: 'available', seats: 4 },
  { id: 6, name: 'R1', section: TABLE_SECTIONS.EAU, status: 'available', seats: 2 },
  { id: 7, name: 'R2', section: TABLE_SECTIONS.EAU, status: 'available', seats: 2 },
  { id: 8, name: 'R3', section: TABLE_SECTIONS.EAU, status: 'available', seats: 2 },
  { id: 9, name: 'R4', section: TABLE_SECTIONS.EAU, status: 'available', seats: 2 },
  { id: 10, name: 'Poteau', section: TABLE_SECTIONS.EAU, status: 'available', seats: 4 },
  { id: 11, name: 'Ext 1', section: TABLE_SECTIONS.EAU, status: 'available', seats: 4 },
  { id: 12, name: 'Ext 2', section: TABLE_SECTIONS.EAU, status: 'available', seats: 4 },
  { id: 13, name: 'Ext Rge', section: TABLE_SECTIONS.EAU, status: 'available', seats: 6 },

  // BUIS Section
  { id: 14, name: 'Bas 0', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 15, name: 'Bas 1', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 16, name: 'Arbre 1', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 17, name: 'Arbre 2', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 18, name: 'Tronc', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 2 },
  { id: 19, name: 'Caillou', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 2 },
  { id: 20, name: 'Escalier 1', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 21, name: 'Escalier 2', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 22, name: 'Transfo', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 6 },
  { id: 23, name: 'Bache 1', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 24, name: 'Bache 2', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 25, name: 'Bache 3', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 26, name: 'Che 1', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 27, name: 'Che 2', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 28, name: 'PDC 1', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 29, name: 'PDC 2', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 30, name: 'Eve Rgb', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 6 },
  { id: 31, name: 'Eve Bois', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 6 },
  { id: 32, name: 'HDB', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 33, name: 'Lukas 1', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 34, name: 'Lukas 2', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 35, name: 'Route 1', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 36, name: 'Route 2', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 37, name: 'Sous Cabane', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 6 },
];

// Classe de gestion des tables
class TableManager {
  // Initialiser les tables
  static async initializeTables(): Promise<Table[]> {
    try {
      log('Initializing tables with default data');
      await StorageManager.save(STORAGE_KEYS.TABLES, defaultTables);
      await StorageManager.markAppLaunched();
      return defaultTables;
    } catch (error) {
      log('Error initializing tables:', error);
      return defaultTables;
    }
  }

  // Obtenir toutes les tables
  static async getTables(): Promise<Table[]> {
    try {
      // Récupérer les tables depuis AsyncStorage
      let tables = await StorageManager.load<Table[]>(STORAGE_KEYS.TABLES, []);

      // Si aucune table n'est trouvée, initialiser avec les valeurs par défaut
      if (tables.length === 0) {
        log('No tables found, initializing with defaults');
        return await TableManager.initializeTables();
      }

      // Vérifier la validité des tables et corriger si nécessaire
      const needsCorrection = tables.some(table => !table.section);
      if (needsCorrection) {
        log('Found tables with missing section, correcting...');
        tables = tables.map(table => {
          if (!table.section) {
            const defaultTable = defaultTables.find(t => t.id === table.id);
            return {
              ...table,
              section: defaultTable?.section || TABLE_SECTIONS.EAU
            };
          }
          return table;
        });
        await StorageManager.save(STORAGE_KEYS.TABLES, tables);
      }

      // Vérifier que toutes les sections sont représentées
      const eauTables = tables.filter(t => t.section === TABLE_SECTIONS.EAU);
      const buisTables = tables.filter(t => t.section === TABLE_SECTIONS.BUIS);

      if (eauTables.length === 0 || buisTables.length === 0) {
        log('Missing tables in one or both sections, reinitializing...');
        return await TableManager.initializeTables();
      }

      return tables;
    } catch (error) {
      log('Error retrieving tables:', error);
      // En cas d'erreur, renvoyer les tables par défaut
      return defaultTables;
    }
  }

  // Sauvegarder les tables
  static async saveTables(tables: Table[]): Promise<void> {
    return StorageManager.save(STORAGE_KEYS.TABLES, tables);
  }

  // Obtenir une table spécifique
  static async getTable(id: number): Promise<Table | null> {
    const tables = await TableManager.getTables();
    return tables.find(table => table.id === id) || null;
  }

  // Mettre à jour une table spécifique
  static async updateTable(updatedTable: Table): Promise<void> {
    const tables = await TableManager.getTables();
    const updatedTables = tables.map(table =>
      table.id === updatedTable.id ? updatedTable : table
    );
    await TableManager.saveTables(updatedTables);
  }

  // Réinitialiser une table à l'état disponible
  static async resetTable(tableId: number): Promise<void> {
    const tables = await TableManager.getTables();
    const updatedTables = tables.map(table =>
      table.id === tableId
        ? {
            ...table,
            status: 'available' as const,
            guests: undefined,
            order: undefined
          }
        : table
    );
    await TableManager.saveTables(updatedTables);
  }

  // Réinitialiser toutes les tables
  static async resetAllTables(): Promise<void> {
    await TableManager.initializeTables();
    log('All tables have been reset to default state');
  }
}

// Classe de gestion des factures
class BillManager {
  // Obtenir toutes les factures
  static async getBills(): Promise<Bill[]> {
    return StorageManager.load<Bill[]>(STORAGE_KEYS.BILLS, []);
  }

  // Sauvegarder les factures
  static async saveBills(bills: Bill[]): Promise<void> {
    return StorageManager.save(STORAGE_KEYS.BILLS, bills);
  }

  // Ajouter une nouvelle facture
  static async addBill(bill: Bill): Promise<void> {
    const bills = await BillManager.getBills();
    bills.push(bill);
    await BillManager.saveBills(bills);
    log(`Added new bill ID ${bill.id} for table ${bill.tableNumber}`);
  }

  // Supprimer une facture
  static async deleteBill(billId: number): Promise<void> {
    const bills = await BillManager.getBills();
    const updatedBills = bills.filter(bill => bill.id !== billId);
    
    if (bills.length !== updatedBills.length) {
      await BillManager.saveBills(updatedBills);
      log(`Deleted bill ID ${billId}`);
    } else {
      log(`Bill ID ${billId} not found for deletion`);
    }
  }

  // Obtenir les factures pour une table spécifique
  static async getBillsForTable(tableId: number): Promise<Bill[]> {
    const bills = await BillManager.getBills();
    return bills.filter(bill => bill.tableNumber === tableId);
  }

  // Obtenir les factures par date
  static async getBillsByDate(date: Date): Promise<Bill[]> {
    const bills = await BillManager.getBills();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return bills.filter(bill => {
      const billDate = new Date(bill.timestamp);
      return billDate >= startOfDay && billDate <= endOfDay;
    });
  }
}

// Classe de gestion de la disponibilité des articles du menu
class MenuManager {
  // Obtenir la disponibilité des articles
  static async getMenuAvailability(): Promise<MenuItemAvailability[]> {
    return StorageManager.load<MenuItemAvailability[]>(STORAGE_KEYS.MENU_AVAILABILITY, []);
  }

  // Sauvegarder la disponibilité des articles
  static async saveMenuAvailability(items: MenuItemAvailability[]): Promise<void> {
    // Valider les données avant sauvegarde
    const validItems = items.filter(item =>
      typeof item.id === 'number' &&
      typeof item.available === 'boolean' &&
      typeof item.name === 'string' &&
      typeof item.price === 'number'
    );

    if (validItems.length > 0) {
      await StorageManager.save(STORAGE_KEYS.MENU_AVAILABILITY, validItems);
      log(`Saved availability status for ${validItems.length} menu items`);
    } else {
      log('No valid menu items to save');
    }
  }

  // Mettre à jour la disponibilité d'un article spécifique
  static async updateItemAvailability(itemId: number, available: boolean): Promise<void> {
    const items = await MenuManager.getMenuAvailability();
    const existingItemIndex = items.findIndex(item => item.id === itemId);
    
    if (existingItemIndex >= 0) {
      // Mettre à jour l'article existant
      items[existingItemIndex].available = available;
    } else {
      // L'article n'existe pas dans la liste - impossible de mettre à jour
      log(`Cannot update availability for item ${itemId} - not found in availability list`);
      return;
    }
    
    await MenuManager.saveMenuAvailability(items);
    log(`Updated availability of item ${itemId} to ${available}`);
  }
}

// Exporter les classes de gestion pour utilisation dans l'application
export {
  StorageManager,
  TableManager,
  BillManager,
  MenuManager,
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