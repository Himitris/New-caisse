// utils/useInstanceManager.ts - GESTIONNAIRE D'INSTANCES MULTIPLES

import { useEffect, useRef, useCallback } from 'react';

interface TimerRef {
  type: 'timeout' | 'interval';
  id: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>;
  description?: string;
}

class InstanceTracker {
  private static instances: Map<string, Set<string>> = new Map();

  static registerInstance(pageType: string, instanceId: string): void {
    if (!this.instances.has(pageType)) {
      this.instances.set(pageType, new Set());
    }
    this.instances.get(pageType)!.add(instanceId);

    console.log(
      `📱 Instance ${instanceId} créée pour ${pageType} (Total: ${
        this.instances.get(pageType)!.size
      })`
    );

    // ⚠️ Alerte si trop d'instances
    const count = this.instances.get(pageType)!.size;
    if (count > 2) {
      console.warn(
        `⚠️ ATTENTION: ${count} instances de ${pageType} détectées!`
      );
    }
  }

  static unregisterInstance(pageType: string, instanceId: string): void {
    if (this.instances.has(pageType)) {
      this.instances.get(pageType)!.delete(instanceId);

      const remaining = this.instances.get(pageType)!.size;
      console.log(
        `🗑️ Instance ${instanceId} détruite pour ${pageType} (Restant: ${remaining})`
      );

      if (remaining === 0) {
        this.instances.delete(pageType);
      }
    }
  }

  static getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.instances.forEach((instances, pageType) => {
      stats[pageType] = instances.size;
    });
    return stats;
  }

  static logStats(): void {
    const stats = this.getStats();
    console.log('📊 Instances actives:', stats);
  }
}

