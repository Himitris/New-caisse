// utils/storage.ts

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
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  offered?: boolean;
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

// ✅ Constantes OPTIMISÉES
export const TABLE_SECTIONS = {
  EAU: 'Eau',
  BUIS: 'Buis',
} as const;

const STORAGE_KEYS = {
  TABLES: 'manjo_carn_tables',
  BILLS: 'manjo_carn_bills',
  MENU_AVAILABILITY: 'manjo_carn_menu_availability',
  CUSTOM_MENU_ITEMS: 'manjo_carn_custom_menu_items',
  CLEANUP_METADATA: 'manjo_carn_cleanup_metadata'
} as const;

// ✅ LIMITES STRICTES pour éviter l'accumulation
const MAX_BILLS_IN_STORAGE = 500; // RÉDUIT de 1000 à 500
const MAX_BILLS_PER_SESSION = 200; // Limite par session
const BILLS_RETENTION_DAYS = 15; // RÉDUIT de 30 à 15 jours
const CLEANUP_INTERVAL_HOURS = 2; // Nettoyage toutes les 2h
const FORCE_CLEANUP_THRESHOLD = 600; // Force le nettoyage à 600 bills

// ✅ Cache en mémoire avec limite stricte
const memoryCache = new Map<string, { data: any; timestamp: number; expires: number }>();
const CACHE_TTL = 30 * 1000; // 30 secondes seulement
const MAX_CACHE_ENTRIES = 10;

// ✅ Fonction de cache intelligente
const getCachedData = <T>(key: string): T | null => {
  const cached = memoryCache.get(key);
  if (!cached) return null;
  
  const now = Date.now();
  if (now > cached.expires) {
    memoryCache.delete(key);
    return null;
  }
  
  return cached.data as T;
};

