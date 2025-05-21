// utils/events.ts
type EventCallback = (...args: any[]) => void;

class EventEmitter {
  private events: Record<string, EventCallback[]> = {};
  private lastEventParams: Record<string, any[]> = {}; // Pour stocker les derniers paramètres d'événement

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
    // Vérifier si c'est un événement identique au dernier (pour éviter les boucles)
    const lastParams = this.lastEventParams[event];
    
    // Fonction pour comparer les arguments d'événements
    const areArgsEqual = (args1: any[], args2: any[]): boolean => {
      if (!args1 || !args2 || args1.length !== args2.length) return false;
      
      // Comparaison simple des arguments
      for (let i = 0; i < args1.length; i++) {
        if (args1[i] !== args2[i]) return false;
      }
      
      return true;
    };
    
    // Enregistrer ce nouvel événement comme le dernier
    this.lastEventParams[event] = [...args];

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