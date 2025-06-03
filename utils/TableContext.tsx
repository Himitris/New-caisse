// utils/TableContext.tsx - Version ultra-simplifiée sans événements

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
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
}

const TableContext = createContext<TableContextType | undefined>(undefined);

export const TableProvider = ({ children }: { children: ReactNode }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fonction simple pour charger toutes les tables
  const loadTables = useCallback(async () => {
    try {
      const loadedTables = await getTables();
      setTables(loadedTables);
    } catch (error) {
      console.error('Error loading tables:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fonction publique pour rafraîchir les tables
  const refreshTables = useCallback(async () => {
    setIsLoading(true);
    await loadTables();
  }, [loadTables]);

  // Fonction pour mettre à jour une table spécifique
  const updateTableData = useCallback(
    async (tableId: number, updatedData: Partial<Table>) => {
      try {
        // Récupérer la table actuelle depuis le storage
        const currentTable = await getTable(tableId);
        if (!currentTable) return;

        // Créer la table mise à jour
        const updatedTable = { ...currentTable, ...updatedData };

        // Sauvegarder dans le storage
        await updateTable(updatedTable);

        // Mettre à jour l'état local
        setTables((prevTables) =>
          prevTables.map((table) =>
            table.id === tableId ? updatedTable : table
          )
        );
      } catch (error) {
        console.error(`Error updating table ${tableId}:`, error);
        throw error;
      }
    },
    []
  );

  // Fonction pour obtenir une table par ID (depuis l'état local)
  const getTableById = useCallback(
    (id: number) => {
      return tables.find((table) => table.id === id);
    },
    [tables]
  );

  // Charger les tables au démarrage
  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const value = {
    tables,
    isLoading,
    refreshTables,
    updateTableData,
    getTableById,
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
