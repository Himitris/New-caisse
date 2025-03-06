// utils/events.ts
type EventCallback = (...args: any[]) => void;

class EventEmitter {
  private events: Record<string, EventCallback[]> = {};

  on(event: string, callback: EventCallback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    
    // Retourne une fonction pour se désabonner
    return () => {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    };
  }

  emit(event: string, ...args: any[]) {
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event ${event} callback:`, error);
        }
      });
    }
  }
}

// Créer et exporter une instance singleton
export const events = new EventEmitter();

// Définir des constantes pour les noms d'événements 
export const EVENT_TYPES = {
  PAYMENT_ADDED: 'payment_added',
  TABLE_UPDATED: 'table_updated',
};