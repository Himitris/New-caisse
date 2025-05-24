// utils/TableContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import {
  Table,
  getTables,
  updateTable,
  getTable,
  STORAGE_KEYS,
  StorageManager,
} from './storage';
import { EVENT_TYPES, events } from './events';

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
  const [isLoadingRef, setIsLoadingRef] = useState(false); // Nouveau flag

  const loadTables = async () => {
    // Éviter les chargements multiples simultanés
    if (isLoadingRef) {
      console.log('Tables loading already in progress, skipping...');
      return;
    }

    setIsLoadingRef(true);
    setIsLoading(true);
    try {
      const loadedTables = await getTables();
      setTables(loadedTables);
    } catch (error) {
      console.error('Error loading tables:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingRef(false);
    }
  };

  // Fonction pour rafraîchir une seule table
  const refreshSingleTable = useCallback(
    async (tableId: number, source?: string) => {
      try {
        // Ajouter un log pour débugger
        console.log(
          `Refreshing table ${tableId} from source: ${source || 'unknown'}`
        );

        // Récupérer uniquement la table spécifique
        const freshTable = await getTable(tableId);

        if (freshTable) {
          // Mettre à jour seulement cette table dans le state
          setTables((prev) =>
            prev.map((table) => (table.id === tableId ? freshTable : table))
          );
          console.log(`Table ${tableId} refreshed successfully`);
        }
      } catch (error) {
        console.error(`Error refreshing single table ${tableId}:`, error);
      }
    },
    []
  );

  // Charger les tables au démarrage
  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    // Un set pour suivre les mises à jour récentes
    const recentUpdates = new Set<number>();

    const unsubscribe = events.on(
      EVENT_TYPES.TABLE_UPDATED,
      (updatedTableId: number) => {
        // Éviter les mises à jour dupliquées rapprochées
        if (recentUpdates.has(updatedTableId)) {
          console.log(`Skipping redundant update for table ${updatedTableId}`);
          return;
        }

        // Marquer cette table comme récemment mise à jour
        recentUpdates.add(updatedTableId);

        // Rafraîchir la table
        refreshSingleTable(updatedTableId, 'event');

        // Supprimer du set après un court délai
        setTimeout(() => {
          recentUpdates.delete(updatedTableId);
        }, 300);
      }
    );

    return unsubscribe;
  }, [refreshSingleTable]);

  const refreshTables = async () => {
    await loadTables();
  };

  const getTableById = (id: number) => {
    return tables.find((table) => table.id === id);
  };

  const updateTableInContext = async (updatedTable: Table) => {
    // Mettre à jour dans le stockage avec cache optimisé
    await StorageManager.save(STORAGE_KEYS.TABLES, [
      ...tables.map((t) => (t.id === updatedTable.id ? updatedTable : t)),
    ]);

    // Mettre à jour dans le context
    setTables((prev) =>
      prev.map((table) => (table.id === updatedTable.id ? updatedTable : table))
    );

    // Émettre l'événement
    events.emit(EVENT_TYPES.TABLE_UPDATED, updatedTable.id);
  };
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
