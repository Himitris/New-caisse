// utils/events.ts
type EventCallback = (...args: any[]) => void;

// ✅ SOLUTION : Système de déduplication des event listeners
class DeduplicatedEventEmitter {
  private events: Record<string, EventCallback[]> = {};
  private listenerRegistry: Map<string, Set<string>> = new Map(); // Tracking des listeners par composant
  private lastEventParams: Record<string, any[]> = {};
  private lastEventTime: Record<string, number> = {};
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.aggressiveCleanup();
    }, 15000);
  }

  // ✅ NOUVELLE MÉTHODE : Enregistrement avec déduplication
  on(event: string, callback: EventCallback, componentId?: string) {
    if (!this.events[event]) {
      this.events[event] = [];
      this.listenerRegistry.set(event, new Set());
    }

    // ✅ Déduplication par componentId
    if (componentId) {
      const existingListeners = this.listenerRegistry.get(event)!;
      if (existingListeners.has(componentId)) {
        console.warn(`[EventEmitter] Duplicate listener prevented for ${event} from ${componentId}`);
        return () => {}; // Retourner une fonction vide pour éviter les erreurs
      }
      existingListeners.add(componentId);
    }

    this.events[event].push(callback);

    console.log(`[EventEmitter] Added listener for ${event} (total: ${this.events[event].length})`);

    // ✅ Fonction de cleanup améliorée
    return () => {
      if (this.events[event]) {
        const index = this.events[event].indexOf(callback);
        if (index > -1) {
          this.events[event].splice(index, 1);
          
          // Nettoyer le registry
          if (componentId) {
            this.listenerRegistry.get(event)?.delete(componentId);
          }
          
          console.log(`[EventEmitter] Removed listener for ${event} (remaining: ${this.events[event].length})`);
          
          // Nettoyer l'événement s'il n'y a plus de listeners
          if (this.events[event].length === 0) {
            delete this.events[event];
            this.listenerRegistry.delete(event);
          }
        }
      }
    };
  }

  emit(event: string, ...args: any[]) {
    const lastParams = this.lastEventParams[event];
    const lastTime = this.lastEventTime[event] || 0;
    const now = Date.now();

    // ✅ Debouncing strict pour éviter les émissions multiples
    if (lastParams && this.areArgsEqual(lastParams, args) && now - lastTime < 100) {
      console.log(`[EventEmitter] Debounced duplicate event ${event}`);
      return;
    }

    this.lastEventParams[event] = args.slice(0, 2);
    this.lastEventTime[event] = now;

    if (this.events[event] && this.events[event].length > 0) {
      const listeners = [...this.events[event]];
      
      console.log(`[EventEmitter] Emitting ${event} to ${listeners.length} listeners with args:`, args);
      
      // ✅ Limitation du nombre de listeners simultanés
      if (listeners.length > 3) {
        console.error(`[EventEmitter] TOO MANY LISTENERS for ${event}: ${listeners.length}`);
        // En urgence, garder seulement les 2 derniers listeners
        const recentListeners = listeners.slice(-2);
        this.events[event] = recentListeners;
        this.logListenerDebugInfo(event);
      }

      for (const callback of listeners) {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event ${event} callback:`, error);
        }
      }
    }
  }

  // ✅ NOUVELLE MÉTHODE : Debug des listeners multiples
  logListenerDebugInfo(event?: string): void {
    if (event) {
      const count = this.events[event]?.length || 0;
      const registeredComponents = Array.from(this.listenerRegistry.get(event) || []);
      console.log(`[EventEmitter] Debug ${event}:`, {
        listenerCount: count,
        registeredComponents,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('[EventEmitter] All listeners debug:', {
        totalEvents: Object.keys(this.events).length,
        eventsWithMultipleListeners: Object.entries(this.events)
          .filter(([, listeners]) => listeners.length > 1)
          .map(([eventName, listeners]) => ({
            event: eventName,
            count: listeners.length,
            components: Array.from(this.listenerRegistry.get(eventName) || [])
          }))
      });
    }
  }

  // ✅ NOUVELLE MÉTHODE : Forcer le nettoyage d'un événement spécifique
  forceCleanupEvent(event: string): void {
    if (this.events[event]) {
      const count = this.events[event].length;
      delete this.events[event];
      this.listenerRegistry.delete(event);
      delete this.lastEventParams[event];
      delete this.lastEventTime[event];
      console.log(`[EventEmitter] Force cleaned event ${event} (removed ${count} listeners)`);
    }
  }

  private areArgsEqual(args1: any[], args2: any[]): boolean {
    if (args1.length !== args2.length) return false;
    for (let i = 0; i < Math.min(2, args1.length); i++) {
      if (args1[i] !== args2[i]) return false;
    }
    return true;
  }

  private aggressiveCleanup(): void {
    const now = Date.now();
    const maxAge = 30 * 1000;
    let removedCount = 0;

    for (const event in this.lastEventTime) {
      if (now - this.lastEventTime[event] > maxAge) {
        delete this.lastEventParams[event];
        delete this.lastEventTime[event];
        removedCount++;
      }
    }

    // ✅ Détecter et nettoyer les événements avec trop de listeners
    for (const [event, listeners] of Object.entries(this.events)) {
      if (listeners.length > 2) {
        console.warn(`[EventEmitter] Event ${event} has ${listeners.length} listeners - cleaning up`);
        this.logListenerDebugInfo(event);
        
        // Garder seulement le dernier listener
        this.events[event] = listeners.slice(-1);
        
        // Nettoyer le registry correspondant
        const registry = this.listenerRegistry.get(event);
        if (registry && registry.size > 1) {
          registry.clear();
        }
      }
    }

    if (removedCount > 0) {
      console.log(`[EventEmitter] Cleaned ${removedCount} old events`);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.events = {};
    this.listenerRegistry.clear();
    this.lastEventParams = {};
    this.lastEventTime = {};
  }
}

// ✅ Nouvelle instance avec déduplication
export const events = new DeduplicatedEventEmitter();

// ✅ DÉBUGAGE EN DÉVELOPPEMENT
if (__DEV__) {
  // Log périodique des listeners multiples
  setInterval(() => {
    events.logListenerDebugInfo();
  }, 10000);

  // Commande globale pour debug
  (global as any).__debugEvents = () => events.logListenerDebugInfo();
  (global as any).__forceCleanupEvent = (event: string) => events.forceCleanupEvent(event);
}

export const EVENT_TYPES = {
  PAYMENT_ADDED: 'payment_added',
  TABLE_UPDATED: 'table_updated',
};