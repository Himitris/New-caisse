// utils/SettingsService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SETTINGS_STORAGE_KEY, ConfigData, RestaurantInfo, PaymentMethod } from './settingsTypes';

// Valeurs par défaut pour la configuration
const defaultConfig: ConfigData = {
  restaurantInfo: {
    name: 'Manjo Carn',
    address: 'Route de la Corniche, 82140 Saint Antonin Noble Val',
    phone: 'Tel : 0563682585',
    email: 'contact@manjos.fr',
    siret: 'Siret N° 803 520 998 00011',
    taxInfo: 'TVA non applicable - art.293B du CGI',
    owner: 'Virginie',
  },
  openingHours: [
    'Lundi',
    'Mardi',
    'Mercredi',
    'Jeudi',
    'Vendredi',
    'Samedi',
    'Dimanche',
  ].reduce((obj, day) => {
    return {
      ...obj,
      [day]: {
        isOpen: [
          'Lundi',
          'Mardi',
          'Mercredi',
          'Jeudi',
          'Vendredi',
          'Samedi',
        ].includes(day),
        hours: {
          open: '11:30',
          close: '22:00',
        },
      },
    };
  }, {}),
  paymentMethods: [
    { id: 'cash', name: 'Espèces', enabled: true, isDefault: true },
    { id: 'check', name: 'Chèque', enabled: true, isDefault: false },
    { id: 'card', name: 'Carte Bancaire', enabled: true, isDefault: false },
    {
      id: 'ticket',
      name: 'Ticket Restaurant',
      enabled: true,
      isDefault: false,
    },
  ],
  printSettings: {
    autoPrint: false,
    printLogo: true,
    printFooter: true,
    footerText: 'Merci de votre visite chez Manjo Carn. À bientôt !',
  },
};

class SettingsService {
  private config: ConfigData = defaultConfig;
  private listeners: Map<string, Function[]> = new Map();
  private isLoaded: boolean = false;

  constructor() {
    this.loadSettings();
  }

