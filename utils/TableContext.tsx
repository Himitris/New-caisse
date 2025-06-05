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
  const cleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const mountedRef = useRef(true);

  // ✅ Fonction d'écriture groupée ultra-optimisée
  const flushPendingWrites = useCallback(async () => {
    if (pendingWrites.size === 0) return;

    const writesToProcess = new Map(pendingWrites);
    pendingWrites.clear();

    try {
      // ✅ Traitement en parallèle des écritures
      const writePromises = Array.from(writesToProcess.entries()).map(
        async ([tableId, table]) => {
          try {
            await updateTable(table);

            // Mettre à jour le cache avec les nouvelles données
            const now = Date.now();
            tableCache.set(tableId, {
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

      const results = await Promise.allSettled(writePromises);

      // ✅ Mettre à jour l'état local seulement avec les succès
      if (mountedRef.current) {
        setTables((prevTables) => {
          const newTables = [...prevTables];

          results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.success) {
              const tableId = Array.from(writesToProcess.keys())[index];
              const updatedTable = writesToProcess.get(tableId);
              if (updatedTable) {
                const tableIndex = newTables.findIndex((t) => t.id === tableId);
                if (tableIndex >= 0) {
                  newTables[tableIndex] = updatedTable;
                }
              }
            }
          });

          return newTables;
        });
      }
    } catch (error) {
      console.error('Error in batch write:', error);
    }
  }, []);

  // ✅ Nettoyage optimisé
  const cleanupCache = useCallback(() => {
    if (!mountedRef.current) return;

    const now = Date.now();
    const keysToDelete: number[] = [];

    tableCache.forEach((entry, key) => {
      if (now - entry.timestamp > CACHE_TTL && !entry.dirty) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => tableCache.delete(key));

    // ✅ Nettoyage forcé si trop de données
    if (tableCache.size > MAX_CACHE_SIZE) {
      const sortedEntries = Array.from(tableCache.entries())
        .filter(([, entry]) => !entry.dirty)
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toDelete = Math.ceil(sortedEntries.length / 2); // Plus agressif
      for (let i = 0; i < toDelete; i++) {
        tableCache.delete(sortedEntries[i][0]);
      }
    }

    console.log(
      `🧹 Table cache nettoyé: ${keysToDelete.length} entrées, taille: ${tableCache.size}`
    );
  }, []);

  // ✅ Setup du nettoyage automatique
  useEffect(() => {
    cleanupCache();
    cleanupIntervalRef.current = setInterval(cleanupCache, CLEANUP_INTERVAL);

    return () => {
      mountedRef.current = false;
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
      if (writeTimeout) {
        clearTimeout(writeTimeout);
      }
      // Flush final des écritures en attente
      if (pendingWrites.size > 0) {
        flushPendingWrites();
      }
      tableCache.clear();
      pendingWrites.clear();
    };
  }, [cleanupCache, flushPendingWrites]);

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
        // ✅ Récupération optimisée depuis le cache
        const cachedEntry = tableCache.get(tableId);
        const now = Date.now();

        let currentTable: Table | null = null;

        if (cachedEntry && now - cachedEntry.timestamp < CACHE_TTL) {
          currentTable = cachedEntry.table;
        } else {
          currentTable = await getTable(tableId);
          if (!currentTable) return;
        }

        const updatedTable = { ...currentTable, ...updatedData };

        // ✅ Mise à jour immédiate du cache avec marqueur dirty
        tableCache.set(tableId, {
          table: updatedTable,
          timestamp: now,
          dirty: true,
        });

        // ✅ Mise à jour immédiate de l'état local pour la réactivité
        if (mountedRef.current) {
          setTables((prevTables) =>
            prevTables.map((table) =>
              table.id === tableId ? updatedTable : table
            )
          );
        }

        // ✅ Programmer l'écriture groupée
        pendingWrites.set(tableId, updatedTable);

        if (writeTimeout) {
          clearTimeout(writeTimeout);
        }

        writeTimeout = setTimeout(() => {
          flushPendingWrites();
        }, BATCH_WRITE_DELAY);
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
      // ✅ Cache en priorité absolue
      const cachedEntry = tableCache.get(id);
      const now = Date.now();

      if (cachedEntry && now - cachedEntry.timestamp < CACHE_TTL) {
        return cachedEntry.table;
      }

      // ✅ Fallback sur l'état local
      return tables.find((table) => table.id === id);
    },
    [tables]
  );

  // ✅ Nettoyage optimisé
  const clearCache = useCallback(() => {
    console.log('🧹 Nettoyage manuel du cache et flush des écritures');

    // ✅ Flush synchrone des écritures en attente
    if (pendingWrites.size > 0) {
      flushPendingWrites();
    }

    tableCache.clear();
    pendingWrites.clear();

    if (writeTimeout) {
      clearTimeout(writeTimeout);
      writeTimeout = null;
    }
  }, [flushPendingWrites]);

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
