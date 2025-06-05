// utils/storage.ts - Version sécurisée sans suppression automatique

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
  CLEANUP_METADATA: 'manjo_carn_cleanup_metadata'
} as const;

// ✅ LIMITES SÉCURISÉES pour préserver toutes les données
const MAX_BILLS_IN_STORAGE = 10000; // AUGMENTÉ de 500 à 10000
const MAX_BILLS_PER_SESSION = 1000; // AUGMENTÉ de 200 à 1000  
const BILLS_RETENTION_DAYS = 365; // AUGMENTÉ de 15 à 365 jours (1 an)
const FORCE_CLEANUP_THRESHOLD = 5000; // AUGMENTÉ de 600 à 5000
const AUTO_CLEANUP_ENABLED = false; // ✅ DÉSACTIVÉ par défaut

// ✅ Cache en mémoire avec limite raisonnable
const memoryCache = new Map<string, { data: any; timestamp: number; expires: number }>();
const CACHE_TTL = 10 * 1000; // 30 secondes
const MAX_CACHE_ENTRIES = 8; // Augmenté pour plus de performance

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

  // ✅ Nettoyage plus agressif - supprimer 50% quand limite atteinte
  if (memoryCache.size >= MAX_CACHE_ENTRIES) {
    const sortedEntries = Array.from(memoryCache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );

    const toDelete = Math.ceil(sortedEntries.length / 2); // Supprimer 50%
    for (let i = 0; i < toDelete; i++) {
      memoryCache.delete(sortedEntries[i][0]);
    }
  }

  memoryCache.set(key, {
    data,
    timestamp: now,
    expires: now + CACHE_TTL,
  });
};

let cacheCleanupInterval: ReturnType<typeof setInterval> | null = null;

