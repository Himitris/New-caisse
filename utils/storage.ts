// utils/storage.ts - VERSION SANS LOGS EXCESSIFS

import AsyncStorage from '@react-native-async-storage/async-storage';

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

// BILLS - Fonctions simplifiées
export const getBills = async (): Promise<Bill[]> => {
  try {
    return await load<Bill[]>(STORAGE_KEYS.BILLS, []);
  } catch (error) {
    console.error('Error loading bills:', error);
    return [];
  }
};

export const addBill = async (bill: Bill): Promise<void> => {
  try {
    const bills = await getBills();
    bills.push(bill);

    // Limite simple
    if (bills.length > MAX_BILLS) {
      const sorted = bills.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      bills.splice(0, bills.length - 800);
    }

    await save(STORAGE_KEYS.BILLS, bills);
  } catch (error) {
    console.error('Error adding bill:', error);
    throw error;
  }
};

export const saveBills = async (bills: Bill[]): Promise<void> => {
  await save(STORAGE_KEYS.BILLS, bills);
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

// Pagination
export const getBillsPage = async (page: number = 0, pageSize: number = 20) => {
  const allBills = await getBills();
  const sorted = [...allBills].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const start = page * pageSize;
  const end = start + pageSize;

  return {
    bills: sorted.slice(start, end),
    total: sorted.length,
    hasMore: end < sorted.length,
  };
};

// Filtrage
export const getFilteredBills = async (filters: {
  searchText?: string;
  dateRange?: { start: Date; end: Date };
  paymentMethod?: string;
}) => {
  const allBills = await getBills();

  return allBills.filter((bill) => {
    if (filters.dateRange) {
      const billDate = new Date(bill.timestamp);
      if (billDate < filters.dateRange.start || billDate > filters.dateRange.end) {
        return false;
      }
    }

    if (filters.paymentMethod && bill.paymentMethod !== filters.paymentMethod) {
      return false;
    }

    if (filters.searchText) {
      const search = filters.searchText.toLowerCase();
      const tableName = bill.tableName || `Table ${bill.tableNumber}`;
      return (
        tableName.toLowerCase().includes(search) ||
        bill.amount.toString().includes(search)
      );
    }

    return true;
  });
};

// Statistiques
export const getBillsStatistics = async () => {
  const bills = await getBills();

  if (bills.length === 0) {
    return {
      totalBills: 0,
      totalAmount: 0,
      averageAmount: 0,
      billsToday: 0,
      billsThisWeek: 0,
      billsThisMonth: 0,
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const totalAmount = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const sortedByDate = bills.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return {
    totalBills: bills.length,
    totalAmount,
    averageAmount: totalAmount / bills.length,
    oldestBill: sortedByDate[0]?.timestamp,
    newestBill: sortedByDate[sortedByDate.length - 1]?.timestamp,
    billsToday: bills.filter((bill) => new Date(bill.timestamp) >= today).length,
    billsThisWeek: bills.filter((bill) => new Date(bill.timestamp) >= weekAgo).length,
    billsThisMonth: bills.filter((bill) => new Date(bill.timestamp) >= monthAgo).length,
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
    const bills = await getBills();
    return {
      totalBills: bills.length,
      protectionActive: true,
      message: `${bills.length} factures protégées`,
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
      await saveBills([]);
    } catch (error) {
      console.error('Erreur lors de la suppression de toutes les factures:', error);
      throw error;
    }
  }

  static async deleteBills(billsToDelete: number[]): Promise<void>  {
    try {
      const allBills = await getBills();
      const billIdsSet = new Set(billsToDelete);
      const remainingBills = allBills.filter((bill) => !billIdsSet.has(bill.id));
      await saveBills(remainingBills);
    } catch (error) {
      console.error('Erreur lors de la suppression des factures spécifiques:', error);
      throw error;
    }
  }

  static async clearFilteredBills(filters: {
    searchText?: string;
    dateRange?: { start: Date; end: Date };
    paymentMethod?: string;
  }): Promise<number> {
    try {
      const allBills = await getBills();
      const billsToDelete = allBills.filter((bill) => {
        if (filters.dateRange) {
          const billDate = new Date(bill.timestamp);
          if (billDate < filters.dateRange.start || billDate > filters.dateRange.end) {
            return false;
          }
        }

        if (filters.paymentMethod && bill.paymentMethod !== filters.paymentMethod) {
          return false;
        }

        if (filters.searchText) {
          const search = filters.searchText.toLowerCase();
          const tableName = bill.tableName || `Table ${bill.tableNumber}`;
          return (
            tableName.toLowerCase().includes(search) ||
            bill.amount.toString().includes(search)
          );
        }

        return true;
      });

      const billIdsToDelete = new Set(billsToDelete.map((bill) => bill.id));
      const remainingBills = allBills.filter((bill) => !billIdsToDelete.has(bill.id));

      await saveBills(remainingBills);
      return billsToDelete.length;
    } catch (error) {
      console.error('Erreur lors de la suppression des factures filtrées:', error);
      throw error;
    }
  }
}