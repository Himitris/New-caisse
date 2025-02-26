import AsyncStorage from '@react-native-async-storage/async-storage';

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
}

// Keys for AsyncStorage
const TABLES_STORAGE_KEY = 'restaurant_tables';
const FIRST_LAUNCH_KEY = 'first_launch';
const BILLS_STORAGE_KEY = 'restaurant_bills';

export const TABLE_SECTIONS = {
  EAU: 'Eau',
  BUIS: 'Buis'
};

// Default tables data
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

// Check if it's the first launch and initialize tables
export const initializeTables = async (): Promise<Table[]> => {
  try {
    const isFirstLaunch = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    
    if (isFirstLaunch === null) {
      // First launch - reset all tables
      await AsyncStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(defaultTables));
      await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'false');
      return defaultTables;
    } else {
      // Not first launch - get stored tables
      const storedTables = await AsyncStorage.getItem(TABLES_STORAGE_KEY);
      if (storedTables) {
        return JSON.parse(storedTables);
      }
      // If no stored tables (shouldn't happen, but as a fallback)
      await AsyncStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(defaultTables));
      return defaultTables;
    }
  } catch (error) {
    console.error('Error initializing tables:', error);
    return defaultTables;
  }
};

// Save tables to AsyncStorage
export const saveTables = async (tables: Table[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(tables));
  } catch (error) {
    console.error('Error saving tables:', error);
  }
};

// Get a specific table by ID
export const getTable = async (id: number): Promise<Table | null> => {
  try {
    const tables = await getTables();
    return tables.find(table => table.id === id) || null;
  } catch (error) {
    console.error('Error getting table:', error);
    return null;
  }
};

// Get all tables
export const getTables = async (): Promise<Table[]> => {
  try {
    const storedTables = await AsyncStorage.getItem(TABLES_STORAGE_KEY);
    if (storedTables) {
      return JSON.parse(storedTables);
    }
    return defaultTables;
  } catch (error) {
    console.error('Error getting tables:', error);
    return defaultTables;
  }
};

// Update a specific table
export const updateTable = async (updatedTable: Table): Promise<void> => {
  try {
    const tables = await getTables();
    const updatedTables = tables.map(table => 
      table.id === updatedTable.id ? updatedTable : table
    );
    await saveTables(updatedTables);
  } catch (error) {
    console.error('Error updating table:', error);
  }
};

// Save bills to AsyncStorage
export const saveBills = async (bills: Bill[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(BILLS_STORAGE_KEY, JSON.stringify(bills));
  } catch (error) {
    console.error('Error saving bills:', error);
  }
};

// Get all bills
export const getBills = async (): Promise<Bill[]> => {
  try {
    const storedBills = await AsyncStorage.getItem(BILLS_STORAGE_KEY);
    if (storedBills) {
      return JSON.parse(storedBills);
    }
    return [];
  } catch (error) {
    console.error('Error getting bills:', error);
    return [];
  }
};

// Add a new bill
export const addBill = async (bill: Bill): Promise<void> => {
  try {
    const bills = await getBills();
    bills.push(bill);
    await saveBills(bills);
  } catch (error) {
    console.error('Error adding bill:', error);
  }
};

// Reset a table to available status
export const resetTable = async (tableId: number): Promise<void> => {
  try {
    const tables = await getTables();
    const tableToReset = tables.find(table => table.id === tableId);
    
    if (!tableToReset) return;
    
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
    console.error('Error resetting table:', error);
  }
};

// Reset all tables to their initial state
export const resetAllTables = async (): Promise<void> => {
  try {
    // Reset all tables to available but maintain their other properties
    const tables = await getTables();
    const resetTables = tables.map(table => ({
      ...table,
      status: 'available' as const,
      guests: undefined,
      order: undefined
    }));
    
    await saveTables(resetTables);
  } catch (error) {
    console.error('Error resetting all tables:', error);
  }
};