export const useInstanceManager = (
  pageType: string,
  pageId?: string | number
) => {
  const instanceId = useRef<string>(
    `${pageType}-${pageId || 'main'}-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`
  );
  const mountedRef = useRef<boolean>(true);
  const timersRef = useRef<Map<string, TimerRef>>(new Map());
  const cleanupFuncsRef = useRef<Map<string, () => void>>(new Map());

  // ✅ Enregistrement/désenregistrement de l'instance
  useEffect(() => {
    const id = instanceId.current;
    InstanceTracker.registerInstance(pageType, id);

    return () => {
      mountedRef.current = false;
      InstanceTracker.unregisterInstance(pageType, id);

      // ✅ Nettoyage de tous les timers
      timersRef.current.forEach((timer, key) => {
        if (timer.type === 'timeout') {
          clearTimeout(timer.id as ReturnType<typeof setTimeout>);
        } else {
          clearInterval(timer.id as ReturnType<typeof setInterval>);
        }
        console.log(`🧹 Timer ${key} nettoyé pour ${id}`);
      });
      timersRef.current.clear();

      // ✅ Nettoyage des fonctions custom
      cleanupFuncsRef.current.forEach((cleanup, key) => {
        try {
          cleanup();
          console.log(`🧹 Cleanup ${key} exécuté pour ${id}`);
        } catch (error) {
          console.warn(`⚠️ Erreur cleanup ${key}:`, error);
        }
      });
      cleanupFuncsRef.current.clear();

      console.log(`✅ Instance ${id} complètement nettoyée`);
    };
  }, [pageType]);

  // ✅ Gestion sécurisée des timeouts
  const setSafeTimeout = useCallback(
    (callback: () => void, delay: number, description?: string): string => {
      if (!mountedRef.current) {
        console.warn('⚠️ Tentative setTimeout sur instance démontée');
        return '';
      }

      const timerId = `timeout-${Date.now()}-${Math.random()}`;
      const id = setTimeout(() => {
        if (mountedRef.current) {
          try {
            callback();
          } catch (error) {
            console.error(`Erreur dans timeout ${timerId}:`, error);
          }
        }
        timersRef.current.delete(timerId);
      }, delay);

      timersRef.current.set(timerId, {
        type: 'timeout',
        id,
        description: description || `Timeout ${delay}ms`,
      });

      return timerId;
    },
    []
  );

  // ✅ Gestion sécurisée des intervals
  const setSafeInterval = useCallback(
    (callback: () => void, interval: number, description?: string): string => {
      if (!mountedRef.current) {
        console.warn('⚠️ Tentative setInterval sur instance démontée');
        return '';
      }

      const timerId = `interval-${Date.now()}-${Math.random()}`;
      const id = setInterval(() => {
        if (mountedRef.current) {
          try {
            callback();
          } catch (error) {
            console.error(`Erreur dans interval ${timerId}:`, error);
          }
        } else {
          // Auto-nettoyage si instance démontée
          clearInterval(id);
          timersRef.current.delete(timerId);
        }
      }, interval);

      timersRef.current.set(timerId, {
        type: 'interval',
        id,
        description: description || `Interval ${interval}ms`,
      });

      return timerId;
    },
    []
  );

  // ✅ Nettoyage manuel d'un timer
  const clearSafeTimer = useCallback((timerId: string): void => {
    const timer = timersRef.current.get(timerId);
    if (timer) {
      if (timer.type === 'timeout') {
        clearTimeout(timer.id as ReturnType<typeof setTimeout>);
      } else {
        clearInterval(timer.id as ReturnType<typeof setInterval>);
      }
      timersRef.current.delete(timerId);
    }
  }, []);

  // ✅ Ajout de fonctions de nettoyage custom
  const addCleanupFunction = useCallback(
    (key: string, cleanupFunc: () => void): void => {
      cleanupFuncsRef.current.set(key, cleanupFunc);
    },
    []
  );

  // ✅ Suppression d'une fonction de nettoyage
  const removeCleanupFunction = useCallback((key: string): void => {
    cleanupFuncsRef.current.delete(key);
  }, []);

  // ✅ Vérification si l'instance est toujours montée
  const isMounted = useCallback((): boolean => {
    return mountedRef.current;
  }, []);

  // ✅ Exécution sécurisée (uniquement si monté)
  const safeExecute = useCallback(<T>(fn: () => T): T | undefined => {
    if (mountedRef.current) {
      try {
        return fn();
      } catch (error) {
        console.error(
          `Erreur dans safeExecute pour ${instanceId.current}:`,
          error
        );
      }
    }
    return undefined;
  }, []);

  // ✅ Debug: afficher les stats
  const logInstanceStats = useCallback((): void => {
    console.log(`📊 Instance ${instanceId.current}:`);
    console.log(`  - Timers actifs: ${timersRef.current.size}`);
    console.log(`  - Cleanup functions: ${cleanupFuncsRef.current.size}`);
    console.log(`  - Montée: ${mountedRef.current}`);

    timersRef.current.forEach((timer, key) => {
      console.log(`    • ${key}: ${timer.description}`);
    });

    InstanceTracker.logStats();
  }, []);

  return {
    instanceId: instanceId.current,
    isMounted,
    safeExecute,
    setSafeTimeout,
    setSafeInterval,
    clearSafeTimer,
    addCleanupFunction,
    removeCleanupFunction,
    logInstanceStats,
  };
};

// ✅ Hook pour débugger les instances multiples
export const useInstanceDebugger = () => {
  useEffect(() => {
    const interval = setInterval(() => {
      const stats = InstanceTracker.getStats();
      const hasMultiple = Object.values(stats).some((count) => count > 1);

      if (hasMultiple) {
        console.warn('⚠️ INSTANCES MULTIPLES DÉTECTÉES:', stats);
      }
    }, 5000); // Check toutes les 5 secondes

    return () => clearInterval(interval);
  }, []);

  return {
    getInstanceStats: () => InstanceTracker.getStats(),
    logStats: () => InstanceTracker.logStats(),
  };
};
