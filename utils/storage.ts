// utils/storage.ts - Version optimisée avec système de stockage structuré et persistant

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
  paymentType?: 'full' | 'split' | 'custom';
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
  CUSTOM_MENU_ITEMS: `${STORAGE_PREFIX}custom_menu_items`,
  SETTINGS_STORAGE_KEY: `${STORAGE_PREFIX}restaurant_settings`, // Ajout de cette ligne
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

  static async resetApplicationData(): Promise<void> {
    try {
      // Liste des clés à réinitialiser
      const keysToReset = [
        STORAGE_KEYS.BILLS,
        STORAGE_KEYS.MENU_AVAILABILITY,
        STORAGE_KEYS.LAST_SYNC
      ];
      
      // Supprimer les données pour chaque clé
      for (const key of keysToReset) {
        await AsyncStorage.removeItem(key);
      }
      
      log('Les données de l\'application ont été réinitialisées');
      
      // Mise à jour de la version actuelle
      await AsyncStorage.setItem(STORAGE_KEYS.APP_VERSION, CURRENT_APP_VERSION);
    } catch (error) {
      log('Erreur lors de la réinitialisation des données:', error);
      throw error;
    }
  }
  
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
  // Initialiser les tables - ne remplace que si aucune table n'existe
  static async initializeTables(): Promise<Table[]> {
    try {
      // Vérifier si des tables existent déjà
      const existingTables = await StorageManager.load<Table[]>(STORAGE_KEYS.TABLES, []);

      if (existingTables.length > 0) {
        log('Tables already exist, skipping initialization');
        return existingTables;
      }

      log('First initialization of tables with default data');
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
    try {
      const tables = await TableManager.getTables();
      return tables.find(table => table.id === id) || null;
    } catch (error) {
      log(`Error getting table ${id}:`, error);
      return null;
    }
  }

  // Mettre à jour une table spécifique
  static async updateTable(updatedTable: Table): Promise<void> {
    try {
      const tables = await TableManager.getTables();

      // Vérifier si la table existe déjà
      const existingIndex = tables.findIndex(table => table.id === updatedTable.id);

      if (existingIndex >= 0) {
        // Remplacer la table existante par la version mise à jour
        tables[existingIndex] = updatedTable;
      } else {
        // Ajouter la nouvelle table si elle n'existe pas
        tables.push(updatedTable);
      }

      // Sauvegarder toutes les tables
      await TableManager.saveTables(tables);
      log(`Updated table ${updatedTable.id} successfully`);
    } catch (error) {
      log(`Error updating table ${updatedTable.id}:`, error);
      throw error;
    }
  }

  // Réinitialiser une table à l'état disponible
  static async resetTable(tableId: number): Promise<void> {
    try {
      const tables = await TableManager.getTables();
      const tableIndex = tables.findIndex(table => table.id === tableId);

      if (tableIndex >= 0) {
        // Récupérer la configuration par défaut pour cette table
        const defaultTable = defaultTables.find(t => t.id === tableId);

        // Mettre à jour la table tout en conservant son nom et sa section d'origine
        tables[tableIndex] = {
          ...defaultTable || tables[tableIndex],
          name: tables[tableIndex].name,
          section: tables[tableIndex].section,
          status: 'available',
          guests: undefined,
          order: undefined
        };

        await TableManager.saveTables(tables);
        log(`Reset table ${tableId} to available state`);
      } else {
        log(`Table ${tableId} not found for reset`);
      }
    } catch (error) {
      log(`Error resetting table ${tableId}:`, error);
      throw error;
    }
  }

  // Réinitialiser toutes les tables à leur état initial
  static async resetAllTables(): Promise<void> {
    try {
      const currentTables = await TableManager.getTables();

      // Créer un tableau de tables réinitialisées en conservant les noms et sections personnalisés
      const resetTables = defaultTables.map(defaultTable => {
        const existingTable = currentTables.find(t => t.id === defaultTable.id);
        return {
          ...defaultTable,
          name: existingTable?.name || defaultTable.name,
          section: existingTable?.section || defaultTable.section
        };
      });

      await TableManager.saveTables(resetTables);
      log('All tables have been reset to default state');
    } catch (error) {
      log('Error resetting all tables:', error);
      throw error;
    }
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
    try {
      const bills = await BillManager.getBills();
      bills.push(bill);
      await BillManager.saveBills(bills);
      log(`Added new bill ID ${bill.id} for table ${bill.tableNumber}`);

      // Émettre un événement que la table peut écouter
      events.emit(EVENT_TYPES.PAYMENT_ADDED, bill.tableNumber, bill);
    } catch (error) {
      log(`Error adding bill:`, error);
      throw error;
    }
  }

  // Réinitialiser toutes les factures
  static async clearAllBills(): Promise<void> {
    try {
      await StorageManager.save(STORAGE_KEYS.BILLS, []);
      log('Toutes les factures ont été supprimées');
    } catch (error) {
      log('Erreur lors de la suppression des factures:', error);
      throw error;
    }
  }

  // Supprimer une facture
  static async deleteBill(billId: number): Promise<void> {
    try {
      const bills = await BillManager.getBills();
      const updatedBills = bills.filter(bill => bill.id !== billId);

      if (bills.length !== updatedBills.length) {
        await BillManager.saveBills(updatedBills);
        log(`Deleted bill ID ${billId}`);
      } else {
        log(`Bill ID ${billId} not found for deletion`);
      }
    } catch (error) {
      log(`Error deleting bill ${billId}:`, error);
      throw error;
    }
  }

  // Obtenir les factures pour une table spécifique
  static async getBillsForTable(tableId: number): Promise<Bill[]> {
    try {
      const bills = await BillManager.getBills();

      // Filtrer les factures pour la table spécifique
      const tableBills = bills.filter(bill => bill.tableNumber === tableId);

      // Trier par date, du plus récent au plus ancien
      tableBills.sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return dateB - dateA; // Ordre décroissant
      });

      return tableBills;
    } catch (error) {
      log(`Error getting bills for table ${tableId}:`, error);
      return [];
    }
  }

  // Obtenir les factures par date
  static async getBillsByDate(date: Date): Promise<Bill[]> {
    try {
      const bills = await BillManager.getBills();
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      return bills.filter(bill => {
        const billDate = new Date(bill.timestamp);
        return billDate >= startOfDay && billDate <= endOfDay;
      });
    } catch (error) {
      log(`Error getting bills by date:`, error);
      return [];
    }
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
    try {
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
    } catch (error) {
      log(`Error saving menu availability:`, error);
      throw error;
    }
  }

  // Mettre à jour la disponibilité d'un article spécifique
  static async updateItemAvailability(itemId: number, available: boolean): Promise<void> {
    try {
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
    } catch (error) {
      log(`Error updating item availability:`, error);
      throw error;
    }
  }
}

