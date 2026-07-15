// utils/logger.ts - Logger applicatif : no-op en production (__DEV__ uniquement).
// console.error reste utilisé directement, mais seulement pour les erreurs
// fatales (ex: échec d'initialisation de l'app, migration de schéma corrompue).

/* eslint-disable no-console */

export const logger = {
  log: (...args: unknown[]): void => {
    if (__DEV__) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]): void => {
    if (__DEV__) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]): void => {
    if (__DEV__) {
      console.error(...args);
    }
  },
};
