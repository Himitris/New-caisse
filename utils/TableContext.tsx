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
import { getTables, getTable, Table, updateTable } from './storage';

interface TableContextType {
  tables: Table[];
  isLoading: boolean;
  refreshTables: () => Promise<void>;
  updateTableData: (
    tableId: number,
    updatedData: Partial<Table>
  ) => Promise<void>;
  getTableById: (id: number) => Table | undefined;
  clearCache: () => void;
}

const TableContext = createContext<TableContextType | undefined>(undefined);

export const TableProvider = ({ children }: { children: ReactNode }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  // ✅ Chargement simple direct (INCHANGÉ)
  const loadTables = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const loadedTables = await getTables();
      if (!mountedRef.current) return;
      setTables(loadedTables);
    } catch (error) {
      console.error('Error loading tables:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const refreshTables = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsLoading(true);
    await loadTables();
  }, [loadTables]);

  // ✅ Mise à jour simple sans cache (INCHANGÉ)
  const updateTableData = useCallback(
    async (tableId: number, updatedData: Partial<Table>) => {
      if (!mountedRef.current) return;

      try {
        const currentTable = await getTable(tableId);
        if (!currentTable) return;

        const updatedTable = { ...currentTable, ...updatedData };
        await updateTable(updatedTable);

        if (mountedRef.current) {
          setTables((prevTables) =>
            prevTables.map((table) =>
              table.id === tableId ? updatedTable : table
            )
          );
        }
      } catch (error) {
        console.error(`Error updating table ${tableId}:`, error);
        throw error;
      }
    },
    []
  );

  // ✅ Getter simple sans cache (INCHANGÉ)
  const getTableById = useCallback(
    (id: number) => {
      return tables.find((table) => table.id === id);
    },
    [tables]
  );

  const clearCache = useCallback(() => {
    // Ne fait plus rien - gardé pour compatibilité (INCHANGÉ)
  }, []);

  // ✅ Chargement initial (INCHANGÉ)
  useEffect(() => {
    loadTables();
    return () => {
      mountedRef.current = false;
    };
  }, [loadTables]);

  const value = {
    tables,
    isLoading,
    refreshTables,
    updateTableData,
    getTableById,
    clearCache,
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
