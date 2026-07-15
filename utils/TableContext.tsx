// utils/TableContext.tsx
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { getTables, Table, updateTable } from './storage';
import { logger } from '@/utils/logger';

interface TableStateContextType {
  tables: Table[];
  isLoading: boolean;
}

interface TableActionsContextType {
  refreshTables: () => Promise<void>;
  updateTableData: (table: Table) => Promise<void>;
  flushTableWrites: (tableId?: number) => Promise<void>;
  getTableById: (id: number) => Table | undefined;
  clearCache: () => void;
}

const PERSIST_DEBOUNCE_MS = 200;

interface PendingResult {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

interface WriteQueueEntry {
  timer: ReturnType<typeof setTimeout> | null;
  // Dernière version de la table demandée pendant la fenêtre de debounce ; seule
  // celle-ci sera réellement écrite (les versions intermédiaires sont coalescées).
  latestTable: Table | null;
  // Chaîne les écritures réelles les unes après les autres pour une même table,
  // afin qu'aucune écriture concurrente ne puisse s'entrelacer.
  chain: Promise<void>;
  // Promesse partagée par tous les appels d'updateTableData survenus pendant la
  // fenêtre de debounce en cours ; résolue/rejetée une fois l'écriture coalescée faite.
  pending: PendingResult | null;
}

const TableStateContext = createContext<TableStateContextType | undefined>(
  undefined
);
const TableActionsContext = createContext<
  TableActionsContextType | undefined
>(undefined);

export const TableProvider = ({ children }: { children: ReactNode }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  // Miroir de `tables` accessible sans faire dépendre les callbacks de sa valeur,
  // pour que getTableById reste stable même quand les données changent.
  const tablesRef = useRef<Table[]>(tables);
  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  // File d'écriture par table : au plus une écriture en vol à la fois par tableId,
  // les demandes intermédiaires sont coalescées (seule la dernière version compte).
  const writeQueueRef = useRef<Map<number, WriteQueueEntry>>(new Map());

  const getQueueEntry = useCallback((tableId: number): WriteQueueEntry => {
    let entry = writeQueueRef.current.get(tableId);
    if (!entry) {
      entry = { timer: null, latestTable: null, chain: Promise.resolve(), pending: null };
      writeQueueRef.current.set(tableId, entry);
    }
    return entry;
  }, []);

  // Écrit réellement une table en base, chaînée sur l'écriture précédente de la
  // même table (nextWrite = currentWrite.then(...)) pour empêcher tout entrelacement.
  const persistTable = useCallback(
    (table: Table): Promise<void> => {
      const entry = getQueueEntry(table.id);
      const currentWrite = entry.chain;
      const nextWrite = currentWrite.then(async () => {
        if (!mountedRef.current) return;
        try {
          await updateTable(table);
        } catch (error) {
          logger.error(`Error persisting table ${table.id}:`, error);
          throw error;
        }
      });
      // La chaîne interne avale les erreurs pour ne jamais bloquer les écritures
      // suivantes ; l'erreur reste propagée à l'appelant via `nextWrite`.
      entry.chain = nextWrite.catch(() => {});
      return nextWrite;
    },
    [getQueueEntry]
  );

  // ✅ Chargement simple direct (INCHANGÉ)
  const loadTables = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const loadedTables = await getTables();
      if (!mountedRef.current) return;
      setTables(loadedTables);
    } catch (error) {
      logger.error('Error loading tables:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const refreshTables = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsLoading(true);
    await loadTables();
  }, [loadTables]);