if (!cacheCleanupInterval) {
  cacheCleanupInterval = setInterval(() => {
    const now = Date.now();
    const keysToDelete: string[] = [];

    memoryCache.forEach((entry, key) => {
      if (now > entry.expires) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => memoryCache.delete(key));

    // ✅ Forcer un nettoyage si trop d'entrées même valides
    if (memoryCache.size > MAX_CACHE_ENTRIES) {
      const sortedEntries = Array.from(memoryCache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      );

      const excess = memoryCache.size - MAX_CACHE_ENTRIES;
      for (let i = 0; i < excess; i++) {
        memoryCache.delete(sortedEntries[i][0]);
      }
    }

    if (keysToDelete.length > 0) {
      console.log(
        `🧹 Cache nettoyé: ${keysToDelete.length} entrées, taille: ${memoryCache.size}`
      );
    }
  }, 15000); // Toutes les 15 secondes au lieu de 60
}

const clearCache = () => {
  memoryCache.clear();
  console.log('🧹 Cache mémoire vidé');
};

// ✅ Fonctions utilitaires ultra-optimisées
const save = async (key: string, data: any): Promise<void> => {
  try {
    const serialized = JSON.stringify(data);
    
    // Alerter si les données deviennent volumineuses
    if (serialized.length > 2 * 1024 * 1024) { // 2MB - seuil augmenté
      console.warn(`⚠️ Données volumineuses pour ${key}: ${(serialized.length / 1024 / 1024).toFixed(1)}MB`);
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
  autoCleanupEnabled: boolean;
}

const getCleanupMetadata = async (): Promise<CleanupMetadata> => {
  return load<CleanupMetadata>(STORAGE_KEYS.CLEANUP_METADATA, {
    lastCleanup: new Date().toISOString(),
    lastBillsCount: 0,
    cleanupCount: 0,
    lastForceCleanup: new Date().toISOString(),
    autoCleanupEnabled: AUTO_CLEANUP_ENABLED
  });
};

const saveCleanupMetadata = async (metadata: CleanupMetadata): Promise<void> => {
  await save(STORAGE_KEYS.CLEANUP_METADATA, metadata);
};

// ✅ TABLES - Inchangées
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

export const saveTables = async (tables: Table[]): Promise<void> => {
  await save(STORAGE_KEYS.TABLES, tables);
};

// ✅ BILLS - SYSTÈME SÉCURISÉ SANS SUPPRESSION AUTOMATIQUE

export const getBills = async (): Promise<Bill[]> => {
  return load<Bill[]>(STORAGE_KEYS.BILLS, []);
};

// ✅ Fonction intelligentBillsCleanup - SEULEMENT pour simulation
const intelligentBillsCleanup = async (bills: Bill[]): Promise<Bill[]> => {
  const now = new Date();
  const retentionDate = new Date(now.getTime() - (BILLS_RETENTION_DAYS * 24 * 60 * 60 * 1000));
  
  // Trier par date (plus récents d'abord)
  const sortedBills = bills.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  let cleanedBills = sortedBills;
  
  // 1. Supprimer les factures anciennes
  cleanedBills = cleanedBills.filter(bill => 
    new Date(bill.timestamp) > retentionDate
  );
  
  // 2. Si encore trop de factures, garder seulement les plus récentes
  if (cleanedBills.length > MAX_BILLS_IN_STORAGE) {
    cleanedBills = cleanedBills.slice(0, MAX_BILLS_IN_STORAGE);
  }
  
  // 3. Supprimer les doublons potentiels
  const uniqueBills = new Map<string, Bill>();
  cleanedBills.forEach(bill => {
    const key = `${bill.tableNumber}-${bill.amount}-${new Date(bill.timestamp).toDateString()}`;
    if (!uniqueBills.has(key) || uniqueBills.get(key)!.timestamp < bill.timestamp) {
      uniqueBills.set(key, bill);
    }
  });
  
  return Array.from(uniqueBills.values());
};

// ✅ Fonction addBill SÉCURISÉE - SANS suppression automatique
export const addBill = async (bill: Bill): Promise<void> => {
  try {
    const bills = await getBills();
    bills.push(bill);
    
    // ✅ SURVEILLANCE SEULEMENT - pas de suppression
    if (!AUTO_CLEANUP_ENABLED) {
      // Juste des alertes pour information
      if (bills.length > MAX_BILLS_PER_SESSION) {
        console.info(`ℹ️ Info: ${bills.length} factures en mémoire (seuil: ${MAX_BILLS_PER_SESSION})`);
      }
      
      if (bills.length > FORCE_CLEANUP_THRESHOLD) {
        console.warn(`⚠️ Attention: ${bills.length} factures en mémoire (seuil critique: ${FORCE_CLEANUP_THRESHOLD})`);
        console.warn(`💡 Conseil: Envisagez un nettoyage manuel via les paramètres`);
        
        // Simulation de nettoyage pour information
        const simulatedCleaned = await intelligentBillsCleanup(bills);
        console.info(`🔍 Simulation nettoyage: ${bills.length} → ${simulatedCleaned.length} (non appliqué)`);
      }
    }
    
    // Sauvegarder TOUTES les factures
    await save(STORAGE_KEYS.BILLS, bills);
    
    // Vider le cache pour forcer le rechargement
    memoryCache.delete(STORAGE_KEYS.BILLS);
    
  } catch (error) {
    console.error('Error adding bill:', error);
    throw error;
  }
};

// ✅ Fonction performPeriodicCleanup SÉCURISÉE - DÉSACTIVÉE
export const performPeriodicCleanup = async (): Promise<void> => {
  try {
    console.log('🧹 Maintenance périodique demandée...');
    
    if (!AUTO_CLEANUP_ENABLED) {
      console.log('ℹ️ Nettoyage automatique désactivé - données protégées');
      
      // Juste nettoyer le cache mémoire
      clearCache();
      
      // Mettre à jour les métadonnées sans supprimer de factures
      const bills = await getBills();
      const metadata = await getCleanupMetadata();
      metadata.lastCleanup = new Date().toISOString();
      metadata.lastBillsCount = bills.length;
      metadata.autoCleanupEnabled = false;
      await saveCleanupMetadata(metadata);
      
      console.log(`📊 Stats: ${bills.length} factures conservées`);
      return;
    }
    
    // Code de nettoyage automatique (inactif par défaut)
    console.log('⚠️ Nettoyage automatique activé');
    // ... reste du code de nettoyage original si AUTO_CLEANUP_ENABLED = true
    
  } catch (error) {
    console.error('Erreur lors de la maintenance périodique:', error);
  }
};

export const saveBills = async (bills: Bill[]): Promise<void> => {
  await save(STORAGE_KEYS.BILLS, bills);
};

// ✅ NOUVELLES FONCTIONS pour nettoyage MANUEL SEULEMENT
export const manualCleanupBills = async (options: {
  olderThanDays?: number;
  keepCount?: number;
  confirmCallback?: () => boolean;
}): Promise<{ removed: number; kept: number }> => {
  try {
    const bills = await getBills();
    
    // Demander confirmation si callback fourni
    if (options.confirmCallback && !options.confirmCallback()) {
      return { removed: 0, kept: bills.length };
    }
    
    let cleanedBills = [...bills];
    
    // Supprimer les factures anciennes si spécifié
    if (options.olderThanDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.olderThanDays);
      
      cleanedBills = cleanedBills.filter(bill => 
        new Date(bill.timestamp) > cutoffDate
      );
    }
    
    // Garder seulement un certain nombre si spécifié
    if (options.keepCount && cleanedBills.length > options.keepCount) {
      cleanedBills = cleanedBills
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, options.keepCount);
    }
    
    const removed = bills.length - cleanedBills.length;
    
    if (removed > 0) {
      await saveBills(cleanedBills);
      console.log(`🧹 Nettoyage manuel: ${removed} factures supprimées, ${cleanedBills.length} conservées`);
    }
    
    return { removed, kept: cleanedBills.length };
    
  } catch (error) {
    console.error('Erreur lors du nettoyage manuel:', error);
    throw error;
  }
};

// ✅ Pagination optimisée avec cache
export const getBillsPage = async (page: number = 0, pageSize: number = 20) => {
  // ✅ SANS cache - calcul direct
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

// ✅ Filtrage optimisé avec cache
export const getFilteredBills = async (filters: {
  searchText?: string;
  dateRange?: { start: Date; end: Date };
  paymentMethod?: string;
}) => {
  // ✅ SANS cache - calcul direct
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

// ✅ MENU - Fonctions inchangées
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

// ✅ CLASSES DE COMPATIBILITÉ SÉCURISÉES
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
    await performPeriodicCleanup();
  }
  
  static async resetApplicationData(): Promise<void>  {
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
  
  // ✅ Stats de storage SÉCURISÉES
  static async getStorageStats(): Promise<{
    billsCount: number;
    cacheSize: number;
    lastCleanup: string;
    storageHealth: 'good' | 'warning' | 'critical';
    autoCleanupEnabled: boolean;
  }> {
    const bills = await getBills();
    const metadata = await getCleanupMetadata();
    
    let health: 'good' | 'warning' | 'critical' = 'good';
    if (bills.length > 1000) health = 'warning';  // Seuils sécurisés
    if (bills.length > 5000) health = 'critical';
    
    return {
      billsCount: bills.length,
      cacheSize: memoryCache.size,
      lastCleanup: metadata.lastCleanup,
      storageHealth: health,
      autoCleanupEnabled: AUTO_CLEANUP_ENABLED,
    };
  }
  
  // ✅ Nettoyage manuel depuis l'interface
  static async requestManualCleanup(olderThanDays: number = 30): Promise<{ removed: number; kept: number }> {
    return manualCleanupBills({
      olderThanDays,
      confirmCallback: () => {
        console.log(`🗑️ Nettoyage manuel demandé: factures > ${olderThanDays} jours`);
        return true;
      }
    });
  }
  
  // ✅ Activer/désactiver le nettoyage automatique
  static async setAutoCleanup(enabled: boolean): Promise<void>  {
    const metadata = await getCleanupMetadata();
    metadata.autoCleanupEnabled = enabled;
    await saveCleanupMetadata(metadata);
    console.log(`🔧 Nettoyage automatique ${enabled ? 'activé' : 'désactivé'}`);
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
  static async clearAllBills(): Promise<void> {
    await saveBills([]);
    clearCache();
    console.log('🗑️ Toutes les factures supprimées manuellement');
  }

  // ✅ Ancienne méthode pour compatibilité - SÉCURISÉE
  static async smartCleanup(): Promise<void> {
    console.log('🧹 smartCleanup appelé - mode sécurisé');
    if (!AUTO_CLEANUP_ENABLED) {
      console.log('ℹ️ Nettoyage automatique désactivé - aucune facture supprimée');
      // Juste nettoyer le cache mémoire
      clearCache();
      return;
    }
    
    // Si le nettoyage automatique était activé, appeler la nouvelle méthode
    await BillManager.requestSmartCleanup();
  }

  // ✅ Nettoyage intelligent MANUEL
  static async requestSmartCleanup(maxAge: number = 90): Promise<{ removed: number; kept: number }> {
    console.log(`🧹 Nettoyage intelligent demandé: factures > ${maxAge} jours`);
    return manualCleanupBills({
      olderThanDays: maxAge,
      confirmCallback: () => true
    });
  }
  
  // ✅ Simulation de nettoyage pour prévisualiser
  static async simulateCleanup(olderThanDays: number = 30): Promise<{ wouldRemove: number; wouldKeep: number }> {
    const bills = await getBills();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const wouldKeep = bills.filter(bill => 
      new Date(bill.timestamp) > cutoffDate
    ).length;
    
    return {
      wouldRemove: bills.length - wouldKeep,
      wouldKeep
    };
  }
}