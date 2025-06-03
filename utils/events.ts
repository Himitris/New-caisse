// utils/events.ts - Version simplifiée

type EventCallback = (...args: any[]) => void;

class SimpleEventEmitter {
  private events: Record<string, EventCallback[]> = {};

  on(event: string, callback: EventCallback): () => void {
    if (!this.events[event]) {
      this.events[event] = [];
    }

    this.events[event].push(callback);

    // Retourner la fonction de cleanup
    return () => {
      if (this.events[event]) {
        const index = this.events[event].indexOf(callback);
        if (index > -1) {
          this.events[event].splice(index, 1);
        }
      }
    };
  }

  emit(event: string, ...args: any[]): void {
    if (this.events[event]) {
      // Créer une copie pour éviter les problèmes si des listeners se désabonnent pendant l'émission
      const listeners = [...this.events[event]];
      listeners.forEach((callback) => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event ${event} callback:`, error);
        }
      });
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }

  listenerCount(event: string): number {
    return this.events[event]?.length || 0;
  }
}

export const events = new SimpleEventEmitter();

export const EVENT_TYPES = {
  TABLE_UPDATED: 'table_updated',
  TABLES_UPDATED: 'tables_updated',
  PAYMENT_ADDED: 'payment_added',
} as const;
