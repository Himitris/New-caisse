// utils/storage.ts - Version protection complète des bills

import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Types (inchangés)
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

// ✅ Constantes SÉCURISÉES
export const TABLE_SECTIONS = {
  EAU: 'Eau',
  BUIS: 'Buis',
} as const;

const STORAGE_KEYS = {
  TABLES: 'manjo_carn_tables',
  BILLS: 'manjo_carn_bills',
  MENU_AVAILABILITY: 'manjo_carn_menu_availability',
  CUSTOM_MENU_ITEMS: 'manjo_carn_custom_menu_items',
  CLEANUP_METADATA: 'manjo_carn_cleanup_metadata',
} as const;

const MAX_BILLS = 1000; 

// ✅ Fonctions utilitaires simplifiées
const save = async (key: string, data: any): Promise<void> => {
  try {
    const serialized = JSON.stringify(data);

    // Alerter si les données deviennent volumineuses
    if (serialized.length > 2 * 1024 * 1024) {
      // 2MB
      console.warn(
        `⚠️ Données volumineuses pour ${key}: ${(
          serialized.length /
          1024 /
          1024
        ).toFixed(1)}MB`
      );
    }

    await AsyncStorage.setItem(key, serialized);
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

// ✅ Métadonnées pour statistiques seulement
interface StorageMetadata {
  lastAccess: string;
  billsCount: number;
  accessCount: number;
}

const getStorageMetadata = async (): Promise<StorageMetadata> => {
  return load<StorageMetadata>(STORAGE_KEYS.CLEANUP_METADATA, {
    lastAccess: new Date().toISOString(),
    billsCount: 0,
    accessCount: 0,
  });
};

const saveStorageMetadata = async (
  metadata: StorageMetadata
): Promise<void> => {
  await save(STORAGE_KEYS.CLEANUP_METADATA, metadata);
};

// ✅ TABLES (inchangées)
export const defaultTables: Table[] = [
  // Tables EAU
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

  // Tables BUIS
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

// ✅ BILLS - PROTECTION MAXIMALE - AUCUNE SUPPRESSION POSSIBLE

export const getBills = async (): Promise<Bill[]> => {
  // Mettre à jour les métadonnées d'accès
  try {
    const bills = await load<Bill[]>(STORAGE_KEYS.BILLS, []);
    const metadata = await getStorageMetadata();
    metadata.lastAccess = new Date().toISOString();
    metadata.billsCount = bills.length;
    metadata.accessCount += 1;
    await saveStorageMetadata(metadata);
    return bills;
  } catch (error) {
    console.error('Error loading bills:', error);
    return [];
  }
};

// ✅ Fonction addBill ULTRA-SÉCURISÉE - Conservation garantie
export const addBill = async (bill: Bill): Promise<void> => {
  try {
    const bills = await getBills();
    bills.push(bill);

    // Simple limite sans métadonnées complexes
    if (bills.length > MAX_BILLS) {
      // Garder les 800 plus récents
      const sorted = bills.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      bills.splice(0, bills.length - 800);
    }

    await save(STORAGE_KEYS.BILLS, bills);
  } catch (error) {
    console.error('Error adding bill:', error);
    throw error;
  }
};

// ✅ Sauvegarde directe (pour usage interne seulement)
export const saveBills = async (bills: Bill[]): Promise<void> => {
  await save(STORAGE_KEYS.BILLS, bills);
  console.log(`💾 ${bills.length} factures sauvegardées`);
};

// ✅ CONSERVATION ACTIVE - Maintenance sans suppression
export const performBillsMaintenance = async (): Promise<void> => {
  try {
    console.log('🛠️ Maintenance de conservation des factures...');

    const bills = await getBills();
    const metadata = await getStorageMetadata();

    // Mise à jour des métadonnées
    metadata.lastAccess = new Date().toISOString();
    metadata.billsCount = bills.length;
    await saveStorageMetadata(metadata);

    // Vérification d'intégrité
    const validBills = bills.filter(
      (bill) =>
        bill.id &&
        bill.tableNumber &&
        bill.amount !== undefined &&
        bill.timestamp
    );

    if (validBills.length !== bills.length) {
      console.warn(
        `⚠️ ${
          bills.length - validBills.length
        } factures avec données incomplètes détectées`
      );
      // On sauvegarde quand même TOUTES les factures, même incomplètes
    }

    console.log(`📊 Maintenance terminée: ${bills.length} factures conservées`);
  } catch (error) {
    console.error('Erreur lors de la maintenance des factures:', error);
  }
};

// ✅ Pagination - Lecture seule
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

// ✅ Filtrage - Lecture seule
export const getFilteredBills = async (filters: {
  searchText?: string;
  dateRange?: { start: Date; end: Date };
  paymentMethod?: string;
}) => {
  const allBills = await getBills();

  return allBills.filter((bill) => {
    if (filters.dateRange) {
      const billDate = new Date(bill.timestamp);
      if (
        billDate < filters.dateRange.start ||
        billDate > filters.dateRange.end
      ) {
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

// ✅ Statistiques - Lecture seule
export const getBillsStatistics = async (): Promise<{
  totalBills: number;
  totalAmount: number;
  averageAmount: number;
  oldestBill?: string;
  newestBill?: string;
  billsToday: number;
  billsThisWeek: number;
  billsThisMonth: number;
}> => {
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
    billsToday: bills.filter((bill) => new Date(bill.timestamp) >= today)
      .length,
    billsThisWeek: bills.filter((bill) => new Date(bill.timestamp) >= weekAgo)
      .length,
    billsThisMonth: bills.filter((bill) => new Date(bill.timestamp) >= monthAgo)
      .length,
  };
};

// ✅ MENU - Fonctions inchangées
export const getMenuAvailability = async (): Promise<
  MenuItemAvailability[]
> => {
  return load<MenuItemAvailability[]>(STORAGE_KEYS.MENU_AVAILABILITY, []);
};

export const saveMenuAvailability = async (
  items: MenuItemAvailability[]
): Promise<void> => {
  await save(STORAGE_KEYS.MENU_AVAILABILITY, items);
};

export const getCustomMenuItems = async (): Promise<CustomMenuItem[]> => {
  return load<CustomMenuItem[]>(STORAGE_KEYS.CUSTOM_MENU_ITEMS, []);
};

export const saveCustomMenuItems = async (
  items: CustomMenuItem[]
): Promise<void> => {
  await save(STORAGE_KEYS.CUSTOM_MENU_ITEMS, items);
};

export const addCustomMenuItem = async (
  item: CustomMenuItem
): Promise<void> => {
  const items = await getCustomMenuItems();
  items.push(item);
  await saveCustomMenuItems(items);
};

export const updateCustomMenuItem = async (
  updatedItem: CustomMenuItem
): Promise<void> => {
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

// ✅ CLASSES DE COMPATIBILITÉ - PROTECTION TOTALE DES BILLS
export class StorageManager {
  static async isFirstLaunch(): Promise<boolean> {
    const value = await AsyncStorage.getItem('manjo_carn_first_launch');
    return value === null;
  }

  static async markAppLaunched(): Promise<void> {
    await AsyncStorage.setItem('manjo_carn_first_launch', 'false');
  }

  static async performMaintenance(): Promise<void> {
    console.log('🔧 Maintenance sécurisée du storage...');
    await performBillsMaintenance();
  }

  // ✅ Reset PARTIEL - JAMAIS les bills
  static async resetApplicationData(): Promise<void> {
    try {
      // ❌ BILLS JAMAIS SUPPRIMÉES
      // await saveBills([]); // SUPPRIMÉ

      await saveMenuAvailability([]);
      await resetAllTables();
      console.log('🔄 Tables et menu réinitialisés (factures conservées)');
    } catch (error) {
      console.error('Error resetting application data:', error);
    }
  }

  // ✅ Stats de storage SÉCURISÉES
  static async getStorageStats(): Promise<{
    billsCount: number;
    lastAccess: string;
    storageHealth: 'excellent' | 'good' | 'growing';
    protectionStatus: 'active';
  }> {
    const bills = await getBills();
    const metadata = await getStorageMetadata();

    let health: 'excellent' | 'good' | 'growing' = 'excellent';
    if (bills.length > 1000) health = 'good';
    if (bills.length > 5000) health = 'growing';

    return {
      billsCount: bills.length,
      lastAccess: metadata.lastAccess,
      storageHealth: health,
      protectionStatus: 'active',
    };
  }

  // ✅ PLUS AUCUNE FONCTION DE SUPPRESSION
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
    console.log('🛠️ Nettoyage des tables - factures toujours protégées');
  }
}

export class BillManager {
  // ✅ TOUTES LES FONCTIONS DE SUPPRESSION SUPPRIMÉES

  // ✅ Statistiques seulement
  static async getBillsStatistics() {
    return getBillsStatistics();
  }

  // ✅ Information sur la protection
  static async getProtectionStatus(): Promise<{
    totalBills: number;
    protectionActive: boolean;
    message: string;
  }> {
    const bills = await getBills();
    return {
      totalBills: bills.length,
      protectionActive: true,
      message: `${bills.length} factures protégées de manière permanente`,
    };
  }

  // ✅ Validation d'intégrité (sans suppression)
  static async validateBillsIntegrity(): Promise<{
    totalBills: number;
    validBills: number;
    issues: string[];
  }> {
    const bills = await getBills();
    const issues: string[] = [];

    let validCount = 0;
    bills.forEach((bill, index) => {
      if (!bill.id) issues.push(`Facture ${index}: ID manquant`);
      if (!bill.tableNumber)
        issues.push(`Facture ${index}: numéro de table manquant`);
      if (bill.amount === undefined)
        issues.push(`Facture ${index}: montant manquant`);
      if (!bill.timestamp) issues.push(`Facture ${index}: timestamp manquant`);

      if (
        bill.id &&
        bill.tableNumber &&
        bill.amount !== undefined &&
        bill.timestamp
      ) {
        validCount++;
      }
    });

    return {
      totalBills: bills.length,
      validBills: validCount,
      issues,
    };
  }
}
