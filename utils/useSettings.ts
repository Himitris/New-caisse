// utils/useSettings.ts
import { useState, useEffect } from 'react';
import { settingsService } from './SettingsService';
import {
  ConfigData,
  RestaurantInfo,
  PaymentMethod,
} from '../app/(tabs)/settings';
import { Setting } from './SettingsContext';

export function useSettings() {
  const [config, setConfig] = useState<ConfigData>(settingsService.getConfig());
  const [isLoaded, setIsLoaded] = useState(settingsService.isSettingsLoaded());
  const [settings, setSettings] = useState<Setting[]>([]); // Ajoutez l'état pour les paramètres
  const [isSaving, setIsSaving] = useState<boolean>(false); // Ajoutez l'état pour isSaving

  useEffect(() => {
    // S'abonner aux changements de configuration
    const unsubscribe = settingsService.addListener(
      'config',
      (newConfig: ConfigData) => {
        setConfig(newConfig);
        setIsLoaded(true);
      }
    );

    // Se désabonner lors du démontage du composant
    return unsubscribe;
  }, []);

  // Ajoutez la fonction toggleSetting
  const toggleSetting = (id: string) => {
    setSettings((prevSettings) =>
      prevSettings.map((setting) =>
        setting.id === id ? { ...setting, value: !setting.value } : setting
      )
    );
  };

  return {
    settings, // Ajoutez settings
    isSaving, // Ajoutez isSaving
    toggleSetting, // Ajoutez toggleSetting
    config,
    isLoaded,
    restaurantInfo: config.restaurantInfo,
    openingHours: config.openingHours,
    paymentMethods: config.paymentMethods,
    enabledPaymentMethods: settingsService.getEnabledPaymentMethods(),
    defaultPaymentMethod: settingsService.getDefaultPaymentMethod(),
    printSettings: config.printSettings,
    updateRestaurantInfo:
      settingsService.updateRestaurantInfo.bind(settingsService),
    updateOpeningHours:
      settingsService.updateOpeningHours.bind(settingsService),
    updatePaymentMethods:
      settingsService.updatePaymentMethods.bind(settingsService),
    updatePrintSettings:
      settingsService.updatePrintSettings.bind(settingsService),
  };
}
  