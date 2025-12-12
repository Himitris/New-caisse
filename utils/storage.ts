// utils/storage.ts - VERSION OPTIMISÉE AVEC CACHE
// Intègre le système de cache intelligent pour une meilleure performance

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BillsCache, BillsStatistics } from './BillsCache';

// Types (inchangés)
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
  menuId?: number;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  offered?: boolean;
  type?: 'resto' | 'boisson';
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
  offeredAmount?: number;
  guests?: number;
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
  BUIS: 'Buis',
} as const;

const STORAGE_KEYS = {
  TABLES: 'manjo_carn_tables',
  BILLS: 'manjo_carn_bills',
  MENU_AVAILABILITY: 'manjo_carn_menu_availability',
  CUSTOM_MENU_ITEMS: 'manjo_carn_custom_menu_items',
} as const;

const MAX_BILLS = 1000;

// Fonctions utilitaires simplifiées
const save = async (key: string, data: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving ${key}:`, error);
    throw error;
  }
};

const load = async <T>(key: string, defaultValue: T): Promise<T> => {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error(`Error loading ${key}:`, error);
    return defaultValue;
  }
};

// Tables par défaut (inchangées)
export const defaultTables: Table[] = [
  // Tables EAU
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

  // Tables BUIS
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

// TABLES - Fonctions simplifiées
export const initializeTables = async (): Promise<void> => {
  const existingTables = await load<Table[]>(STORAGE_KEYS.TABLES, []);
  if (existingTables.length === 0) {
    await save(STORAGE_KEYS.TABLES, defaultTables);
  }
};

export const getTables = async (): Promise<Table[]> => {
  return load<Table[]>(STORAGE_KEYS.TABLES, defaultTables);
};

export const getTable = async (id: number): Promise<Table | null> => {
  const tables = await getTables();
  return tables.find((table) => table.id === id) || null;
};

export const updateTable = async (updatedTable: Table): Promise<void> => {
  const tables = await getTables();
  const index = tables.findIndex((table) => table.id === updatedTable.id);
  if (index >= 0) {
    tables[index] = updatedTable;
    await save(STORAGE_KEYS.TABLES, tables);
  }
};

export const resetTable = async (tableId: number): Promise<void> => {
  const tables = await getTables();
  const index = tables.findIndex((table) => table.id === tableId);
  if (index >= 0) {
    const defaultTable = defaultTables.find((t) => t.id === tableId);
    if (defaultTable) {
      tables[index] = {
        ...defaultTable,
        name: tables[index].name,
        section: tables[index].section,
      };
      await save(STORAGE_KEYS.TABLES, tables);
    }
  }
};

export const resetAllTables = async (): Promise<void> => {
  const currentTables = await getTables();
  const resetTables = defaultTables.map((defaultTable) => {
    const existing = currentTables.find((t) => t.id === defaultTable.id);
    return {
      ...defaultTable,
      name: existing?.name || defaultTable.name,
      section: existing?.section || defaultTable.section,
    };
  });
  await save(STORAGE_KEYS.TABLES, resetTables);
};

export const saveTables = async (tables: Table[]): Promise<void> => {
  await save(STORAGE_KEYS.TABLES, tables);
};

// BILLS - Fonctions optimisées avec cache
export const getBills = async (): Promise<Bill[]> => {
  try {
    return await BillsCache.getAllBills();
  } catch (error) {
    console.error('Error loading bills:', error);
    return [];
  }
};

// Obtenir les factures récentes (optimisé)
export const getRecentBills = async (limit: number = 200): Promise<Bill[]> => {
  try {
    return await BillsCache.getRecentBills(limit);
  } catch (error) {
    console.error('Error loading recent bills:', error);
    return [];
  }
};

// Obtenir le nombre total de factures (très rapide)
export const getBillsCount = async (): Promise<number> => {
  try {
    return await BillsCache.getTotalCount();
  } catch (error) {
    console.error('Error getting bills count:', error);
    return 0;
  }
};

export const addBill = async (bill: Bill): Promise<void> => {
  try {
    // Utilise le cache avec mise à jour incrémentale
    await BillsCache.addBill(bill);
  } catch (error) {
    console.error('Error adding bill:', error);
    throw error;
  }
};

export const saveBills = async (bills: Bill[]): Promise<void> => {
  // Remplace toutes les factures dans le cache
  await BillsCache.setBills(bills);
};

// Maintenance simplifiée
export const performBillsMaintenance = async (): Promise<void> => {
  try {
    const bills = await getBills();
    // Validation simple
    const validBills = bills.filter(
      (bill) => bill.id && bill.tableNumber && bill.amount !== undefined && bill.timestamp
    );
    
    if (validBills.length !== bills.length) {
      await saveBills(validBills);
    }
  } catch (error) {
    console.error('Erreur lors de la maintenance des factures:', error);
  }
};

// Pagination optimisée (utilise l'index du cache)
export const getBillsPage = async (page: number = 0, pageSize: number = 20) => {
  return await BillsCache.getBillsPage(page, pageSize);
};

// Filtrage optimisé (utilise les index du cache)
export const getFilteredBills = async (filters: {
  searchText?: string;
  dateRange?: { start: Date; end: Date };
  paymentMethod?: string;
  date?: Date;
  section?: string;
}) => {
  return await BillsCache.getFilteredBills(filters);
};

// Obtenir les factures d'une journée spécifique (très optimisé)
export const getBillsForDate = async (date: Date): Promise<Bill[]> => {
  return await BillsCache.getBillsForDate(date);
};

// Statistiques optimisées (calculées en une seule passe)
export const getBillsStatistics = async () => {
  const stats = await BillsCache.getStatistics();

  return {
    totalBills: stats.totalBills,
    totalAmount: stats.totalAmount,
    averageAmount: stats.averageAmount,
    oldestBill: stats.oldestBillTimestamp,
    newestBill: stats.newestBillTimestamp,
    billsToday: stats.billsToday || 0,
    billsThisWeek: stats.billsThisWeek || 0,
    billsThisMonth: stats.billsThisMonth || 0,
    amountToday: stats.amountToday || 0,
    amountThisWeek: stats.amountThisWeek || 0,
    amountThisMonth: stats.amountThisMonth || 0,
  };
};

// MENU - Fonctions inchangées mais sans logs
export const getMenuAvailability = async (): Promise<MenuItemAvailability[]> => {
  return load<MenuItemAvailability[]>(STORAGE_KEYS.MENU_AVAILABILITY, []);
};

export const saveMenuAvailability = async (items: MenuItemAvailability[]): Promise<void> => {
  await save(STORAGE_KEYS.MENU_AVAILABILITY, items);
};

export const getCustomMenuItems = async (): Promise<CustomMenuItem[]> => {
  return load<CustomMenuItem[]>(STORAGE_KEYS.CUSTOM_MENU_ITEMS, []);
};

export const saveCustomMenuItems = async (items: CustomMenuItem[]): Promise<void> => {
  await save(STORAGE_KEYS.CUSTOM_MENU_ITEMS, items);
};

export const addCustomMenuItem = async (item: CustomMenuItem): Promise<void> => {
  const items = await getCustomMenuItems();
  items.push(item);
  await saveCustomMenuItems(items);
};

export const updateCustomMenuItem = async (updatedItem: CustomMenuItem): Promise<void> => {
  const items = await getCustomMenuItems();
  const index = items.findIndex((item) => item.id === updatedItem.id);
  if (index >= 0) {
    items[index] = updatedItem;
    await saveCustomMenuItems(items);
  }
};

export const deleteCustomMenuItem = async (itemId: number): Promise<void> => {
  const items = await getCustomMenuItems();
  const filtered = items.filter((item) => item.id !== itemId);
  await saveCustomMenuItems(filtered);
};

// Classes de compatibilité simplifiées
export class StorageManager {
  static async isFirstLaunch(): Promise<boolean> {
    const value = await AsyncStorage.getItem('manjo_carn_first_launch');
    return value === null;
  }

  static async markAppLaunched(): Promise<void> {
    await AsyncStorage.setItem('manjo_carn_first_launch', 'false');
  }

  static async performMaintenance(): Promise<void> {
    await performBillsMaintenance();
  }

  static async resetApplicationData(): Promise<void> {
    try {
      await saveMenuAvailability([]);
      await resetAllTables();
    } catch (error) {
      console.error('Error resetting application data:', error);
    }
  }

  static async getStorageStats() {
    const bills = await getBills();
    
    let health: 'excellent' | 'good' | 'growing' = 'excellent';
    if (bills.length > 1000) health = 'good';
    if (bills.length > 5000) health = 'growing';

    return {
      billsCount: bills.length,
      lastAccess: new Date().toISOString(),
      storageHealth: health,
      protectionStatus: 'active',
    };
  }
}

export class TableManager {
  static async getTables(): Promise<Table[]> {
    return getTables();
  }

  static async saveTables(tables: Table[]): Promise<void> {
    await saveTables(tables);
  }

  static async cleanupOrphanedTableData(): Promise<void> {
    // Fonction vide maintenue pour compatibilité
  }
}

export class BillManager {
  static async getBillsStatistics() {
    return getBillsStatistics();
  }

  static async getProtectionStatus() {
    // Utilise getTotalCount qui est O(1) avec le cache
    const totalBills = await getBillsCount();
    return {
      totalBills,
      protectionActive: true,
      message: `${totalBills} factures protégées`,
    };
  }

  static async validateBillsIntegrity() {
    const bills = await getBills();
    const issues: string[] = [];

    let validCount = 0;
    bills.forEach((bill, index) => {
      if (!bill.id) issues.push(`Facture ${index}: ID manquant`);
      if (!bill.tableNumber) issues.push(`Facture ${index}: numéro de table manquant`);
      if (bill.amount === undefined) issues.push(`Facture ${index}: montant manquant`);
      if (!bill.timestamp) issues.push(`Facture ${index}: timestamp manquant`);

      if (bill.id && bill.tableNumber && bill.amount !== undefined && bill.timestamp) {
        validCount++;
      }
    });

    return {
      totalBills: bills.length,
      validBills: validCount,
      issues,
    };
  }

  static async clearAllBills(): Promise<void> {
    try {
      // Utilise le cache pour une suppression optimisée
      await BillsCache.clearAllBills();
    } catch (error) {
      console.error('Erreur lors de la suppression de toutes les factures:', error);
      throw error;
    }
  }

  static async deleteBills(billsToDelete: number[]): Promise<void> {
    try {
      // Utilise la suppression par lot du cache
      await BillsCache.deleteBills(billsToDelete);
    } catch (error) {
      console.error('Erreur lors de la suppression des factures spécifiques:', error);
      throw error;
    }
  }

  static async deleteBill(billId: number): Promise<void> {
    try {
      await BillsCache.deleteBill(billId);
    } catch (error) {
      console.error('Erreur lors de la suppression de la facture:', error);
      throw error;
    }
  }

  static async clearFilteredBills(filters: {
    searchText?: string;
    dateRange?: { start: Date; end: Date };
    paymentMethod?: string;
  }): Promise<number> {
    try {
      // Utilise le filtrage optimisé du cache
      const billsToDelete = await getFilteredBills(filters);
      const billIds = billsToDelete.map((bill) => bill.id).filter((id) => id !== undefined);

      if (billIds.length > 0) {
        await BillsCache.deleteBills(billIds);
      }

      return billIds.length;
    } catch (error) {
      console.error('Erreur lors de la suppression des factures filtrées:', error);
      throw error;
    }
  }
}

// Export du BillsCache pour un usage direct si nécessaire
export { BillsCache } from './BillsCache';