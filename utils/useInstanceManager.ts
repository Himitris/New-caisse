// utils/useInstanceManager.ts - VERSION ULTRA-SIMPLIFIÉE
import { useEffect, useRef, useCallback } from 'react';

export const useInstanceManager = (componentName?: string) => {
  const mountedRef = useRef<boolean>(true);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
    };
  }, []);

  const setSafeTimeout = useCallback((callback: () => void, delay: number) => {
    if (!mountedRef.current) return;

    const timer = setTimeout(() => {
      if (mountedRef.current) {
        callback();
      }
      timersRef.current.delete(timer);
    }, delay);

    timersRef.current.add(timer);
  }, []);

  const isMounted = useCallback(() => mountedRef.current, []);

  const safeExecute = useCallback(<T>(fn: () => T): T | null => {
    return mountedRef.current ? fn() : null;
  }, []);

  return {
    isMounted,
    safeExecute,
    setSafeTimeout,
  };
};