class CustomMenuManager {
  // Obtenir tous les articles personnalisés
  static async getCustomMenuItems(): Promise<CustomMenuItem[]> {
    return StorageManager.load<CustomMenuItem[]>(STORAGE_KEYS.CUSTOM_MENU_ITEMS, []);
  }

  // Sauvegarder les articles personnalisés
  static async saveCustomMenuItems(items: CustomMenuItem[]): Promise<void> {
    return StorageManager.save(STORAGE_KEYS.CUSTOM_MENU_ITEMS, items);
  }

  // Ajouter un nouvel article personnalisé
  static async addCustomMenuItem(item: CustomMenuItem): Promise<void> {
    try {
      const items = await CustomMenuManager.getCustomMenuItems();
      items.push(item);
      await CustomMenuManager.saveCustomMenuItems(items);
      log(`Added new custom menu item ID ${item.id}: ${item.name}`);
    } catch (error) {
      log(`Error adding custom menu item:`, error);
      throw error;
    }
  }

  // Mettre à jour un article personnalisé
  static async updateCustomMenuItem(updatedItem: CustomMenuItem): Promise<void> {
    try {
      const items = await CustomMenuManager.getCustomMenuItems();
      const index = items.findIndex(item => item.id === updatedItem.id);

      if (index >= 0) {
        items[index] = updatedItem;
        await CustomMenuManager.saveCustomMenuItems(items);
        log(`Updated custom menu item ID ${updatedItem.id}`);
      } else {
        log(`Custom menu item ID ${updatedItem.id} not found for update`);
      }
    } catch (error) {
      log(`Error updating custom menu item:`, error);
      throw error;
    }
  }

  // Supprimer un article personnalisé
  static async deleteCustomMenuItem(itemId: number): Promise<void> {
    try {
      const items = await CustomMenuManager.getCustomMenuItems();
      const updatedItems = items.filter(item => item.id !== itemId);

      if (items.length !== updatedItems.length) {
        await CustomMenuManager.saveCustomMenuItems(updatedItems);
        log(`Deleted custom menu item ID ${itemId}`);
      } else {
        log(`Custom menu item ID ${itemId} not found for deletion`);
      }
    } catch (error) {
      log(`Error deleting custom menu item ${itemId}:`, error);
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
  CustomMenuManager
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