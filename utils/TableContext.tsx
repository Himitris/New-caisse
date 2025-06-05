// utils/TableContext.tsx
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import { getTables, getTable, Table, updateTable, saveTables } from './storage';

interface TableContextType {
  tables: Table[];
  isLoading: boolean;
  refreshTables: () => Promise<void>;
  saveTablesData: (tables: Table[]) => Promise<void>;
}

const TableContext = createContext<TableContextType | undefined>(undefined);

interface CacheEntry {
  table: Table;
  timestamp: number;
  dirty: boolean; // ✅ Marqueur pour les données modifiées
}

let tableCache = new Map<number, CacheEntry>();
let pendingWrites = new Map<number, Table>(); // ✅ Queue d'écriture groupée
let writeTimeout: ReturnType<typeof setTimeout> | null = null;


export const TableProvider = ({ children }: { children: ReactNode }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshTables = useCallback(async () => {
    setIsLoading(true);
    try {
      const loadedTables = await getTables();
      setTables(loadedTables);
    } catch (error) {
      console.error('Error loading tables:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveTablesData = useCallback(async (tablesToSave: Table[]) => {
    try {
      await saveTables(tablesToSave);
      setTables(tablesToSave);
    } catch (error) {
      console.error('Error saving tables:', error);
      throw error;
    }
  }, []);

  // Chargement initial
  React.useEffect(() => {
    refreshTables();
  }, [refreshTables]);

  const value = {
    tables,
    isLoading,
    refreshTables,
    saveTablesData,
  };

  return (
    <TableContext.Provider value={value}>{children}</TableContext.Provider>
  );
};

export const useTableContext = () => {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error('useTableContext must be used within a TableProvider');
  }
  return context;
};