  private async loadSettings() {
    try {
      // D'abord, vérifions si la clé existe
      const keys = await AsyncStorage.getAllKeys();
      const keyExists = keys.includes(SETTINGS_STORAGE_KEY);

      if (!keyExists) {
        console.log(
          'Première initialisation des paramètres avec les valeurs par défaut'
        );
        // Initialiser immédiatement avec les valeurs par défaut
        await AsyncStorage.setItem(
          SETTINGS_STORAGE_KEY,
          JSON.stringify(defaultConfig)
        );
        this.config = defaultConfig;
        this.isLoaded = true;
        this.notifyListeners('config');
        return;
      }

      // Maintenant, on peut essayer de récupérer la configuration
      const savedConfig = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);

      if (savedConfig) {
        try {
          const parsedConfig = JSON.parse(savedConfig);
          if (parsedConfig && typeof parsedConfig === 'object') {
            this.config = {
              restaurantInfo: {
                ...defaultConfig.restaurantInfo,
                ...(parsedConfig.restaurantInfo || {}),
              },
              openingHours:
                parsedConfig.openingHours || defaultConfig.openingHours,
              paymentMethods: Array.isArray(parsedConfig.paymentMethods)
                ? parsedConfig.paymentMethods
                : defaultConfig.paymentMethods,
              printSettings: {
                ...defaultConfig.printSettings,
                ...(parsedConfig.printSettings || {}),
              },
            };
          }
        } catch (parseError) {
          console.error(
            'Erreur lors du parsing de la configuration:',
            parseError
          );
          // En cas d'erreur de parsing, revenir aux valeurs par défaut
          this.config = defaultConfig;
          await AsyncStorage.setItem(
            SETTINGS_STORAGE_KEY,
            JSON.stringify(defaultConfig)
          );
        }
      } else {
        // Cas qui ne devrait plus se produire grâce à la vérification initiale
        console.log(
          'Configuration non trouvée, utilisation des valeurs par défaut'
        );
        this.config = defaultConfig;
        await AsyncStorage.setItem(
          SETTINGS_STORAGE_KEY,
          JSON.stringify(defaultConfig)
        );
      }

      this.isLoaded = true;
      this.notifyListeners('config');
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres:', error);
      this.config = defaultConfig;

      // Même en cas d'erreur, essayons de sauvegarder les valeurs par défaut
      try {
        await AsyncStorage.setItem(
          SETTINGS_STORAGE_KEY,
          JSON.stringify(defaultConfig)
        );
      } catch (saveError) {
        console.error(
          'Erreur lors de la sauvegarde des paramètres par défaut:',
          saveError
        );
      }
    }
  }

  // Sauvegarder les paramètres dans AsyncStorage
  private async saveSettings() {
    try {
      await AsyncStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(this.config)
      );
      this.notifyListeners('config');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des paramètres:', error);
    }
  }

  // Ajouter un écouteur pour les mises à jour de paramètres
  public addListener(key: string, callback: Function) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key)?.push(callback);

    // Si les paramètres sont déjà chargés, notifier immédiatement
    if (this.isLoaded && key === 'config') {
      callback(this.getConfig());
    }

    return () => this.removeListener(key, callback);
  }

  // Supprimer un écouteur
  public removeListener(key: string, callback: Function) {
    if (this.listeners.has(key)) {
      const keyListeners = this.listeners.get(key);
      if (keyListeners) {
        this.listeners.set(
          key,
          keyListeners.filter((listener) => listener !== callback)
        );
      }
    }
  }

  // Notifier tous les écouteurs d'une clé spécifique
  private notifyListeners(key: string) {
    if (this.listeners.has(key)) {
      const keyListeners = this.listeners.get(key);
      if (keyListeners) {
        keyListeners.forEach((listener) => {
          if (key === 'config') {
            listener(this.getConfig());
          } else if (key === 'restaurantInfo') {
            listener(this.getRestaurantInfo());
          } else if (key === 'paymentMethods') {
            listener(this.getPaymentMethods());
          } else if (key === 'printSettings') {
            listener(this.getPrintSettings());
          }
        });
      }
    }
  }

  // Getters pour les différentes parties de la configuration
  public getConfig(): ConfigData {
    return { ...this.config };
  }

  public getRestaurantInfo(): RestaurantInfo {
    return { ...this.config.restaurantInfo };
  }

  public getOpeningHours() {
    return { ...this.config.openingHours };
  }

  public getPaymentMethods(): PaymentMethod[] {
    return [...this.config.paymentMethods];
  }

  // Obtenir les méthodes de paiement activées
  public getEnabledPaymentMethods(): PaymentMethod[] {
    return this.config.paymentMethods.filter((method) => method.enabled);
  }

  // Obtenir la méthode de paiement par défaut
  public getDefaultPaymentMethod(): PaymentMethod | undefined {
    return this.config.paymentMethods.find(
      (method) => method.isDefault && method.enabled
    );
  }

  public getPrintSettings() {
    return { ...this.config.printSettings };
  }

  // Setters pour mettre à jour les différentes parties de la configuration
  public async updateRestaurantInfo(info: RestaurantInfo) {
    this.config.restaurantInfo = { ...info };
    await this.saveSettings();
    this.notifyListeners('restaurantInfo');
  }

  public async updateOpeningHours(hours: typeof this.config.openingHours) {
    this.config.openingHours = { ...hours };
    await this.saveSettings();
  }

  public async updatePaymentMethods(methods: PaymentMethod[]) {
    this.config.paymentMethods = [...methods];
    await this.saveSettings();
    this.notifyListeners('paymentMethods');
  }

  public async updatePrintSettings(settings: typeof this.config.printSettings) {
    this.config.printSettings = { ...settings };
    await this.saveSettings();
    this.notifyListeners('printSettings');
  }

  // Vérifier si l'application a chargé les paramètres
  public isSettingsLoaded(): boolean {
    return this.isLoaded;
  }
}

// Export une instance singleton du service
export const settingsService = new SettingsService();
