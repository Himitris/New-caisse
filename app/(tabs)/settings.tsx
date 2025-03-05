// app/(tabs)/settings.tsx - Paramètres complètement fonctionnels

import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Store, Clock, DollarSign, Printer, Bell, Shield, CircleHelp as HelpCircle, Users, LayoutGrid, X, Save } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_STORAGE_KEY = 'restaurant_settings';
const DAYS_OF_WEEK = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

interface Setting {
  id: string;
  title: string;
  description: string;
  type: 'toggle' | 'action';
  value?: boolean;
  icon: any;
  category: 'general' | 'restaurant' | 'payment' | 'security';
}

interface TaxSettings {
  enabled: boolean;
  rate: number;
}

interface TimeRange {
  open: string;
  close: string;
}

interface OpeningHours {
  [key: string]: {
    isOpen: boolean;
    hours: TimeRange;
  };
}

interface RestaurantInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
}

interface ConfigData {
  restaurantInfo: RestaurantInfo;
  openingHours: OpeningHours;
  paymentMethods: {
    cash: boolean;
    card: boolean;
    mobilePayment: boolean;
  };
  taxSettings: TaxSettings;
}

interface TaxModalProps {
  visible: boolean;
  onClose: () => void;
  taxSettings: TaxSettings;
  onSave: (settings: TaxSettings) => void;
}

interface InfoModalProps {
  visible: boolean;
  onClose: () => void;
  restaurantInfo: RestaurantInfo;
  onSave: (info: RestaurantInfo) => void;
}

interface HoursModalProps {
  visible: boolean;
  onClose: () => void;
  openingHours: OpeningHours;
  onSave: (hours: OpeningHours) => void;
}

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  paymentMethods: {
    cash: boolean;
    card: boolean;
    mobilePayment: boolean;
  };
  onSave: (methods: any) => void;
}

