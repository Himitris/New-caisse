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

// ✅ Cache avec limite stricte et TTL automatique
const MAX_CACHE_SIZE = 20; // RÉDUIT de 50 à 20
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes au lieu de 5
const CLEANUP_INTERVAL = 30 * 1000; // Nettoyage toutes les 30 secondes

interface CacheEntry {
  table: Table;
  timestamp: number;
}

let tableCache = new Map<number, CacheEntry>();

export const TableProvider = ({ children }: { children: ReactNode }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const cleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // ✅ Nettoyage automatique agressif du cache
  const cleanupCache = useCallback(() => {
    if (!mountedRef.current) return;

    const now = Date.now();
    const keysToDelete: number[] = [];

    // Supprimer les entrées expirées
    tableCache.forEach((entry, key) => {
      if (now - entry.timestamp > CACHE_TTL) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => tableCache.delete(key));

    // Si le cache est encore trop grand, supprimer les plus anciennes
    if (tableCache.size > MAX_CACHE_SIZE) {
      const sortedEntries = Array.from(tableCache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      );

      const toDelete = sortedEntries.slice(0, tableCache.size - MAX_CACHE_SIZE);
      toDelete.forEach(([key]) => tableCache.delete(key));
    }

    // Force garbage collection si disponible
    if (global.gc && keysToDelete.length > 0) {
      try {
        global.gc();
      } catch {}
    }

    console.log(
      `🧹 Cache nettoyé: ${keysToDelete.length} entrées supprimées, taille: ${tableCache.size}`
    );
  }, []);

  // ✅ Setup du nettoyage automatique
  useEffect(() => {
    // Nettoyage immédiat puis périodique
    cleanupCache();
    cleanupIntervalRef.current = setInterval(cleanupCache, CLEANUP_INTERVAL);

    return () => {
      mountedRef.current = false;
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
      // Vider tout le cache à la destruction
      tableCache.clear();
    };
  }, [cleanupCache]);

  // ✅ Fonction de chargement simplifiée
  const loadTables = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const loadedTables = await getTables();

      if (!mountedRef.current) return;

      setTables(loadedTables);

      // Mettre à jour le cache avec TTL
      const now = Date.now();
      loadedTables.forEach((table) => {
        tableCache.set(table.id, { table, timestamp: now });
      });

      // Nettoyer immédiatement si nécessaire
      if (tableCache.size > MAX_CACHE_SIZE) {
        cleanupCache();
      }
    } catch (error) {
      console.error('Error loading tables:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [cleanupCache]);

  const refreshTables = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsLoading(true);
    await loadTables();
  }, [loadTables]);

  // ✅ Mise à jour optimisée avec cache TTL
  const updateTableData = useCallback(
    async (tableId: number, updatedData: Partial<Table>) => {
      if (!mountedRef.current) return;

      try {
        // Récupérer depuis le cache d'abord (avec vérification TTL)
        const cachedEntry = tableCache.get(tableId);
        const now = Date.now();

        let currentTable: Table | null = null;

        if (cachedEntry && now - cachedEntry.timestamp < CACHE_TTL) {
          currentTable = cachedEntry.table;
        } else {
          // Cache expiré ou absent, charger depuis storage
          currentTable = await getTable(tableId);
          if (!currentTable) return;
        }

        const updatedTable = { ...currentTable, ...updatedData };

        // Sauvegarder
        await updateTable(updatedTable);

        if (!mountedRef.current) return;

        // Mettre à jour le cache avec nouvelle timestamp
        tableCache.set(tableId, { table: updatedTable, timestamp: now });

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

  // ✅ Getter optimisé avec cache TTL
  const getTableById = useCallback(
    (id: number) => {
      // Vérifier le cache d'abord
      const cachedEntry = tableCache.get(id);
      const now = Date.now();

      if (cachedEntry && now - cachedEntry.timestamp < CACHE_TTL) {
        return cachedEntry.table;
      }

      // Sinon chercher dans l'état local
      return tables.find((table) => table.id === id);
    },
    [tables]
  );

  // ✅ Nettoyage manuel amélioré
  const clearCache = useCallback(() => {
    console.log('🧹 Nettoyage manuel complet du cache');
    tableCache.clear();

    if (global.gc) {
      try {
        global.gc();
      } catch {}
    }
  }, []);

  // Charger les données au démarrage
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
