// utils/useMemoryCleanup.ts
import { useEffect, useRef, useCallback } from 'react';
import { logger } from '@/utils/logger';

export const useMemoryCleanup = () => {
  const cleanupFuncs = useRef<(() => void)[]>([]);
  const isMountedRef = useRef(true);

  const addCleanup = useCallback((cleanupFunc: () => void) => {
    cleanupFuncs.current.push(cleanupFunc);
  }, []);

  const isStillMounted = useCallback(() => isMountedRef.current, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Nettoyer TOUT
      cleanupFuncs.current.forEach((cleanup) => {
        try {
          cleanup();
        } catch (error) {
          logger.warn('Cleanup error:', error);
        }
      });
      cleanupFuncs.current = [];
    };
  }, []);

  return { addCleanup, isStillMounted };
};
