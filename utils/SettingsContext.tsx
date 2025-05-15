// utils/SettingsContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { useSettings } from './useSettings';
import {
  ConfigData,
  RestaurantInfo,
  PaymentMethod,
  Setting,
} from './settingsTypes';

type SettingsContextType = {
  settings: Setting[]; // Ajouter cette propriété
  config: ConfigData;
  isLoaded: boolean;
  isSaving: boolean; // Ajouter cette propriété
  toggleSetting: (id: string) => void; // Ajouter cette méthode
  updateSetting?: (id: string, value: any) => Promise<void>;
  restaurantInfo: RestaurantInfo;
  openingHours: any;
  paymentMethods: PaymentMethod[];
  enabledPaymentMethods: PaymentMethod[];
  defaultPaymentMethod: PaymentMethod | undefined;
  printSettings: ConfigData['printSettings'];
  updateRestaurantInfo: (info: RestaurantInfo) => Promise<void>;
  updateOpeningHours: (hours: any) => Promise<void>;
  updatePaymentMethods: (methods: PaymentMethod[]) => Promise<void>;
  updatePrintSettings: (settings: ConfigData['printSettings']) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error(
      'useSettingsContext must be used within a SettingsProvider'
    );
  }
  return context;
}