const setCachedData = <T>(key: string, data: T): void => {
  const now = Date.now();
  
  // Nettoyer le cache si trop d'entrées
  if (memoryCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = Array.from(memoryCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
    memoryCache.delete(oldestKey);
  }
  
  memoryCache.set(key, {
    data,
    timestamp: now,
    expires: now + CACHE_TTL
  });
};

const clearCache = () => {
  memoryCache.clear();
  console.log('🧹 Cache mémoire vidé');
};

// ✅ Fonctions utilitaires ultra-optimisées
const save = async (key: string, data: any): Promise<void> => {
  try {
    const serialized = JSON.stringify(data);
    
    // Alerter si les données deviennent trop grosses
    if (serialized.length > 1024 * 1024) { // 1MB
      console.warn(`⚠️ Données volumineuses pour ${key}: ${(serialized.length / 1024).toFixed(1)}KB`);
    }
    
    await AsyncStorage.setItem(key, serialized);
    
    // Mettre à jour le cache
    setCachedData(key, data);
  } catch (error) {
    console.error(`Error saving ${key}:`, error);
    throw error;
  }
};

const load = async <T>(key: string, defaultValue: T): Promise<T> => {
  try {
    // Vérifier le cache d'abord
    const cached = getCachedData<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    const data = await AsyncStorage.getItem(key);
    const result = data ? JSON.parse(data) : defaultValue;
    
    // Mettre en cache
    setCachedData(key, result);
    
    return result;
  } catch (error) {
    console.error(`Error loading ${key}:`, error);
    return defaultValue;
  }
};

// ✅ Métadonnées de nettoyage
interface CleanupMetadata {
  lastCleanup: string;
  lastBillsCount: number;
  cleanupCount: number;
  lastForceCleanup: string;
}

const getCleanupMetadata = async (): Promise<CleanupMetadata> => {
  return load<CleanupMetadata>(STORAGE_KEYS.CLEANUP_METADATA, {
    lastCleanup: new Date().toISOString(),
    lastBillsCount: 0,
    cleanupCount: 0,
    lastForceCleanup: new Date().toISOString()
  });
};

const saveCleanupMetadata = async (metadata: CleanupMetadata): Promise<void> => {
  await save(STORAGE_KEYS.CLEANUP_METADATA, metadata);
};

// ✅ TABLES - Optimisées sans changement fonctionnel
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

// ✅ BILLS - SYSTÈME ULTRA-OPTIMISÉ AVEC NETTOYAGE AUTOMATIQUE

export const getBills = async (): Promise<Bill[]> => {
  return load<Bill[]>(STORAGE_KEYS.BILLS, []);
};

// ✅ Nettoyage intelligent et agressif des bills
const intelligentBillsCleanup = async (bills: Bill[]): Promise<Bill[]> => {
  const now = new Date();
  const retentionDate = new Date(now.getTime() - (BILLS_RETENTION_DAYS * 24 * 60 * 60 * 1000));
  
  // Trier par date (plus récents d'abord)
  const sortedBills = bills.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  // Stratégie de nettoyage aggressive
  let cleanedBills = sortedBills;
  
  // 1. Supprimer les factures anciennes
  cleanedBills = cleanedBills.filter(bill => 
    new Date(bill.timestamp) > retentionDate
  );
  
  // 2. Si encore trop de factures, garder seulement les plus récentes
  if (cleanedBills.length > MAX_BILLS_IN_STORAGE) {
    cleanedBills = cleanedBills.slice(0, MAX_BILLS_IN_STORAGE);
  }
  
  // 3. Supprimer les factures de test ou doublons potentiels
  const uniqueBills = new Map<string, Bill>();
  cleanedBills.forEach(bill => {
    const key = `${bill.tableNumber}-${bill.amount}-${new Date(bill.timestamp).toDateString()}`;
    if (!uniqueBills.has(key) || uniqueBills.get(key)!.timestamp < bill.timestamp) {
      uniqueBills.set(key, bill);
    }
  });
  
  const finalBills = Array.from(uniqueBills.values());
  
  if (finalBills.length !== bills.length) {
    console.log(`🧹 Nettoyage bills: ${bills.length} → ${finalBills.length} (-${bills.length - finalBills.length})`);
  }
  
  return finalBills;
};

// ✅ Fonction addBill ultra-optimisée
export const addBill = async (bill: Bill): Promise<void> => {
  try {
    const bills = await getBills();
    bills.push(bill);
    
    // Nettoyage INTELLIGENT et AUTOMATIQUE
    let cleanedBills = bills;
    
    // Nettoyage basique si on dépasse le seuil de session
    if (bills.length > MAX_BILLS_PER_SESSION) {
      cleanedBills = bills.slice(-MAX_BILLS_PER_SESSION);
      console.log(`🧹 Nettoyage session: gardé ${MAX_BILLS_PER_SESSION} dernières factures`);
    }
    
    // Nettoyage forcé si on dépasse le seuil critique
    if (bills.length > FORCE_CLEANUP_THRESHOLD) {
      console.warn(`⚠️ Seuil critique atteint (${bills.length} bills), nettoyage forcé`);
      cleanedBills = await intelligentBillsCleanup(bills);
      
      // Mettre à jour les métadonnées
      const metadata = await getCleanupMetadata();
      metadata.lastForceCleanup = new Date().toISOString();
      metadata.cleanupCount++;
      await saveCleanupMetadata(metadata);
    }
    
    await save(STORAGE_KEYS.BILLS, cleanedBills);
    
    // Vider le cache pour forcer le rechargement
    memoryCache.delete(STORAGE_KEYS.BILLS);
    
  } catch (error) {
    console.error('Error adding bill:', error);
    throw error;
  }
};

// ✅ Nettoyage périodique ULTRA-AGRESSIF
export const performPeriodicCleanup = async (): Promise<void> => {
  try {
    console.log('🧹 Démarrage nettoyage périodique ultra-agressif...');
    
    const metadata = await getCleanupMetadata();
    const now = new Date();
    const lastCleanup = new Date(metadata.lastCleanup);
    const hoursSinceLastCleanup = (now.getTime() - lastCleanup.getTime()) / (1000 * 60 * 60);
    
    // Forcer le nettoyage toutes les 2h ou si trop de factures
    const bills = await getBills();
    const shouldCleanup = hoursSinceLastCleanup >= CLEANUP_INTERVAL_HOURS || 
                         bills.length > MAX_BILLS_PER_SESSION;
    
    if (!shouldCleanup && bills.length < MAX_BILLS_PER_SESSION) {
      console.log('🧹 Nettoyage non nécessaire pour le moment');
      return;
    }
    
    // Nettoyage intelligent des bills
    const cleanedBills = await intelligentBillsCleanup(bills);
    
    if (cleanedBills.length !== bills.length) {
      await saveBills(cleanedBills);
    }
    
    // Nettoyer le cache mémoire
    clearCache();
    
    // Forcer le garbage collection si disponible
    if (global.gc) {
      try {
        global.gc();
        console.log('🧹 Garbage collection forcée');
      } catch (e) {
        // Ignorer si pas disponible
      }
    }
    
    // Mettre à jour les métadonnées
    metadata.lastCleanup = now.toISOString();
    metadata.lastBillsCount = cleanedBills.length;
    metadata.cleanupCount++;
    await saveCleanupMetadata(metadata);
    
    console.log(`🧹 Nettoyage terminé: ${bills.length} → ${cleanedBills.length} bills, cache vidé`);
    
  } catch (error) {
    console.error('Erreur lors du nettoyage périodique:', error);
  }
};

export const saveBills = async (bills: Bill[]): Promise<void> => {
  await save(STORAGE_KEYS.BILLS, bills);
};

// ✅ Pagination optimisée avec cache
export const getBillsPage = async (page: number = 0, pageSize: number = 20) => {
  const cacheKey = `bills_page_${page}_${pageSize}`;
  const cached = getCachedData<any>(cacheKey);
  
  if (cached) {
    return cached;
  }
  
  const allBills = await getBills();
  const sorted = [...allBills].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  const start = page * pageSize;
  const end = start + pageSize;
  
  const result = {
    bills: sorted.slice(start, end),
    total: sorted.length,
    hasMore: end < sorted.length,
  };
  
  setCachedData(cacheKey, result);
  return result;
};

// ✅ Filtrage optimisé avec cache
export const getFilteredBills = async (filters: {
  searchText?: string;
  dateRange?: { start: Date; end: Date };
  paymentMethod?: string;
}) => {
  const cacheKey = `filtered_bills_${JSON.stringify(filters)}`;
  const cached = getCachedData<Bill[]>(cacheKey);
  
  if (cached) {
    return cached;
  }
  
  const allBills = await getBills();
  
  const filtered = allBills.filter((bill) => {
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
  
  setCachedData(cacheKey, filtered);
  return filtered;
};

// ✅ MENU - Fonctions optimisées avec cache
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

// ✅ CLASSES DE COMPATIBILITÉ OPTIMISÉES
export class StorageManager {
  static async isFirstLaunch(): Promise<boolean> {
    const value = await AsyncStorage.getItem('manjo_carn_first_launch');
    return value === null;
  }
  
  static async markAppLaunched(): Promise<void> {
    await AsyncStorage.setItem('manjo_carn_first_launch', 'false');
  }
  
  static async performMaintenance(): Promise<void> {
    console.log('🔧 Maintenance du storage...');
    await performPeriodicCleanup();
  }
  
  static async resetApplicationData(): Promise<void> {
    try {
      await saveBills([]);
      await saveMenuAvailability([]);
      await resetAllTables();
      clearCache();
      console.log('🔄 Données de l\'application réinitialisées');
    } catch (error) {
      console.error('Error resetting application data:', error);
    }
  }
  
  // ✅ Nouvelle fonction pour obtenir les statistiques de storage
  static async getStorageStats(): Promise<{
    billsCount: number;
    cacheSize: number;
    lastCleanup: string;
    storageHealth: 'good' | 'warning' | 'critical';
  }> {
    const bills = await getBills();
    const metadata = await getCleanupMetadata();
    
    let health: 'good' | 'warning' | 'critical' = 'good';
    if (bills.length > MAX_BILLS_PER_SESSION) health = 'warning';
    if (bills.length > FORCE_CLEANUP_THRESHOLD) health = 'critical';
    
    return {
      billsCount: bills.length,
      cacheSize: memoryCache.size,
      lastCleanup: metadata.lastCleanup,
      storageHealth: health
    };
  }
}

export class TableManager {
  static async getTables(): Promise<Table[]> {
    return getTables();
  }

  // ❌ Erreur corrigée : suppression de la flèche de fonction
  static async saveTables(tables: Table[]): Promise<void> {
    await saveTables(tables);
  }

  static async cleanupOrphanedTableData(): Promise<void> {
    // Fonction vide maintenue pour compatibilité
  }
}

// ❌ Erreur corrigée : syntaxe de fonction fléchée correcte
export const saveTables = async (tables: Table[]): Promise<void> => {
  await save(STORAGE_KEYS.TABLES, tables);
};

export class BillManager {
  static async clearAllBills(): Promise<void> {
    await saveBills([]);
    clearCache();
  }

  // ✅ Nouvelle méthode pour nettoyage intelligent
  static async smartCleanup(): Promise<void> {
    const bills = await getBills();
    const cleaned = await intelligentBillsCleanup(bills);
    await saveBills(cleaned);
    clearCache();
  }
}