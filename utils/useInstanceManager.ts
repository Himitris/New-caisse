// utils/useInstanceManager.ts - VERSION SIMPLIFIÉE

import { useEffect, useRef, useCallback } from 'react';

export const useInstanceManager = (componentName?: string) => {
  const mountedRef = useRef<boolean>(true);
  const timersRef = useRef<
    Set<ReturnType<typeof setTimeout | typeof setInterval>>
  >(new Set());
  const cleanupRef = useRef<Set<() => void>>(new Set());
  const instanceId = useRef<string>(
    `${componentName || 'component'}-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 5)}`
  );

  // ✅ Nettoyage automatique à la destruction
  useEffect(() => {
    if (componentName) {
      console.log(`🔧 Instance créée: ${instanceId.current}`);
    }

    return () => {
      mountedRef.current = false;

      // Nettoyer tous les timers
      timersRef.current.forEach((timer) => {
        clearTimeout(timer);
        clearInterval(timer);
      });
      timersRef.current.clear();

      // Exécuter toutes les fonctions de nettoyage
      cleanupRef.current.forEach((cleanup) => {
        try {
          cleanup();
        } catch (error) {
          console.warn('Erreur lors du nettoyage:', error);
        }
      });
      cleanupRef.current.clear();

      if (componentName) {
        console.log(`🗑️ Instance nettoyée: ${instanceId.current}`);
      }
    };
  }, [componentName]);

  // ✅ setTimeout sécurisé
  const setSafeTimeout = useCallback(
    (callback: () => void, delay: number): void => {
      if (!mountedRef.current) return;

      const timer = setTimeout(() => {
        if (mountedRef.current) {
          try {
            callback();
          } catch (error) {
            console.error('Erreur dans timeout:', error);
          }
        }
        timersRef.current.delete(timer);
      }, delay);

      timersRef.current.add(timer);
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
            console.error('Erreur dans interval:', error);
          }
        } else {
          clearInterval(timer);
          timersRef.current.delete(timer);
        }
      }, interval);

      timersRef.current.add(timer);

      // Retourner fonction de nettoyage
      return () => {
        clearInterval(timer);
        timersRef.current.delete(timer);
      };
    },
    []
  );

  // ✅ Ajouter fonction de nettoyage
  const addCleanup = useCallback((cleanup: () => void): void => {
    if (mountedRef.current) {
      cleanupRef.current.add(cleanup);
    }
  }, []);

  // ✅ Exécution sécurisée
  const safeExecute = useCallback(<T>(fn: () => T): T | null => {
    if (!mountedRef.current) return null;

    try {
      return fn();
    } catch (error) {
      console.error('Erreur dans safeExecute:', error);
      return null;
    }
  }, []);

  // ✅ Vérifier si monté
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
