import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { EVENT_TYPES, events } from './events';
import {
  getTable,
  getTables,
  STORAGE_KEYS,
  StorageManager,
  Table
} from './storage';

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
  const [isLoadingRef, setIsLoadingRef] = useState(false);

  // ✅ CORRECTION CRITIQUE : Refs stables pour éviter re-créations
  const tablesRef = useRef<Table[]>([]);
  const refreshInProgress = useRef<Set<number>>(new Set());

  // ✅ Synchroniser le ref avec l'état
  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  const loadTables = useCallback(async () => {
    if (isLoadingRef) {
      console.log('Tables loading already in progress, skipping...');
      return;
    }

    setIsLoadingRef(true);
    setIsLoading(true);
    try {
      const loadedTables = await getTables();
      setTables(loadedTables);
      tablesRef.current = loadedTables; // ✅ Mise à jour du ref
    } catch (error) {
      console.error('Error loading tables:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingRef(false);
    }
  }, []);

  // ✅ CORRECTION CRITIQUE : Fonction stable avec ref
  const refreshSingleTableStable = useCallback(
    async (tableId: number, source?: string) => {
      try {
        // ✅ Prévenir les rafraîchissements multiples simultanés
        if (refreshInProgress.current.has(tableId)) {
          console.log(`Refresh already in progress for table ${tableId}, skipping`);
          return;
        }

        refreshInProgress.current.add(tableId);
        
        console.log(`Refreshing table ${tableId} from source: ${source || 'unknown'}`);

        const freshTable = await getTable(tableId);

        if (freshTable) {
          // ✅ Utiliser le ref pour éviter de dépendre de l'état tables
          const currentTables = tablesRef.current;
          const updatedTables = currentTables.map((table) => 
            table.id === tableId ? freshTable : table
          );
          
          setTables(updatedTables);
          tablesRef.current = updatedTables;
          
          console.log(`Table ${tableId} refreshed successfully`);
        }
      } catch (error) {
        console.error(`Error refreshing single table ${tableId}:`, error);
      } finally {
        // ✅ Toujours nettoyer le flag, même en cas d'erreur
        refreshInProgress.current.delete(tableId);
      }
    },
    [] // ✅ AUCUNE DÉPENDANCE - fonction complètement stable
  );

  // ✅ CORRECTION CRITIQUE : Event listener stable avec componentId
  useEffect(() => {
    const componentId = 'TableProvider';
    let recentUpdates = new Set<number>();

    const unsubscribe = events.on(
      EVENT_TYPES.TABLE_UPDATED,
      (updatedTableId: number) => {
        // ✅ Éviter les mises à jour dupliquées rapprochées
        if (recentUpdates.has(updatedTableId)) {
          console.log(`Skipping redundant update for table ${updatedTableId}`);
          return;
        }

        // Marquer cette table comme récemment mise à jour
        recentUpdates.add(updatedTableId);

        // Rafraîchir la table avec la fonction stable
        refreshSingleTableStable(updatedTableId, 'event');

        // Supprimer du set après un délai
        setTimeout(() => {
          recentUpdates.delete(updatedTableId);
        }, 500);
      },
      componentId // ✅ ID unique pour déduplication
    );

    // ✅ Cleanup avec nettoyage du set
    return () => {
      unsubscribe();
      recentUpdates.clear();
    };
  }, []); // ✅ AUCUNE DÉPENDANCE

  // ✅ Charger les tables au démarrage - fonction stable
  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const refreshTables = useCallback(async () => {
    await loadTables();
  }, [loadTables]);

  // ✅ CORRECTION : getTableById stable avec ref
  const getTableById = useCallback((id: number) => {
    return tablesRef.current.find((table) => table.id === id);
  }, []);

  // ✅ CORRECTION : updateTableInContext optimisé
  const updateTableInContext = useCallback(async (updatedTable: Table) => {
    try {
      // ✅ Éviter les mises à jour si déjà en cours
      if (refreshInProgress.current.has(updatedTable.id)) {
        console.log(`Update already in progress for table ${updatedTable.id}, queuing...`);
        
        // Attendre un peu et réessayer
        setTimeout(() => updateTableInContext(updatedTable), 100);
        return;
      }

      refreshInProgress.current.add(updatedTable.id);

      const currentTables = tablesRef.current;
      const updatedTables = currentTables.map((t) => 
        t.id === updatedTable.id ? updatedTable : t
      );

      // Mettre à jour dans le stockage avec cache optimisé
      await StorageManager.save(STORAGE_KEYS.TABLES, updatedTables);

      // Mettre à jour dans le context
      setTables(updatedTables);
      tablesRef.current = updatedTables;

      // ✅ Émettre l'événement avec un délai pour éviter les boucles
      setTimeout(() => {
        events.emit(EVENT_TYPES.TABLE_UPDATED, updatedTable.id);
      }, 50);

    } catch (error) {
      console.error('Error updating table in context:', error);
    } finally {
      refreshInProgress.current.delete(updatedTable.id);
    }
  }, []);

  // ✅ NOUVEAU : Debug en développement
  useEffect(() => {
    if (__DEV__) {
      const debugInterval = setInterval(() => {
        if (refreshInProgress.current.size > 0) {
          console.log('[TableContext] Refreshes in progress:', Array.from(refreshInProgress.current));
        }
      }, 5000);

      return () => clearInterval(debugInterval);
    }
  }, []);

  return (
    <TableContext.Provider
      value={{
        tables,
        isLoading,
        refreshTables,
        refreshSingleTable: refreshSingleTableStable, // ✅ Fonction stable
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