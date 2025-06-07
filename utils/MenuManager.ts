// utils/MenuManager.ts - VERSION SIMPLIFIÉE

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
      lowerName.includes('ambree') ||
      lowerName.includes('pinte') 
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
      lowerName.includes('cocktail') ||
      lowerName.includes('baby')
    )
      return 'Alcools';
    return 'Softs';
  }
};

class MenuManager {
  private static instance: MenuManager;
  private menuItems: MenuItem[] = [];
  private menuMap: Map<number, MenuItem> = new Map();
  private unavailableIds: Set<number> = new Set();
  private isLoaded: boolean = false;
  private loadPromise: Promise<void> | null = null;
  listeners: Set<() => void> = new Set();

  private cleanupListeners() {
    // ✅ Nettoyer automatiquement si trop de listeners
    if (this.listeners.size > 5) {
      console.warn(
        `⚠️ Trop de listeners MenuManager: ${this.listeners.size}, nettoyage forcé`
      );
      this.listeners.clear();
    }
  }

  static getInstance(): MenuManager {
    if (!MenuManager.instance) {
      MenuManager.instance = new MenuManager();
    }
    return MenuManager.instance;
  }

  // ✅ Chargement simple et unique
  async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.load();
    await this.loadPromise;
    this.loadPromise = null;
  }

  private async load(): Promise<void> {
    try {
      console.log('📦 Chargement du menu...');

      const [customItems, menuAvailability] = await Promise.all([
        getCustomMenuItems(),
        getMenuAvailability(),
      ]);

      // Items standards
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

      // Items personnalisés
      const customMenuItems: MenuItem[] = customItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        type: item.type,
        color: CATEGORY_COLORS[item.category] || '#757575',
      }));

      // Fusion et mise en cache
      this.menuItems = [...standardItems, ...customMenuItems];
      this.menuMap.clear();
      this.menuItems.forEach((item) => this.menuMap.set(item.id, item));

      // Items indisponibles
      this.unavailableIds = new Set(
        menuAvailability
          .filter((item) => !item.available)
          .map((item) => item.id)
      );

      this.isLoaded = true;
      console.log(`✅ Menu chargé: ${this.menuItems.length} items`);

      // Notifier les listeners
      this.listeners.forEach((listener) => {
        try {
          listener();
        } catch (error) {
          console.error('Erreur listener menu:', error);
        }
      });
    } catch (error) {
      console.error('❌ Erreur chargement menu:', error);
      throw error;
    }
  }

  // ✅ API simple
  getItems(): MenuItem[] {
    return this.menuItems;
  }

  getAvailableItems(): MenuItem[] {
    return this.menuItems.filter((item) => !this.unavailableIds.has(item.id));
  }

  getItem(id: number): MenuItem | undefined {
    return this.menuMap.get(id);
  }

  getItemsByType(type: 'resto' | 'boisson'): MenuItem[] {
    return this.getAvailableItems().filter((item) => item.type === type);
  }

  getItemsByCategory(category: string): MenuItem[] {
    return this.getAvailableItems().filter(
      (item) => item.category === category
    );
  }

  getCategories(type?: 'resto' | 'boisson'): string[] {
    const items = type
      ? this.menuItems.filter((item) => item.type === type)
      : this.menuItems;
    return [...new Set(items.map((item) => item.category))].sort();
  }

  isMenuLoaded(): boolean {
    return this.isLoaded;
  }

  // ✅ Abonnements simples
  subscribe(listener: () => void): () => void {
    // ✅ Nettoyage préventif
    this.cleanupListeners();

    this.listeners.add(listener);

    if (this.isLoaded) {
      setTimeout(listener, 0);
    }

    return () => {
      this.listeners.delete(listener);
      // ✅ Nettoyage automatique si set devient vide
      if (this.listeners.size === 0) {
        this.reset();
      }
    };
  }

  // ✅ Reset si nécessaire
  reset(): void {
    this.isLoaded = false;
    this.menuItems = [];
    this.menuMap.clear();
    this.unavailableIds.clear();
    this.listeners.clear(); // ✅ Ajouter cette ligne
    this.loadPromise = null; // ✅ Ajouter cette ligne
    console.log('🔄 Menu reset complet');
  }
}

// ✅ Export singleton
export const menuManager = MenuManager.getInstance();

// ✅ Hook React simple
import { useEffect, useRef, useState } from 'react';

export const useMenu = () => {
  const [isLoaded, setIsLoaded] = useState(menuManager.isMenuLoaded());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (!menuManager.isMenuLoaded()) {
      menuManager.ensureLoaded().catch((error) => {
        console.error('Erreur chargement menu:', error);
      });
    }

    const unsubscribe = menuManager.subscribe(() => {
      if (mountedRef.current) {
        setIsLoaded(true);
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, []);

  // ✅ Nettoyage automatique si trop de listeners
  useEffect(() => {
    const cleanup = setInterval(() => {
      if (menuManager.listeners && menuManager.listeners.size > 10) {
        console.warn(
          '⚠️ Trop de listeners MenuManager:',
          menuManager.listeners.size
        );
      }
    }, 30000);

    return () => clearInterval(cleanup);
  }, []);

  return {
    isLoaded,
    getItems: () => menuManager.getItems(),
    getAvailableItems: () => menuManager.getAvailableItems(),
    getItem: (id: number) => menuManager.getItem(id),
    getItemsByType: (type: 'resto' | 'boisson') =>
      menuManager.getItemsByType(type),
    getItemsByCategory: (category: string) =>
      menuManager.getItemsByCategory(category),
    getCategories: (type?: 'resto' | 'boisson') =>
      menuManager.getCategories(type),
  };
};