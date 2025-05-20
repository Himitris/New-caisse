// utils/TableContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { Table, getTables, updateTable } from './storage';
import { EVENT_TYPES, events } from './events';

interface TableContextType {
  tables: Table[];
  isLoading: boolean;
  refreshTables: () => Promise<void>;
  getTableById: (id: number) => Table | undefined;
  updateTableInContext: (updatedTable: Table) => Promise<void>;
}

const TableContext = createContext<TableContextType | undefined>(undefined);

export const TableProvider = ({ children }: { children: ReactNode }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTables = async () => {
    setIsLoading(true);
    try {
      const loadedTables = await getTables();
      setTables(loadedTables);
    } catch (error) {
      console.error('Error loading tables:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Charger les tables au démarrage
  useEffect(() => {
    loadTables();
  }, []);

  // Écouter les événements de mise à jour
  useEffect(() => {
    const unsubscribe = events.on(
      EVENT_TYPES.TABLE_UPDATED,
      (updatedTableId: number) => {
        // Mettre à jour seulement la table spécifique sans recharger toutes les tables
        getTables().then((freshTables) => {
          const updatedTable = freshTables.find((t) => t.id === updatedTableId);
          if (updatedTable) {
            setTables((prev) =>
              prev.map((table) =>
                table.id === updatedTableId ? updatedTable : table
              )
            );
          }
        });
      }
    );

    return unsubscribe;
  }, []);

  const refreshTables = async () => {
    await loadTables();
  };

  const getTableById = (id: number) => {
    return tables.find((table) => table.id === id);
  };

  const updateTableInContext = async (updatedTable: Table) => {
    // Mettre à jour dans le stockage
    await updateTable(updatedTable);

    // Mettre à jour dans le context
    setTables((prev) =>
      prev.map((table) => (table.id === updatedTable.id ? updatedTable : table))
    );
  };

  return (
    <TableContext.Provider
      value={{
        tables,
        isLoading,
        refreshTables,
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
