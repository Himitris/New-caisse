import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Table {
  id: number;
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

// Default tables data
const defaultTables: Table[] = [
  { id: 1, status: 'available', seats: 4 },
  { id: 2, status: 'available', seats: 6 },
  { id: 3, status: 'available', seats: 2 },
  { id: 4, status: 'available', seats: 8 },
  { id: 5, status: 'available', seats: 4 },
  { id: 6, status: 'available', seats: 4 },
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

// Reset a table to available status
export const resetTable = async (tableId: number): Promise<void> => {
  try {
    const tables = await getTables();
    const updatedTables = tables.map(table => 
      table.id === tableId 
        ? { ...table, status: 'available' as const, guests: undefined, order: undefined } 
        : table
    );
    await saveTables(updatedTables);
  } catch (error) {
    console.error('Error resetting table:', error);
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

// Reset all tables (for testing)
export const resetAllTables = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(defaultTables));
  } catch (error) {
    console.error('Error resetting tables:', error);
  }
};