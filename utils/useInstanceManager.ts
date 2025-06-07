// utils/useInstanceManager.ts - VERSION SIMPLIFIÉE

import { useEffect, useRef, useCallback } from 'react';

export const useInstanceManager = (componentName?: string) => {
  const mountedRef = useRef<boolean>(true);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const cleanupRef = useRef<Set<() => void>>(new Set());
  const instanceId = useRef<string>(
    `${componentName || 'component'}-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 5)}`
  );

  // ✅ Nettoyage automatique à la destruction
  useEffect(() => {
    console.log(`🔧 [MEMORY] Instance créée: ${instanceId.current}`);

    return () => {
      console.log(`🗑️ [MEMORY] Nettoyage instance: ${instanceId.current}`);
      console.log(`🗑️ [MEMORY] Timers à nettoyer: ${timersRef.current.size}`);
      console.log(
        `🗑️ [MEMORY] Cleanups à exécuter: ${cleanupRef.current.size}`
      );

      mountedRef.current = false;

      // Nettoyer TOUS les timers
      let cleanedTimers = 0;
      timersRef.current.forEach((timer) => {
        clearTimeout(timer);
        clearInterval(timer);
        cleanedTimers++;
      });
      timersRef.current.clear();
      console.log(`🗑️ [MEMORY] ${cleanedTimers} timers nettoyés`);

      // Exécuter toutes les fonctions de nettoyage
      let executedCleanups = 0;
      cleanupRef.current.forEach((cleanup) => {
        try {
          cleanup();
          executedCleanups++;
        } catch (error) {
          console.warn('❌ [MEMORY] Erreur lors du nettoyage:', error);
        }
      });
      cleanupRef.current.clear();
      console.log(`🗑️ [MEMORY] ${executedCleanups} cleanups exécutés`);
    };
  }, [componentName]);
  // ✅ setTimeout sécurisé
  const setSafeTimeout = useCallback(
    (callback: () => void, delay: number): void => {
      if (!mountedRef.current) {
        console.warn('⚠️ [MEMORY] Timeout ignoré - composant démonté');
        return;
      }

      const timer = setTimeout(() => {
        if (mountedRef.current) {
          try {
            callback();
          } catch (error) {
            console.error('❌ [MEMORY] Erreur dans timeout:', error);
          }
        } else {
          console.warn(
            '⚠️ [MEMORY] Callback timeout ignoré - composant démonté'
          );
        }
        timersRef.current.delete(timer);
      }, delay);

      timersRef.current.add(timer);
      console.log(`⏰ [MEMORY] Timer ajouté, total: ${timersRef.current.size}`);
    },
    []
  );

  // ✅ setInterval sécurisé
  const setSafeInterval = useCallback(
    (callback: () => void, interval: number): (() => void) => {
      if (!mountedRef.current) return () => {};

      const timer = setInterval(() => {
        if (mountedRef.current) {
          try {
            callback();
          } catch (error) {
            console.error('❌ [MEMORY] Erreur dans interval:', error);
          }
        } else {
          clearInterval(timer);
          timersRef.current.delete(timer);
        }
      }, interval);

      timersRef.current.add(timer);
      console.log(
        `⏰ [MEMORY] Interval ajouté, total: ${timersRef.current.size}`
      );

      return () => {
        clearInterval(timer);
        timersRef.current.delete(timer);
        console.log(
          `⏰ [MEMORY] Interval supprimé, reste: ${timersRef.current.size}`
        );
      };
    },
    []
  );
  const addCleanup = useCallback((cleanup: () => void): void => {
    if (mountedRef.current) {
      cleanupRef.current.add(cleanup);
      console.log(
        `🧹 [MEMORY] Cleanup ajouté, total: ${cleanupRef.current.size}`
      );
    }
  }, []);

  const safeExecute = useCallback(<T>(fn: () => T): T | null => {
    if (!mountedRef.current) {
      console.warn('⚠️ [MEMORY] Exécution ignorée - composant démonté');
      return null;
    }

    try {
      return fn();
    } catch (error) {
      console.error('❌ [MEMORY] Erreur dans safeExecute:', error);
      return null;
    }
  }, []);

  const isMounted = useCallback((): boolean => {
    return mountedRef.current;
  }, []);

  return {
    instanceId: instanceId.current,
    isMounted,
    safeExecute,
    setSafeTimeout,
    setSafeInterval,
    addCleanup,
  };
};
