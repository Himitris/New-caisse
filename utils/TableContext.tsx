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

const MAX_CACHE_SIZE = 15; // Réduit pour plus de réactivité
const CACHE_TTL = 30 * 1000; // Réduit de 90s à 30s
const CLEANUP_INTERVAL = 15 * 1000; // Réduit de 20s à 15s
const BATCH_WRITE_DELAY = 50; // Réduit de 100ms à 50ms

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

  // ✅ Cache local au provider avec nettoyage automatique
  const tableCacheRef = useRef(new Map<number, CacheEntry>());
  const pendingWritesRef = useRef(new Map<number, Table>());
  const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const mountedRef = useRef(true);

  // ✅ Nettoyage drastique et immédiat
  const aggressiveCleanup = useCallback(() => {
    if (writeTimeoutRef.current) {
      clearTimeout(writeTimeoutRef.current);
      writeTimeoutRef.current = null;
    }

    // Vider immédiatement tous les caches
    tableCacheRef.current.clear();
    pendingWritesRef.current.clear();

    // Force garbage collection si disponible
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }

    console.log('🧹 Nettoyage agressif - tous les caches vidés');
  }, []);

  // ✅ Fonction d'écriture groupée ultra-optimisée
  const flushPendingWrites = useCallback(async () => {
    if (pendingWritesRef.current.size === 0) return;

    const writesToProcess = new Map(pendingWritesRef.current);
    pendingWritesRef.current.clear();

    try {
      const writePromises = Array.from(writesToProcess.entries()).map(
        async ([tableId, table]) => {
          try {
            await updateTable(table);
            const now = Date.now();
            tableCacheRef.current.set(tableId, {
              table,
              timestamp: now,
              dirty: false,
            });
            return { tableId, success: true };
          } catch (error) {
            console.error(`Error updating table ${tableId}:`, error);
            return { tableId, success: false, error };
          }
        }
      );

      await Promise.allSettled(writePromises);
    } catch (error) {
      console.error('Error in batch write:', error);
    }
  }, []);

  // ✅ Nettoyage optimisé
  const cleanupCache = useCallback(() => {
    if (!mountedRef.current) return;

    const now = Date.now();
    const cache = tableCacheRef.current;

    // ✅ Nettoyage plus agressif - garder max 5 entrées
    if (cache.size > 5) {
      const entries = Array.from(cache.entries())
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
        .slice(0, 3); // Garder seulement les 3 plus récentes

      cache.clear();
      entries.forEach(([key, value]) => cache.set(key, value));
    }

    // Supprimer les anciennes entrées (> 5 secondes au lieu de 30)
    const keysToDelete: number[] = [];
    cache.forEach((entry, key) => {
      if (now - entry.timestamp > 5000 && !entry.dirty) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => cache.delete(key));

    console.log(
      `🧹 Table cache nettoyé: ${keysToDelete.length} entrées, taille: ${cache.size}`
    );
  }, []);

  // ✅ Setup du nettoyage automatique
  useEffect(() => {
    cleanupCache();
    cleanupIntervalRef.current = setInterval(() => {
      cleanupCache();
      // Nettoyage agressif toutes les 30 secondes
      if (tableCacheRef.current.size > 3) {
        aggressiveCleanup();
      }
    }, 5000); // 5 secondes au lieu de 15

    return () => {
      mountedRef.current = false;
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
      aggressiveCleanup();
    };
  }, [cleanupCache, aggressiveCleanup]);

  // ✅ Chargement ultra-optimisé
  const loadTables = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const loadedTables = await getTables();

      if (!mountedRef.current) return;

      setTables(loadedTables);

      // ✅ Mettre à jour le cache en une seule opération
      const now = Date.now();
      const newCacheEntries = new Map<number, CacheEntry>();

      loadedTables.forEach((table) => {
        newCacheEntries.set(table.id, {
          table,
          timestamp: now,
          dirty: false,
        });
      });

      // Remplacer le cache en une fois plutôt que entry par entry
      tableCache = newCacheEntries;
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

    // ✅ Flush les écritures en attente avant le refresh
    if (pendingWrites.size > 0) {
      await flushPendingWrites();
    }

    setIsLoading(true);
    await loadTables();
  }, [loadTables, flushPendingWrites]);

  // ✅ Mise à jour ultra-optimisée avec écriture groupée
  const updateTableData = useCallback(
    async (tableId: number, updatedData: Partial<Table>) => {
      if (!mountedRef.current) return;

      try {
        const cache = tableCacheRef.current;
        const pendingWrites = pendingWritesRef.current;

        const cachedEntry = cache.get(tableId);
        const now = Date.now();

        let currentTable: Table | null = null;

        if (cachedEntry && now - cachedEntry.timestamp < 5000) {
          // 5s au lieu de 30s
          currentTable = cachedEntry.table;
        } else {
          currentTable = await getTable(tableId);
          if (!currentTable) return;
        }

        const updatedTable = { ...currentTable, ...updatedData };

        cache.set(tableId, {
          table: updatedTable,
          timestamp: now,
          dirty: true,
        });

        if (mountedRef.current) {
          setTables((prevTables) =>
            prevTables.map((table) =>
              table.id === tableId ? updatedTable : table
            )
          );
        }

        pendingWrites.set(tableId, updatedTable);

        if (writeTimeoutRef.current) {
          clearTimeout(writeTimeoutRef.current);
        }

        writeTimeoutRef.current = setTimeout(() => {
          flushPendingWrites();
        }, 50); // Plus rapide
      } catch (error) {
        console.error(`Error updating table ${tableId}:`, error);
        throw error;
      }
    },
    [flushPendingWrites]
  );

  // ✅ Getter ultra-optimisé
  const getTableById = useCallback(
    (id: number) => {
      const cache = tableCacheRef.current;
      const cachedEntry = cache.get(id);
      const now = Date.now();

      if (cachedEntry && now - cachedEntry.timestamp < 5000) {
        return cachedEntry.table;
      }

      return tables.find((table) => table.id === id);
    },
    [tables]
  );

  // ✅ clearCache modifié
  const clearCache = useCallback(() => {
    aggressiveCleanup();
  }, [aggressiveCleanup]);

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
