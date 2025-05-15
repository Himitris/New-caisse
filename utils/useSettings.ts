// utils/useSettings.ts
import { useState, useEffect } from 'react';
import { settingsService } from './SettingsService';
import {
  ConfigData,
  RestaurantInfo,
  PaymentMethod,
} from '../app/(tabs)/settings';

export function useSettings() {
  const [config, setConfig] = useState<ConfigData>(settingsService.getConfig());
  const [isLoaded, setIsLoaded] = useState(settingsService.isSettingsLoaded());

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

  return {
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