const TaxSettingsModal: React.FC<TaxModalProps> = ({
  visible,
  onClose,
  taxSettings = { enabled: false, rate: 0 },
  onSave
}) => {
  const [enabled, setEnabled] = useState(taxSettings?.enabled ?? false);
  const [rate, setRate] = useState(taxSettings?.rate?.toString() ?? "0");


  useEffect(() => {
    if (taxSettings) {
      setEnabled(taxSettings.enabled ?? false);
      setRate(taxSettings.rate !== undefined ? taxSettings.rate.toString() : "0");
    }
  }, [taxSettings]);

  const handleSave = () => {
    const parsedRate = parseFloat(rate);
    if (isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100) {
      Alert.alert('Erreur', 'Veuillez entrer un taux de TVA valide entre 0 et 100.');
      return;
    }

    onSave({
      enabled: parsedRate > 0, // Activer automatiquement si le taux est supérieur à 0
      rate: parsedRate
    });
    onClose();
  };

  const handleRateChange = (text: string) => {
    setRate(text);

    // Ne pas désactiver la TVA si l'utilisateur tape temporairement un nombre incomplet
    const parsedRate = parseFloat(text);
    if (!isNaN(parsedRate)) {
      setEnabled(parsedRate > 0);
    }
  };


  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Configuration des Taxes</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#666" />
            </Pressable>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Activer la TVA:</Text>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
            />
            <Text style={styles.taxNote}>
              {enabled
                ? "La TVA sera affichée sur les factures et reçus"
                : "La TVA ne sera pas affichée (art.293B du CGI)"}
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Taux de TVA (%):</Text>
            <TextInput
              style={[
                styles.input,
                !enabled ? styles.disabledInput : null
              ]}
              value={rate}
              onChangeText={handleRateChange}
              keyboardType="numeric"
              placeholder="0.0"
              editable={true} // Le champ est toujours éditable
            />
          </View>

          <Pressable style={styles.saveButton} onPress={handleSave}>
            <Save size={20} color="white" />
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

// Modal de configuration des informations du restaurant
const RestaurantInfoModal: React.FC<InfoModalProps> = ({
  visible,
  onClose,
  restaurantInfo,
  onSave
}) => {
  const [name, setName] = useState(restaurantInfo.name);
  const [address, setAddress] = useState(restaurantInfo.address);
  const [phone, setPhone] = useState(restaurantInfo.phone);
  const [email, setEmail] = useState(restaurantInfo.email);

  useEffect(() => {
    // Mise à jour des valeurs si les props changent
    setName(restaurantInfo.name);
    setAddress(restaurantInfo.address);
    setPhone(restaurantInfo.phone);
    setEmail(restaurantInfo.email);
  }, [restaurantInfo]);

  const handleSave = () => {
    onSave({
      name,
      address,
      phone,
      email
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Informations du Restaurant</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#666" />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nom du restaurant:</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Nom du restaurant"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Adresse:</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="Adresse complète"
                multiline
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Téléphone:</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Numéro de téléphone"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email:</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Adresse email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </ScrollView>

          <Pressable style={styles.saveButton} onPress={handleSave}>
            <Save size={20} color="white" />
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

// Modal pour configurer les heures d'ouverture
const OpeningHoursModal: React.FC<HoursModalProps> = ({
  visible,
  onClose,
  openingHours,
  onSave
}) => {
  const [hours, setHours] = useState<OpeningHours>(openingHours);

  useEffect(() => {
    setHours(openingHours);
  }, [openingHours]);

  const handleToggleDay = (day: string) => {
    setHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        isOpen: !prev[day].isOpen
      }
    }));
  };

  const handleChangeHours = (day: string, field: 'open' | 'close', value: string) => {
    setHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        hours: {
          ...prev[day].hours,
          [field]: value
        }
      }
    }));
  };

  const handleSave = () => {
    onSave(hours);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Heures d'Ouverture</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#666" />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody}>
            {DAYS_OF_WEEK.map(day => (
              <View key={day} style={styles.dayRow}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayName}>{day}</Text>
                  <Switch
                    value={hours[day].isOpen}
                    onValueChange={() => handleToggleDay(day)}
                    trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
                  />
                </View>

                {hours[day].isOpen && (
                  <View style={styles.hoursInputs}>
                    <View style={styles.timeInput}>
                      <Text style={styles.timeLabel}>Ouverture:</Text>
                      <TextInput
                        style={styles.timeField}
                        value={hours[day].hours.open}
                        onChangeText={(value) => handleChangeHours(day, 'open', value)}
                        placeholder="09:00"
                        keyboardType="numbers-and-punctuation"
                      />
                    </View>

                    <View style={styles.timeInput}>
                      <Text style={styles.timeLabel}>Fermeture:</Text>
                      <TextInput
                        style={styles.timeField}
                        value={hours[day].hours.close}
                        onChangeText={(value) => handleChangeHours(day, 'close', value)}
                        placeholder="22:00"
                        keyboardType="numbers-and-punctuation"
                      />
                    </View>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          <Pressable style={styles.saveButton} onPress={handleSave}>
            <Save size={20} color="white" />
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

// Modal pour configurer les méthodes de paiement
const PaymentMethodsModal: React.FC<PaymentModalProps> = ({
  visible,
  onClose,
  paymentMethods,
  onSave
}) => {
  const [methods, setMethods] = useState(paymentMethods);

  useEffect(() => {
    setMethods(paymentMethods);
  }, [paymentMethods]);

  const toggleMethod = (method: 'cash' | 'card' | 'mobilePayment') => {
    setMethods(prev => ({
      ...prev,
      [method]: !prev[method]
    }));
  };

  const handleSave = () => {
    onSave(methods);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Méthodes de Paiement</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#666" />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.paymentMethod}>
              <Text style={styles.paymentMethodTitle}>Espèces</Text>
              <Switch
                value={methods.cash}
                onValueChange={() => toggleMethod('cash')}
                trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
              />
            </View>

            <View style={styles.paymentMethod}>
              <Text style={styles.paymentMethodTitle}>Carte Bancaire</Text>
              <Switch
                value={methods.card}
                onValueChange={() => toggleMethod('card')}
                trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
              />
            </View>

            <View style={styles.paymentMethod}>
              <Text style={styles.paymentMethodTitle}>Paiement Mobile</Text>
              <Switch
                value={methods.mobilePayment}
                onValueChange={() => toggleMethod('mobilePayment')}
                trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
              />
            </View>
          </ScrollView>

          <Pressable style={styles.saveButton} onPress={handleSave}>
            <Save size={20} color="white" />
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

export default function SettingsScreen() {
  const [activeCategory, setActiveCategory] = useState<string>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [taxModalVisible, setTaxModalVisible] = useState(false);

  // États pour les modals
  const [restaurantInfoModalVisible, setRestaurantInfoModalVisible] = useState(false);
  const [hoursModalVisible, setHoursModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);

  // Configuration par défaut
  const defaultConfig: ConfigData = {
    restaurantInfo: {
      name: 'Manjo Carn',
      address: 'Route de la Corniche, 82140 Saint Antonin Noble Val',
      phone: 'Tel : 0563682585',
      email: 'contact@manjos.fr',
    },
    openingHours: DAYS_OF_WEEK.reduce((obj, day) => {
      return {
        ...obj,
        [day]: {
          isOpen: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].includes(day),
          hours: {
            open: '11:30',
            close: '22:00',
          }
        }
      };
    }, {}),
    paymentMethods: {
      cash: true,
      card: true,
      mobilePayment: false,
    },
    taxSettings: {
      enabled: false,
      rate: 0
    }
  };

  // État pour la configuration
  const [config, setConfig] = useState<ConfigData>(defaultConfig);

  // État pour les paramètres
  const [settings, setSettings] = useState<Setting[]>([
    // Général
    {
      id: 'notifications',
      title: 'Notifications Push',
      description: 'Recevoir des alertes pour les nouvelles commandes et les changements de statut des tables',
      type: 'toggle',
      value: true,
      icon: Bell,
      category: 'general',
    },
    {
      id: 'autoPrint',
      title: 'Impression automatique',
      description: 'Imprimer automatiquement les reçus lors du paiement des factures',
      type: 'toggle',
      value: false,
      icon: Printer,
      category: 'general',
    },
    {
      id: 'darkMode',
      title: 'Mode sombre',
      description: 'Utiliser un thème sombre pour l\'application',
      type: 'toggle',
      value: false,
      icon: LayoutGrid,
      category: 'general',
    },

    // Restaurant
    {
      id: 'restaurant',
      title: 'Informations du restaurant',
      description: 'Mettre à jour les détails de votre restaurant et vos coordonnées',
      type: 'action',
      icon: Store,
      category: 'restaurant',
    },
    {
      id: 'hours',
      title: 'Heures d\'ouverture',
      description: 'Définir les heures d\'ouverture de votre restaurant',
      type: 'action',
      icon: Clock,
      category: 'restaurant',
    },
    {
      id: 'tables',
      title: 'Configuration des tables',
      description: 'Gérer la disposition et les noms des tables',
      type: 'action',
      icon: Users,
      category: 'restaurant',
    },

    // Paiement
    {
      id: 'payment',
      title: 'Modes de paiement',
      description: 'Gérer les méthodes de paiement acceptées et les intégrations',
      type: 'action',
      icon: DollarSign,
      category: 'payment',
    },
    {
      id: 'taxes',
      title: 'Taxes et frais',
      description: 'Configurer les taux de TVA et autres frais',
      type: 'action',
      icon: DollarSign,
      category: 'payment',
    },

    // Sécurité
    {
      id: 'security',
      title: 'Paramètres de sécurité',
      description: 'Gérer les autorisations des utilisateurs et les contrôles d\'accès',
      type: 'action',
      icon: Shield,
      category: 'security',
    },
    {
      id: 'help',
      title: 'Aide & Support',
      description: 'Obtenir de l\'aide pour utiliser le système de point de vente',
      type: 'action',
      icon: HelpCircle,
      category: 'security',
    },
  ]);

  const categories = [
    { id: 'general', name: 'Général' },
    { id: 'restaurant', name: 'Restaurant' },
    { id: 'payment', name: 'Paiement' },
    { id: 'security', name: 'Sécurité & Support' }
  ];

  // Charger les paramètres sauvegardés
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);

        // Charger la configuration
        const savedConfig = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (savedConfig) {
          setConfig(JSON.parse(savedConfig));
        }

        // Charger les paramètres
        const savedSettings = await AsyncStorage.getItem('settings_values');
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings);

          setSettings(prev => prev.map(setting => {
            const savedSetting = parsedSettings.find((s: any) => s.id === setting.id);
            if (savedSetting && setting.type === 'toggle') {
              return { ...setting, value: savedSetting.value };
            }
            return setting;
          }));
        }
      } catch (error) {
        console.error('Erreur au chargement des paramètres:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSaveTaxSettings = (settings: TaxSettings) => {
    setConfig(prev => ({
      ...prev,
      taxSettings: settings
    }));

    // Sauvegarder automatiquement
    setTimeout(saveSettings, 100);
  };

  // Sauvegarder les paramètres
  const saveSettings = async () => {
    try {
      setSaving(true);

      // Sauvegarder la configuration
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(config));

      // Sauvegarder les paramètres
      const toggleSettings = settings
        .filter(setting => setting.type === 'toggle')
        .map(setting => ({ id: setting.id, value: setting.value }));

      await AsyncStorage.setItem('settings_values', JSON.stringify(toggleSettings));

      Alert.alert('Succès', 'Paramètres sauvegardés avec succès.');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des paramètres:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder les paramètres.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = (id: string) => {
    setSettings(settings.map(setting =>
      setting.id === id ? { ...setting, value: !setting.value } : setting
    ));

    // Sauvegarder automatiquement après chaque changement
    setTimeout(saveSettings, 100);
  };

  const handleSettingAction = (id: string) => {
    switch (id) {
      case 'restaurant':
        setRestaurantInfoModalVisible(true);
        break;
      case 'hours':
        setHoursModalVisible(true);
        break;
      case 'payment':
        setPaymentModalVisible(true);
        break;
      case 'tables':
        Alert.alert('Information', 'Configuration des tables disponible dans une future mise à jour.');
        break;
      case 'taxes':
        setTaxModalVisible(true);
        break;
      case 'security':
        Alert.alert('Information', 'Paramètres de sécurité disponibles dans une future mise à jour.');
        break;
      case 'help':
        Alert.alert(
          'Aide & Support',
          'Pour toute assistance, contactez le support technique au 01 23 45 67 89 ou consultez la documentation en ligne.'
        );
        break;
      default:
        break;
    }
  };

  // Gestionnaires pour les modals
  const handleSaveRestaurantInfo = (info: RestaurantInfo) => {
    setConfig(prev => ({
      ...prev,
      restaurantInfo: info
    }));

    // Sauvegarder automatiquement
    setTimeout(saveSettings, 100);
  };

  const handleSaveOpeningHours = (hours: OpeningHours) => {
    setConfig(prev => ({
      ...prev,
      openingHours: hours
    }));

    // Sauvegarder automatiquement
    setTimeout(saveSettings, 100);
  };

  const handleSavePaymentMethods = (methods: any) => {
    setConfig(prev => ({
      ...prev,
      paymentMethods: methods
    }));

    // Sauvegarder automatiquement
    setTimeout(saveSettings, 100);
  };

  // Filtrer les paramètres par catégorie active
  const filteredSettings = settings.filter(setting => setting.category === activeCategory);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement des paramètres...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Paramètres</Text>
      </View>

      <View style={styles.content}>
        {/* Sidebar avec catégories */}
        <View style={styles.sidebar}>
          {categories.map(category => (
            <Pressable
              key={category.id}
              style={[
                styles.categoryItem,
                activeCategory === category.id && styles.activeCategoryItem
              ]}
              onPress={() => setActiveCategory(category.id)}
            >
              <Text
                style={[
                  styles.categoryText,
                  activeCategory === category.id && styles.activeCategoryText
                ]}
              >
                {category.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Liste des paramètres */}
        <ScrollView style={styles.settingsList}>
          <Text style={styles.categoryTitle}>
            {categories.find(cat => cat.id === activeCategory)?.name}
          </Text>

          {filteredSettings.map(setting => {
            const Icon = setting.icon;
            return (
              <Pressable
                key={setting.id}
                style={styles.settingItem}
                onPress={() => {
                  if (setting.type === 'toggle') {
                    toggleSetting(setting.id);
                  } else if (setting.type === 'action') {
                    handleSettingAction(setting.id);
                  }
                }}>
                <View style={styles.settingIcon}>
                  <Icon size={24} color="#666" />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{setting.title}</Text>
                  <Text style={styles.settingDescription}>{setting.description}</Text>
                </View>
                {setting.type === 'toggle' ? (
                  <Switch
                    value={setting.value}
                    onValueChange={() => toggleSetting(setting.id)}
                    trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
                  />
                ) : (
                  <Text style={styles.actionText}>Configurer →</Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Modals de configuration */}
      <RestaurantInfoModal
        visible={restaurantInfoModalVisible}
        onClose={() => setRestaurantInfoModalVisible(false)}
        restaurantInfo={config.restaurantInfo}
        onSave={handleSaveRestaurantInfo}
      />

      <OpeningHoursModal
        visible={hoursModalVisible}
        onClose={() => setHoursModalVisible(false)}
        openingHours={config.openingHours}
        onSave={handleSaveOpeningHours}
      />

      <PaymentMethodsModal
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        paymentMethods={config.paymentMethods}
        onSave={handleSavePaymentMethods}
      />

      <TaxSettingsModal
        visible={taxModalVisible}
        onClose={() => setTaxModalVisible(false)}
        taxSettings={config.taxSettings ?? { enabled: false, rate: 0 }} // 👈 Valeur par défaut
        onSave={handleSaveTaxSettings}
      />

      {/* Indicateur de sauvegarde */}
      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.savingText}>Sauvegarde en cours...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 200,
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    padding: 16,
  },
  categoryItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  activeCategoryItem: {
    backgroundColor: '#e3f2fd',
  },
  categoryText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  activeCategoryText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  settingsList: {
    flex: 1,
    padding: 20,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    color: '#333',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  actionText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    width: '60%',
    maxHeight: '80%',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  modalBody: {
    flex: 1,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  dayRow: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
  },
  hoursInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  timeInput: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 14,
    marginBottom: 8,
    color: '#666',
  },
  timeField: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  paymentMethod: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingText: {
    color: 'white',
    marginTop: 12,
    fontSize: 16,
  },
  taxNote: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  disabledInput: {
    backgroundColor: '#f0f0f0',
    color: '#999',
  },

});