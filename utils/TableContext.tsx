// utils/TableContext.tsx - Version simplifiée

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { EVENT_TYPES, events } from './events';
import { getTables, Table, updateTable } from './storage';

interface TableContextType {
  tables: Table[];
  isLoading: boolean;
  refreshTables: () => Promise<void>;
  refreshSingleTable: (tableId: number) => Promise<void>;
  getTableById: (id: number) => Table | undefined;
  updateTableInContext: (updatedTable: Table) => Promise<void>;
}

const TableContext = createContext<TableContextType | undefined>(undefined);

export const TableProvider = ({ children }: { children: ReactNode }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTables = useCallback(async () => {
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

  const refreshTables = useCallback(async () => {
    await loadTables();
  }, [loadTables]);

  const refreshSingleTable = useCallback(async (tableId: number) => {
    try {
      const allTables = await getTables();
      const updatedTable = allTables.find((t) => t.id === tableId);

      if (updatedTable) {
        setTables((prev) =>
          prev.map((t) => (t.id === tableId ? updatedTable : t))
        );
      }
    } catch (error) {
      console.error(`Error refreshing table ${tableId}:`, error);
    }
  }, []);

  const getTableById = useCallback(
    (id: number) => {
      return tables.find((table) => table.id === id);
    },
    [tables]
  );

  const updateTableInContext = useCallback(async (updatedTable: Table) => {
    try {
      await updateTable(updatedTable);
      setTables((prev) =>
        prev.map((t) => (t.id === updatedTable.id ? updatedTable : t))
      );
    } catch (error) {
      console.error('Error updating table in context:', error);
      throw error;
    }
  }, []);

  // Écouter les événements de mise à jour des tables
  useEffect(() => {
    const unsubscribeTablesUpdated = events.on(
      EVENT_TYPES.TABLES_UPDATED,
      () => {
        refreshTables();
      }
    );

    const unsubscribeTableUpdated = events.on(
      EVENT_TYPES.TABLE_UPDATED,
      (tableId: number) => {
        refreshSingleTable(tableId);
      }
    );

    return () => {
      unsubscribeTablesUpdated();
      unsubscribeTableUpdated();
    };
  }, [refreshTables, refreshSingleTable]);

  // Charger les tables au démarrage
  useEffect(() => {
    loadTables();
  }, [loadTables]);

  return (
    <TableContext.Provider
      value={{
        tables,
        isLoading,
        refreshTables,
        refreshSingleTable,
        getTableById,
        updateTableInContext,
      }}
    >
      {children}
    </TableContext.Provider>
  );
};

export const useTableContext = () => {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error('useTableContext must be used within a TableProvider');
  }
  return context;
};
