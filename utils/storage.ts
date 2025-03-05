// utils/storage.ts - Version simplifiée avec une seule approche

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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
}

export interface MenuItemAvailability {
  id: number;
  available: boolean;
  name: string; 
  price: number;
}

// Clés pour AsyncStorage
const TABLES_STORAGE_KEY = 'restaurant_tables_v3'; // Nouvelle clé pour éviter les conflits
const FIRST_LAUNCH_KEY = 'first_launch_v3';
const BILLS_STORAGE_KEY = 'restaurant_bills';
const MENU_AVAILABILITY_KEY = 'restaurant_menu_availability';

export const TABLE_SECTIONS = {
  EAU: 'Eau',
  BUIS: 'Buis'
};

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

// Fonction simple de log
const log = (message: string, data?: any) => {
  console.log(`[${Platform.OS}] ${message}`, data ? data : '');
};

// Fonction pour initialiser les tables
export const initializeTables = async (): Promise<Table[]> => {
  try {

    // Sauvegarde directe des tables par défaut
    await AsyncStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(defaultTables));
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'false');

    return defaultTables;
  } catch (error) {
    log('Error initializing tables:', error);
    // En cas d'erreur, retourner quand même les tables par défaut
    return defaultTables;
  }
};

// Fonction pour obtenir toutes les tables
export const getTables = async (): Promise<Table[]> => {
  try {

    // Récupérer les tables depuis AsyncStorage
    const jsonValue = await AsyncStorage.getItem(TABLES_STORAGE_KEY);

    // Si on trouve des tables stockées
    if (jsonValue !== null) {
      const parsedTables = JSON.parse(jsonValue);

      // Vérification que les tables sont dans un format valide
      if (Array.isArray(parsedTables) && parsedTables.length > 0) {
        // Vérifier si chaque table a une section valide
        const invalidTables = parsedTables.filter(table => !table.section);

        if (invalidTables.length > 0) {

          // Corriger les tables sans section
          const fixedTables = parsedTables.map(table => {
            if (!table.section) {
              // Trouver la section par défaut basée sur l'ID
              const defaultTable = defaultTables.find(t => t.id === table.id);
              return {
                ...table,
                section: defaultTable ? defaultTable.section : TABLE_SECTIONS.EAU // Par défaut Eau si on ne trouve pas
              };
            }
            return table;
          });

          // Sauvegarder les tables corrigées
          await AsyncStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(fixedTables));
          return fixedTables;
        }

        // Vérifier que nous avons des tables dans les deux sections
        const eauTables = parsedTables.filter(t => t.section === TABLE_SECTIONS.EAU);
        const buisTables = parsedTables.filter(t => t.section === TABLE_SECTIONS.BUIS);


        // Si nous avons des tables dans les deux sections, tout va bien
        if (eauTables.length > 0 && buisTables.length > 0) {
          return parsedTables;
        } else {
          log("Missing tables in one or both sections. Reinitializing...");
          // S'il manque des tables dans une section, on réinitialise
          return await initializeTables();
        }
      }
    }

    // Si on arrive ici, c'est qu'il n'y a pas de tables valides en stockage
    log("No valid tables found. Initializing...");
    return await initializeTables();
  } catch (error) {
    log('Error retrieving tables:', error);
    // En cas d'erreur, réinitialiser et renvoyer les tables par défaut
    try {
      return await initializeTables();
    } catch (initError) {
      log('Error initializing tables after get failure:', initError);
      return defaultTables;
    }
  }
};

// Sauvegarder les tables
export const saveTables = async (tables: Table[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(tables));
  } catch (error) {
    log('Error saving tables:', error);
    throw error;
  }
};

// Récupérer une table spécifique par ID
export const getTable = async (id: number): Promise<Table | null> => {
  try {
    const tables = await getTables();
    return tables.find(table => table.id === id) || null;
  } catch (error) {
    log(`Error getting table ${id}:`, error);
    // En cas d'erreur, chercher dans les tables par défaut
    return defaultTables.find(table => table.id === id) || null;
  }
};

// Mettre à jour une table spécifique
export const updateTable = async (updatedTable: Table): Promise<void> => {
  try {
    const tables = await getTables();
    const updatedTables = tables.map(table =>
      table.id === updatedTable.id ? updatedTable : table
    );
    await saveTables(updatedTables);
  } catch (error) {
    log(`Error updating table ${updatedTable.id}:`, error);
    throw error;
  }
};

// Sauvegarder les factures
export const saveBills = async (bills: Bill[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(BILLS_STORAGE_KEY, JSON.stringify(bills));
  } catch (error) {
    log('Error saving bills:', error);
    throw error;
  }
};

// Récupérer toutes les factures
export const getBills = async (): Promise<Bill[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(BILLS_STORAGE_KEY);
    return jsonValue !== null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    log('Error getting bills:', error);
    return [];
  }
};

// Ajouter une nouvelle facture
export const addBill = async (bill: Bill): Promise<void> => {
  try {
    const bills = await getBills();
    bills.push(bill);
    await saveBills(bills);
  } catch (error) {
    log(`Error adding bill ${bill.id}:`, error);
    throw error;
  }
};

// Réinitialiser une table à l'état disponible
export const resetTable = async (tableId: number): Promise<void> => {
  try {
    const tables = await getTables();
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

    await saveTables(updatedTables);
  } catch (error) {
    log(`Error resetting table ${tableId}:`, error);
    throw error;
  }
};

// Réinitialiser toutes les tables à leur état initial
export const resetAllTables = async (): Promise<void> => {
  try {
    await initializeTables();
  } catch (error) {
    throw error;
  }
};
export const getMenuAvailability = async (): Promise<MenuItemAvailability[]> => {
  try {
    const storedStatus = await AsyncStorage.getItem(MENU_AVAILABILITY_KEY);
    if (storedStatus) {
      return JSON.parse(storedStatus);
    }
    return [];
  } catch (error) {
    console.error('Error loading menu availability:', error);
    return [];
  }
};

// Fonction pour sauvegarder les disponibilités des articles
export const saveMenuAvailability = async (items: MenuItemAvailability[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(MENU_AVAILABILITY_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Error saving menu availability:', error);
    throw error;
  }
};