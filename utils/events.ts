// utils/events.ts
type EventCallback = (...args: any[]) => void;

// EventEmitter optimisé avec nettoyage automatique
class EventEmitter {
  private events: Record<string, EventCallback[]> = {};
  private lastEventParams: Record<string, any[]> = {};
  private lastEventTime: Record<string, number> = {};
  private readonly MAX_HISTORY = 10; // Limiter l'historique
  private cleanupInterval: number | null = null;

  constructor() {
    // Nettoyage automatique toutes les 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    // Nettoyer l'historique des événements anciens
    for (const event in this.lastEventTime) {
      if (now - this.lastEventTime[event] > maxAge) {
        delete this.lastEventParams[event];
        delete this.lastEventTime[event];
      }
    }

    // Garder seulement les N derniers événements
    const eventKeys = Object.keys(this.lastEventParams);
    if (eventKeys.length > this.MAX_HISTORY) {
      const sorted = eventKeys
        .map(key => ({ key, time: this.lastEventTime[key] || 0 }))
        .sort((a, b) => b.time - a.time)
        .slice(this.MAX_HISTORY);

      // Supprimer les anciens
      for (const event of eventKeys) {
        if (!sorted.find(s => s.key === event)) {
          delete this.lastEventParams[event];
          delete this.lastEventTime[event];
        }
      }
    }
  }

  on(event: string, callback: EventCallback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);

    return () => {
      this.events[event] = this.events[event].filter((cb) => cb !== callback);
      // Nettoyer l'événement s'il n'y a plus de listeners
      if (this.events[event].length === 0) {
        delete this.events[event];
      }
    };
  }

  emit(event: string, ...args: any[]) {
    const lastParams = this.lastEventParams[event];
    const lastTime = this.lastEventTime[event] || 0;
    const now = Date.now();

    // Debouncing plus agressif
    if (lastParams && this.areArgsEqual(lastParams, args) && now - lastTime < 100) {
      return;
    }

    // Stocker seulement les événements récents
    this.lastEventParams[event] = args.slice(0, 3); // Limiter à 3 arguments
    this.lastEventTime[event] = now;

    if (this.events[event]) {
      // Utiliser une copie pour éviter les problèmes si des listeners se désabonnent
      const listeners = [...this.events[event]];
      for (const callback of listeners) {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event ${event} callback:`, error);
        }
      }
    }
  }

  private areArgsEqual(args1: any[], args2: any[]): boolean {
    if (args1.length !== args2.length) return false;
    
    // Comparaison rapide pour les 3 premiers arguments seulement
    const maxCompare = Math.min(3, args1.length);
    for (let i = 0; i < maxCompare; i++) {
      if (args1[i] !== args2[i]) return false;
    }
    return true;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.events = {};
    this.lastEventParams = {};
    this.lastEventTime = {};
  }
}

// Créer et exporter une instance singleton
export const events = new EventEmitter();

// Définir des constantes pour les noms d'événements
export const EVENT_TYPES = {
  PAYMENT_ADDED: 'payment_added',
  TABLE_UPDATED: 'table_updated',
};
