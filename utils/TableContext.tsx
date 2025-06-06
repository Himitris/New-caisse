// utils/TableContext.tsx - VERSION NETTOYÉE
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import { getTables, getTable, Table, updateTable, saveTables } from './storage';

interface TableContextType {
  tables: Table[];
  isLoading: boolean;
  refreshTables: () => Promise<void>;
  saveTablesData: (tables: Table[]) => Promise<void>;
}

const TableContext = createContext<TableContextType | undefined>(undefined);

interface CacheEntry {
  table: Table;
  timestamp: number;
  dirty: boolean;
}

// ✅ CORRECTION MAJEURE : Cache avec nettoyage automatique
const MAX_CACHE_SIZE = 50; // Limite du cache
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL
const CLEANUP_INTERVAL = 2 * 60 * 1000; // Nettoyage toutes les 2 minutes

class TableCacheManager {
  private cache = new Map<number, CacheEntry>();
  private pendingWrites = new Map<number, Table>();
  private writeTimeout: ReturnType<typeof setTimeout> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // ✅ Nettoyage automatique du cache
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, CLEANUP_INTERVAL);
  }

  // ✅ Nettoyer les entrées expirées
  private cleanupExpiredEntries() {
    const now = Date.now();
    const toDelete: number[] = [];

    for (const [id, entry] of this.cache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        toDelete.push(id);
      }
    }

    toDelete.forEach((id) => {
      this.cache.delete(id);
    });

    // ✅ Limiter la taille du cache
    if (this.cache.size > MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      );

      const toRemove = entries.slice(0, this.cache.size - MAX_CACHE_SIZE);
      toRemove.forEach(([id]) => {
        this.cache.delete(id);
      });
    }

    console.log(`🧹 Cache nettoyé: ${this.cache.size} entrées restantes`);
  }

  // ✅ Méthodes du cache
  get(id: number): Table | null {
    const entry = this.cache.get(id);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.table;
    }
    return null;
  }

  set(id: number, table: Table) {
    this.cache.set(id, {
      table,
      timestamp: Date.now(),
      dirty: false,
    });
  }

  // ✅ Nettoyage complet
  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
    }
    this.cache.clear();
    this.pendingWrites.clear();
  }

  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingWrites: this.pendingWrites.size,
    };
  }
}

// ✅ Instance unique du gestionnaire de cache
const cacheManager = new TableCacheManager();

export const TableProvider = ({ children }: { children: ReactNode }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  // ✅ Nettoyage à la destruction
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cacheManager.cleanup();
    };
  }, []);

  const refreshTables = useCallback(async () => {
    if (!mountedRef.current) return;

    setIsLoading(true);
    try {
      const loadedTables = await getTables();
      if (mountedRef.current) {
        setTables(loadedTables);
      }
    } catch (error) {
      console.error('Error loading tables:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const saveTablesData = useCallback(async (tablesToSave: Table[]) => {
    if (!mountedRef.current) return;

    try {
      await saveTables(tablesToSave);
      if (mountedRef.current) {
        setTables(tablesToSave);
      }
    } catch (error) {
      console.error('Error saving tables:', error);
      throw error;
    }
  }, []);

  // Chargement initial
  useEffect(() => {
    refreshTables();
  }, [refreshTables]);

  // ✅ Monitoring du cache (développement)
  useEffect(() => {
    const interval = setInterval(() => {
      const stats = cacheManager.getStats();
      console.log('📊 Cache stats:', stats);
    }, 60000); // Toutes les minutes

    return () => clearInterval(interval);
  }, []);

  const value = {
    tables,
    isLoading,
    refreshTables,
    saveTablesData,
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
