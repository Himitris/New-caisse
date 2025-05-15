// utils/useSettings.ts
import {
  CreditCard,
  Database,
  Home,
  Lock,
  Printer,
  Wallet,
  Edit3,
} from 'lucide-react-native'; // Importez les icônes nécessaires
import { useCallback, useEffect, useState } from 'react';
import { settingsService } from './SettingsService';
import {
  ConfigData,
  PaymentMethod,
  RestaurantInfo,
  Setting,
} from './settingsTypes';

// Fonction utilitaire pour transformer la config en tableau de settings
const configToSettings = (config: ConfigData): Setting[] => {
  return [
    // Catégorie General
    {
      id: 'restaurant',
      title: 'Informations du restaurant',
      description: 'Modifier les informations du restaurant',
      type: 'action',
      category: 'general',
      value: false,
      icon: Home,
    },

    // Catégorie Payment
    {
      id: 'payment',
      title: 'Méthodes de paiement',
      description: 'Configurer les méthodes de paiement acceptées',
      type: 'action',
      category: 'payment',
      value: false,
      icon: CreditCard,
    },

    // Catégorie Impression
    {
      id: 'autoPrint',
      title: 'Impression automatique',
      description: 'Imprimer automatiquement les reçus après paiement',
      type: 'toggle',
      category: 'printing',
      value: config.printSettings.autoPrint,
      icon: Printer,
    },

    // Catégorie Sécurité
    {
      id: 'changePassword',
      title: 'Changer le mot de passe',
      description: 'Modifier le mot de passe administrateur',
      type: 'action',
      category: 'security',
      value: false,
      icon: Lock,
    },
  ];
};

export function useSettings() {
  const [config, setConfig] = useState<ConfigData>(settingsService.getConfig());
  const [isLoaded, setIsLoaded] = useState(settingsService.isSettingsLoaded());
  const [settings, setSettings] = useState<Setting[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Initialiser settings à partir de config
  useEffect(() => {
    if (config) {
      setSettings(configToSettings(config));
    }
  }, [config]);

  // S'abonner aux changements de configuration
  useEffect(() => {
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

  // Fonction pour basculer l'état d'un paramètre toggle
  const toggleSetting = useCallback(
    async (id: string) => {
      setIsSaving(true);
      try {
        // Mettre à jour l'état local
        setSettings((prevSettings) =>
          prevSettings.map((setting) =>
            setting.id === id ? { ...setting, value: !setting.value } : setting
          )
        );

        // Mettre à jour la configuration dans le service
        const newValue = settings.find((s) => s.id === id)?.value;

        // Gérer les cas spécifiques selon l'ID du paramètre
        switch (id) {
          case 'autoPrint':
            await settingsService.updatePrintSettings({
              ...config.printSettings,
              autoPrint: !config.printSettings.autoPrint,
            });
            break;

          case 'defaultCash':
            if (!newValue) {
              // Définir 'cash' comme méthode par défaut
              const updatedMethods = config.paymentMethods.map((method) => ({
                ...method,
                isDefault: method.id === 'cash',
              }));
              await settingsService.updatePaymentMethods(updatedMethods);
            }
            break;

          // Ajouter d'autres cas selon vos paramètres

          default:
            console.log(`Paramètre ${id} non géré pour la persistance`);
        }
      } catch (error) {
        console.error('Erreur lors de la mise à jour du paramètre:', error);
      } finally {
        setIsSaving(false);
      }
    },
    [settings, config]
  );

  // Fonction pour mettre à jour les informations du restaurant
  const updateRestaurantInfo = useCallback(async (info: RestaurantInfo) => {
    setIsSaving(true);
    try {
      await settingsService.updateRestaurantInfo(info);
    } catch (error) {
      console.error(
        'Erreur lors de la mise à jour des informations du restaurant:',
        error
      );
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Fonction pour mettre à jour les méthodes de paiement
  const updatePaymentMethods = useCallback(async (methods: PaymentMethod[]) => {
    setIsSaving(true);
    try {
      await settingsService.updatePaymentMethods(methods);
    } catch (error) {
      console.error(
        'Erreur lors de la mise à jour des méthodes de paiement:',
        error
      );
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Fonction pour mettre à jour les heures d'ouverture
  const updateOpeningHours = useCallback(async (hours: any) => {
    setIsSaving(true);
    try {
      await settingsService.updateOpeningHours(hours);
    } catch (error) {
      console.error(
        "Erreur lors de la mise à jour des heures d'ouverture:",
        error
      );
    } finally {
      setIsSaving(false);
    }
  }, [])

  return {
    settings,
    config,
    isLoaded,
    isSaving,
    toggleSetting,
    restaurantInfo: config.restaurantInfo,
    openingHours: config.openingHours,
    paymentMethods: config.paymentMethods,
    enabledPaymentMethods: settingsService.getEnabledPaymentMethods(),
    defaultPaymentMethod: settingsService.getDefaultPaymentMethod(),
    printSettings: config.printSettings,
    updateRestaurantInfo,
    updateOpeningHours,
    updatePaymentMethods,
  };
}

