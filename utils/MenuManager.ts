// utils/MenuManager.ts - VERSION AVEC DISPONIBILITÉ
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
  available: boolean; // ✅ Disponibilité importante
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
  private static instance: MenuManager;
  private allItems: MenuItem[] = []; // ✅ TOUS les items
  private isLoaded: boolean = false;

  static getInstance(): MenuManager {
    if (!MenuManager.instance) {
      MenuManager.instance = new MenuManager();
    }
    return MenuManager.instance;
  }

  async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;

    console.log('📦 Chargement menu avec disponibilité...');

    const [customItems, menuAvailability] = await Promise.all([
      getCustomMenuItems(),
      getMenuAvailability(),
    ]);

    // ✅ Map de disponibilité pour lookup rapide
    const availabilityMap = new Map(
      menuAvailability.map((item) => [item.id, item.available])
    );

    // ✅ Items standards avec disponibilité
    const standardItems: MenuItem[] = priceData.map((item: any) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      category: this.getCategoryFromName(item.name, item.type),
      type: item.type as 'resto' | 'boisson',
      color:
        CATEGORY_COLORS[this.getCategoryFromName(item.name, item.type)] ||
        '#757575',
      available: availabilityMap.get(item.id) ?? true, // ✅ Disponible par défaut
    }));

    // ✅ Items personnalisés avec disponibilité
    const customMenuItems: MenuItem[] = customItems.map((item: any) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      type: item.type,
      color: CATEGORY_COLORS[item.category] || '#757575',
      available: item.available ?? true, // ✅ Disponible par défaut
    }));

    this.allItems = [...standardItems, ...customMenuItems];
    this.isLoaded = true;

    console.log(
      `✅ Menu chargé: ${this.allItems.length} items (${
        this.getAvailableItems().length
      } disponibles)`
    );
  }

  // ✅ TOUS les items (disponibles + indisponibles)
  getAllItems(): MenuItem[] {
    return this.allItems;
  }

  // ✅ SEULEMENT les items disponibles
  getAvailableItems(): MenuItem[] {
    return this.allItems.filter((item) => item.available);
  }

  // ✅ Un item spécifique (même indisponible)
  getItem(id: number): MenuItem | undefined {
    return this.allItems.find((item) => item.id === id);
  }

  // ✅ Items par type (SEULEMENT disponibles)
  getItemsByType(type: 'resto' | 'boisson'): MenuItem[] {
    return this.getAvailableItems().filter((item) => item.type === type);
  }

  // ✅ Items par catégorie (SEULEMENT disponibles)
  getItemsByCategory(category: string): MenuItem[] {
    return this.getAvailableItems().filter(
      (item) => item.category === category
    );
  }

  // ✅ Catégories des items disponibles
  getCategories(type?: 'resto' | 'boisson'): string[] {
    const items = type
      ? this.getAvailableItems().filter((item) => item.type === type)
      : this.getAvailableItems();

    return [...new Set(items.map((item) => item.category))].sort();
  }

  // ✅ Changer disponibilité d'un item
  async toggleItemAvailability(itemId: number): Promise<boolean> {
    const item = this.allItems.find((i) => i.id === itemId);
    if (!item) return false;

    // Modification locale immédiate
    item.available = !item.available;

    // Sauvegarde en arrière-plan
    try {
      const currentAvailability = await getMenuAvailability();
      const existingIndex = currentAvailability.findIndex(
        (a) => a.id === itemId
      );

      if (existingIndex >= 0) {
        currentAvailability[existingIndex].available = item.available;
      } else {
        currentAvailability.push({
          id: itemId,
          available: item.available,
          name: item.name,
          price: item.price,
        });
      }

      // Sauvegarde différée
      setTimeout(() => {
        import('./storage').then(({ saveMenuAvailability }) => {
          saveMenuAvailability(currentAvailability);
        });
      }, 100);

      return true;
    } catch (error) {
      // Rollback en cas d'erreur
      item.available = !item.available;
      console.error('Error toggling availability:', error);
      return false;
    }
  }

  isMenuLoaded(): boolean {
    return this.isLoaded;
  }

  reset(): void {
    this.isLoaded = false;
    this.allItems = [];
  }
  
  async refresh(): Promise<void> {
    this.isLoaded = false;
    this.allItems = [];
    await this.ensureLoaded();
  }

  // ✅ Méthodes utilitaires privées
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

export const menuManager = MenuManager.getInstance();

// ✅ Hook React optimisé
export const useMenu = () => {
  const [isLoaded, setIsLoaded] = useState(menuManager.isMenuLoaded());

  useEffect(() => {
    if (!menuManager.isMenuLoaded()) {
      menuManager.ensureLoaded().then(() => setIsLoaded(true));
    }
  }, []);

  return {
    isLoaded,
    refresh: () => menuManager.refresh(),
    getAllItems: () => menuManager.getAllItems(),
    getAvailableItems: () => menuManager.getAvailableItems(),
    getItem: (id: number) => menuManager.getItem(id),
    getItemsByType: (type: 'resto' | 'boisson') =>
      menuManager.getItemsByType(type),
    getItemsByCategory: (category: string) =>
      menuManager.getItemsByCategory(category),
    getCategories: (type?: 'resto' | 'boisson') =>
      menuManager.getCategories(type),
    toggleItemAvailability: (id: number) =>
      menuManager.toggleItemAvailability(id),
  };
};
