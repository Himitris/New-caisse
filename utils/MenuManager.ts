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

  static getInstance(): MenuManager {
    if (!MenuManager.instance) {
      MenuManager.instance = new MenuManager();
    }
    return MenuManager.instance;
  }

  // ✅ Chargement simple et unique
  async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.load();
    await this.loadPromise;
    this.loadPromise = null;
  }

  private async load(): Promise<void> {
    try {
      const [customItems, menuAvailability] = await Promise.all([
        getCustomMenuItems(),
        getMenuAvailability(),
      ]);

      // Items standards et personnalisés
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

      this.menuItems = [...standardItems, ...customMenuItems];
      this.menuMap.clear();
      this.menuItems.forEach((item) => this.menuMap.set(item.id, item));

      this.unavailableIds = new Set(
        menuAvailability
          .filter((item) => !item.available)
          .map((item) => item.id)
      );

      this.isLoaded = true;
      console.log(`✅ Menu chargé: ${this.menuItems.length} items`);
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

  reset(): void {
    this.isLoaded = false;
    this.menuItems = [];
    this.menuMap.clear();
    this.unavailableIds.clear();
    this.loadPromise = null;
    console.log('🔄 Menu reset');
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

    const checkLoaded = async () => {
      if (!menuManager.isMenuLoaded()) {
        await menuManager.ensureLoaded();
      }
      if (mountedRef.current) {
        setIsLoaded(true);
      }
    };

    checkLoaded();

    return () => {
      mountedRef.current = false;
    };
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