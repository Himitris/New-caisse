// utils/MenuManager.ts - VERSION SIMPLE
import { getCustomMenuItems, getMenuAvailability } from './storage';
import priceData from '../helpers/ManjosPrice';
import { useEffect, useState } from 'react';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  type: 'resto' | 'boisson';
  color: string;
  available: boolean;
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
};

class MenuManager {
  private items: MenuItem[] = [];
  private loaded: boolean = false;

  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      const [customItems, availability] = await Promise.all([
        getCustomMenuItems(),
        getMenuAvailability(),
      ]);

      const availabilityMap = new Map(
        availability.map((item) => [item.id, item.available])
      );

      // Items standards
      const standardItems: MenuItem[] = priceData.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        category: this.getCategoryFromName(item.name, item.type),
        type: item.type as 'resto' | 'boisson',
        color:
          CATEGORY_COLORS[this.getCategoryFromName(item.name, item.type)] ||
          '#757575',
        available: availabilityMap.get(item.id) ?? true,
      }));

      // Items personnalisés
      const customMenuItems: MenuItem[] = customItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        type: item.type,
        color: CATEGORY_COLORS[item.category] || '#757575',
        available: item.available ?? true,
      }));

      this.items = [...standardItems, ...customMenuItems];
      this.loaded = true;
    } catch (error) {
      console.error('Error loading menu:', error);
    }
  }

  getAvailableItems(): MenuItem[] {
    return this.items.filter((item) => item.available);
  }

  getAllItems(): MenuItem[] {
    return this.items;
  }

  getItem(id: number): MenuItem | undefined {
    return this.items.find((item) => item.id === id);
  }

  getCategories(type?: 'resto' | 'boisson'): string[] {
    const items = type
      ? this.getAvailableItems().filter((item) => item.type === type)
      : this.getAvailableItems();
    return [...new Set(items.map((item) => item.category))].sort();
  }

  private getCategoryFromName(name: string, type: 'resto' | 'boisson'): string {
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
      if (lowerName.includes('bière')) return 'Bières';
      if (lowerName.includes('vin')) return 'Vins';
      if (lowerName.includes('alcool') || lowerName.includes('ricard'))
        return 'Alcools';
      return 'Softs';
    }
  }
}

export const menuManager = new MenuManager();

export const useMenu = () => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    menuManager.load().then(() => setLoaded(true));
  }, []);

  return {
    isLoaded: loaded,
    getAvailableItems: () => menuManager.getAvailableItems(),
    getAllItems: () => menuManager.getAllItems(),
    getItem: (id: number) => menuManager.getItem(id),
    getCategories: (type?: 'resto' | 'boisson') =>
      menuManager.getCategories(type),
  };
};
