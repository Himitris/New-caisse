// utils/settingsTypes.ts
export interface RestaurantInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  siret: string;
  taxInfo: string;
  owner: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
}

export interface PrintSettings {
  autoPrint: boolean;
  printLogo: boolean;
  printFooter: boolean;
  footerText: string;
}

export interface OpeningHours {
  [day: string]: {
    isOpen: boolean;
    hours: {
      open: string;
      close: string;
    };
  };
}

export interface ConfigData {
  restaurantInfo: RestaurantInfo;
  openingHours: OpeningHours;
  paymentMethods: PaymentMethod[];
  printSettings: PrintSettings;
}

export interface Setting {
  id: string;
  title: string;
  description: string;
  type: 'toggle' | 'action' | 'select';
  category: string;
  value: boolean | string;
  icon: any;
  options?: string[];
}

// Constants
export const SETTINGS_STORAGE_KEY = 'manjo_carn_restaurant_settings';
export const SETTINGS_VALUES_KEY = 'manjo_carn_restaurant_values';

// Setting categories
export const settingsCategories = [
  { id: 'general', name: 'Général' },
  { id: 'payment', name: 'Paiement' },
  { id: 'printing', name: 'Impression' },
  { id: 'security', name: 'Sécurité' },
  { id: 'data', name: 'Données' },
];
