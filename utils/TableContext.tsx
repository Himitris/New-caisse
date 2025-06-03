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
  clearCache: () => void; // 🆕 Fonction de nettoyage
}

const TableContext = createContext<TableContextType | undefined>(undefined);

// Cache avec limite automatique
const MAX_CACHE_SIZE = 50; // Limite le nombre de tables en cache
let tableCache = new Map<number, Table>();

export const TableProvider = ({ children }: { children: ReactNode }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const lastCleanup = useRef(Date.now());
  const mountedRef = useRef(true);

  // Nettoyage automatique du cache toutes les 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!mountedRef.current) return;

      const now = Date.now();
      // Nettoyer le cache toutes les 5 minutes
      if (now - lastCleanup.current > 5 * 60 * 1000) {
        console.log('🧹 Nettoyage automatique du cache');
        tableCache.clear();
        lastCleanup.current = now;

        // Forcer le garbage collection si possible
        if (global.gc) {
          global.gc();
        }
      }
    }, 60000); // Vérifier chaque minute

    return () => {
      clearInterval(interval);
      mountedRef.current = false;
    };
  }, []);

  // Fonction simple pour charger toutes les tables
  const loadTables = useCallback(async () => {
    try {
      const loadedTables = await getTables();

      if (!mountedRef.current) return;

      setTables(loadedTables);

      // Mettre à jour le cache avec limite
      loadedTables.forEach((table) => {
        tableCache.set(table.id, table);
      });

      // Limiter la taille du cache
      if (tableCache.size > MAX_CACHE_SIZE) {
        const keysToDelete = Array.from(tableCache.keys()).slice(
          0,
          tableCache.size - MAX_CACHE_SIZE
        );
        keysToDelete.forEach((key) => tableCache.delete(key));
      }
    } catch (error) {
      console.error('Error loading tables:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Fonction publique pour rafraîchir les tables
  const refreshTables = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsLoading(true);
    await loadTables();
  }, [loadTables]);

  // Fonction pour mettre à jour une table spécifique
  const updateTableData = useCallback(
    async (tableId: number, updatedData: Partial<Table>) => {
      try {
        // Récupérer depuis le cache d'abord
        let currentTable = tableCache.get(tableId);

        // Si pas en cache, charger depuis storage
        if (!currentTable) {
          const fetchedTable = await getTable(tableId);
          if (!fetchedTable) return;
          currentTable = fetchedTable;
        }

        // Créer la table mise à jour
        const updatedTable = { ...currentTable, ...updatedData };

        // Sauvegarder dans le storage
        await updateTable(updatedTable);

        if (!mountedRef.current) return;

        // Mettre à jour le cache
        tableCache.set(tableId, updatedTable);

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

  // Fonction pour obtenir une table par ID (depuis le cache d'abord)
  const getTableById = useCallback(
    (id: number) => {
      // D'abord vérifier le cache
      const cachedTable = tableCache.get(id);
      if (cachedTable) return cachedTable;

      // Sinon chercher dans l'état local
      return tables.find((table) => table.id === id);
    },
    [tables]
  );

  // Fonction de nettoyage manuel
  const clearCache = useCallback(() => {
    console.log('🧹 Nettoyage manuel du cache');
    tableCache.clear();
    lastCleanup.current = Date.now();

    if (global.gc) {
      global.gc();
    }
  }, []);

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
