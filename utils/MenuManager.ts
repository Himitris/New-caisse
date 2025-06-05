// utils/MenuManager.ts - SINGLETON MENU MANAGER

import { getCustomMenuItems, getMenuAvailability } from './storage';
import priceData from '../helpers/ManjosPrice';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  type: 'resto' | 'boisson';
  color: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Plats Principaux': '#FF9800',
  'Plats Maxi': '#F44336',
  Salades: '#4CAF50',
  Accompagnements: '#CDDC39',
  Desserts: '#E91E63',
  'Menu Enfant': '#8BC34A',
  Softs: '#03A9F4',
  'Boissons Chaudes': '#795548',
  Bières: '#FFC107',
  Vins: '#9C27B0',
  Alcools: '#673AB7',
  Glaces: '#00BCD4',
} as const;

const getCategoryFromName = (
  name: string,
  type: 'resto' | 'boisson'
): string => {
  const lowerName = name.toLowerCase();
  if (type === 'resto') {
    if (lowerName.includes('salade')) return 'Salades';
    if (lowerName.includes('dessert')) return 'Desserts';
    if (lowerName.includes('frites')) return 'Accompagnements';
    if (lowerName.includes('menu enfant')) return 'Menu Enfant';
    if (lowerName.includes('maxi')) return 'Plats Maxi';
    return 'Plats Principaux';
  } else {
    if (lowerName.includes('glace')) return 'Glaces';
    if (lowerName.includes('thé') || lowerName.includes('café'))
      return 'Boissons Chaudes';
    if (
      lowerName.includes('bière') ||
      lowerName.includes('blonde') ||
      lowerName.includes('ambree')
    )
      return 'Bières';
    if (
      lowerName.includes('vin') ||
      lowerName.includes('pichet') ||
      lowerName.includes('btl')
    )
      return 'Vins';
    if (
      lowerName.includes('apero') ||
      lowerName.includes('digestif') ||
      lowerName.includes('ricard') ||
      lowerName.includes('alcool') ||
      lowerName.includes('punch') ||
      lowerName.includes('cocktail')
    )
      return 'Alcools';
    return 'Softs';
  }
};

class MenuManager {
  private static instance: MenuManager;
  private menuItems: Map<number, MenuItem> = new Map();
  private menuArray: MenuItem[] = [];
  private unavailableItems: Set<number> = new Set();
  private isLoaded: boolean = false;
  private isLoading: boolean = false;
  private loadPromise: Promise<void> | null = null;
  private subscribers: Set<() => void> = new Set();

  static getInstance(): MenuManager {
    if (!MenuManager.instance) {
      MenuManager.instance = new MenuManager();
    }
    return MenuManager.instance;
  }

  // ✅ Chargement unique avec promesse partagée
  async loadMenu(): Promise<void> {
    // Si déjà chargé, retourner immédiatement
    if (this.isLoaded) {
      this.notifySubscribers();
      return;
    }

    // Si déjà en cours de chargement, attendre la promesse existante
    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    // Démarrer le chargement
    this.isLoading = true;
    this.loadPromise = this.performLoad();

    try {
      await this.loadPromise;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  private async performLoad(): Promise<void> {
    try {
      console.log('📦 MenuManager: Début du chargement du menu...');

      const [customItems, menuAvailability] = await Promise.all([
        getCustomMenuItems(),
        getMenuAvailability(),
      ]);

      const standardItems: MenuItem[] = priceData.map((item: any) => {
        const category = getCategoryFromName(
          item.name,
          item.type as 'resto' | 'boisson'
        );
        return {
          id: item.id,
          name: item.name,
          price: item.price,
          category,
          type: item.type as 'resto' | 'boisson',
          color: CATEGORY_COLORS[category] || '#757575',
        };
      });

      const customMenuItems: MenuItem[] = customItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        type: item.type,
        color: CATEGORY_COLORS[item.category] || '#757575',
      }));

      const allItems = [...standardItems, ...customMenuItems];

      // ✅ Mise à jour atomique
      this.menuItems.clear();
      allItems.forEach((item) => this.menuItems.set(item.id, item));
      this.menuArray = allItems;

      this.unavailableItems = new Set(
        menuAvailability
          .filter((item: any) => !item.available)
          .map((item: any) => item.id)
      );

      this.isLoaded = true;

      console.log(`✅ MenuManager: Menu chargé - ${allItems.length} items`);

      // ✅ Notifier tous les abonnés
      this.notifySubscribers();
    } catch (error) {
      console.error('❌ MenuManager: Erreur lors du chargement:', error);
      throw error;
    }
  }

  // ✅ Abonnements pour les composants
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);

    // Si déjà chargé, notifier immédiatement
    if (this.isLoaded) {
      setTimeout(callback, 0);
    }

    // Retourner fonction de désabonnement
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('Erreur dans subscriber callback:', error);
      }
    });
  }

  // ✅ Getters sécurisés
  getMenuItems(): MenuItem[] {
    return [...this.menuArray];
  }

  getMenuItem(id: number): MenuItem | undefined {
    return this.menuItems.get(id);
  }

  getAvailableItems(): MenuItem[] {
    return this.menuArray.filter((item) => !this.unavailableItems.has(item.id));
  }

  getFilteredItems(filters: {
    type?: 'resto' | 'boisson';
    category?: string;
  }): MenuItem[] {
    let filtered = this.getAvailableItems();

    if (filters.type) {
      filtered = filtered.filter((item) => item.type === filters.type);
    }

    if (filters.category) {
      filtered = filtered.filter((item) => item.category === filters.category);
    }

    return filtered;
  }

  getCategories(type?: 'resto' | 'boisson'): string[] {
    const items = type
      ? this.menuArray.filter((item) => item.type === type)
      : this.menuArray;

    return [...new Set(items.map((item) => item.category))].sort();
  }

  isMenuLoaded(): boolean {
    return this.isLoaded;
  }

  // ✅ Invalidation du cache (si besoin)
  invalidateCache(): void {
    this.isLoaded = false;
    this.menuItems.clear();
    this.menuArray = [];
    this.unavailableItems.clear();
    console.log('🔄 MenuManager: Cache invalidé');
  }

  // ✅ Stats pour debug
  getStats(): {
    itemCount: number;
    subscribersCount: number;
    isLoaded: boolean;
  } {
    return {
      itemCount: this.menuArray.length,
      subscribersCount: this.subscribers.size,
      isLoaded: this.isLoaded,
    };
  }
}

// ✅ Export de l'instance singleton
export const menuManager = MenuManager.getInstance();

// ✅ Hook React pour utiliser le menu
import { useEffect, useState } from 'react';

export const useMenu = () => {
  const [isLoaded, setIsLoaded] = useState(menuManager.isMenuLoaded());
  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => {
    // S'abonner aux changements
    const unsubscribe = menuManager.subscribe(() => {
      setIsLoaded(true);
      setForceUpdate((prev) => prev + 1);
    });

    // Charger le menu si pas déjà fait
    if (!menuManager.isMenuLoaded()) {
      menuManager.loadMenu().catch((error) => {
        console.error('Erreur de chargement menu:', error);
      });
    }

    return unsubscribe;
  }, []);

  return {
    isLoaded,
    getMenuItems: () => menuManager.getMenuItems(),
    getFilteredItems: (filters: any) => menuManager.getFilteredItems(filters),
    getCategories: (type?: 'resto' | 'boisson') =>
      menuManager.getCategories(type),
    getMenuItem: (id: number) => menuManager.getMenuItem(id),
    forceUpdate, // Pour forcer les re-renders si nécessaire
  };
};