  // Mise à jour optimiste : l'état React (le `table` déjà à jour côté écran) fait foi,
  // on ne relit jamais le storage avant d'écrire. La persistance elle-même est débattue
  // de 200ms et coalescée par tableId : seule la dernière version en attente est écrite.
  const updateTableData = useCallback(
    (table: Table): Promise<void> => {
      if (!mountedRef.current) return Promise.resolve();

      setTables((prevTables) =>
        prevTables.map((t) => (t.id === table.id ? table : t))
      );

      const entry = getQueueEntry(table.id);
      entry.latestTable = table;

      if (entry.timer) {
        clearTimeout(entry.timer);
      } else if (!entry.pending) {
        let resolveFn!: () => void;
        let rejectFn!: (error: unknown) => void;
        const promise = new Promise<void>((resolve, reject) => {
          resolveFn = resolve;
          rejectFn = reject;
        });
        entry.pending = { promise, resolve: resolveFn, reject: rejectFn };
      }

      entry.timer = setTimeout(() => {
        entry.timer = null;
        const tableToWrite = entry.latestTable;
        entry.latestTable = null;
        const pending = entry.pending;
        entry.pending = null;
        if (!tableToWrite || !pending) return;
        persistTable(tableToWrite).then(pending.resolve, pending.reject);
      }, PERSIST_DEBOUNCE_MS);

      return entry.pending!.promise;
    },
    [getQueueEntry, persistTable]
  );

  // Force l'écriture immédiate de toute donnée en attente de debounce pour une table
  // (ou toutes si `tableId` est omis) : à utiliser sur blur/unmount et avant toute
  // navigation qui dépend de l'état persisté (ex: écrans /payment/*).
  const flushTableWrites = useCallback(
    (tableId?: number): Promise<void> => {
      const ids =
        tableId !== undefined
          ? [tableId]
          : Array.from(writeQueueRef.current.keys());

      const flushes = ids.map((id) => {
        const entry = writeQueueRef.current.get(id);
        if (!entry) return Promise.resolve();

        if (entry.timer) {
          clearTimeout(entry.timer);
          entry.timer = null;
        }

        const tableToWrite = entry.latestTable;
        entry.latestTable = null;
        const pending = entry.pending;
        entry.pending = null;

        if (!tableToWrite || !pending) {
          // Rien en attente de debounce : on attend simplement la dernière écriture en vol.
          return entry.chain;
        }

        const write = persistTable(tableToWrite);
        write.then(pending.resolve, pending.reject);
        return write;
      });

      return Promise.all(flushes).then(() => undefined);
    },
    [persistTable]
  );

  // ✅ Getter simple sans cache — lit tablesRef pour rester stable entre les rendus
  const getTableById = useCallback((id: number) => {
    return tablesRef.current.find((table) => table.id === id);
  }, []);

  const clearCache = useCallback(() => {
    // Ne fait plus rien - gardé pour compatibilité (INCHANGÉ)
  }, []);

  // ✅ Chargement initial ; réinitialise mountedRef à chaque (re)montage de l'effet
  // (Fast Refresh ou remount du provider), sinon il resterait bloqué à false.
  useEffect(() => {
    mountedRef.current = true;
    loadTables();
    return () => {
      mountedRef.current = false;
    };
  }, [loadTables]);

  const stateValue = useMemo<TableStateContextType>(
    () => ({ tables, isLoading }),
    [tables, isLoading]
  );

  const actionsValue = useMemo<TableActionsContextType>(
    () => ({
      refreshTables,
      updateTableData,
      flushTableWrites,
      getTableById,
      clearCache,
    }),
    [refreshTables, updateTableData, flushTableWrites, getTableById, clearCache]
  );

  return (
    <TableStateContext.Provider value={stateValue}>
      <TableActionsContext.Provider value={actionsValue}>
        {children}
      </TableActionsContext.Provider>
    </TableStateContext.Provider>
  );
};

export const useTableState = () => {
  const context = useContext(TableStateContext);
  if (!context) {
    throw new Error('useTableState must be used within a TableProvider');
  }
  return context;
};

export const useTableActions = () => {
  const context = useContext(TableActionsContext);
  if (!context) {
    throw new Error('useTableActions must be used within a TableProvider');
  }
  return context;
};

// Hook combiné, conservé pour compatibilité avec les écrans qui ont besoin
// à la fois des données et des actions (ex: écran d'accueil des tables).
export const useTableContext = () => {
  return { ...useTableState(), ...useTableActions() };
};
