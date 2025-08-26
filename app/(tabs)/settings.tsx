// app/(tabs)/settings.tsx - Version modifiée avec easter egg
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trash2 } from 'lucide-react-native';
import React, { useCallback, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSettingsContext } from '../../utils/SettingsContext';
import {
  PaymentMethod,
  RestaurantInfo,
  settingsCategories,
} from '../../utils/settingsTypes';
import {
  getBills,
  getTables,
  resetAllTables,
  saveBills,
  saveMenuAvailability,
} from '../../utils/storage';
import { useToast } from '../../utils/ToastContext';
import PasswordModal from '../components/PasswordModal';
import {
  PaymentMethodsModal,
  RestaurantInfoModal,
} from '../components/SettingsModals';
import SecretPasswordModal from '../components/SecretPasswordModal'; // Import du nouveau composant

interface VersionFooterProps {
  version?: string;
  buildNumber?: string;
  style?: any;
  onSecretTap?: () => void; // Nouvelle prop pour le tap secret
}

// Clés de stockage
export const SETTINGS_STORAGE_KEY = 'manjo_carn_restaurant_settings';
export const SETTINGS_VALUES_KEY = 'manjo_carn_restaurant_values';

export default function SettingsScreen() {
  const [activeCategory, setActiveCategory] = useState<string>('general');
  const {
    settings,
    config,
    isLoaded,
    isSaving,
    toggleSetting,
    updateRestaurantInfo,
    updatePaymentMethods,
    updatePrintSettings,
  } = useSettingsContext();
  const toast = useToast();

  // États pour les modals existants
  const [restaurantInfoModalVisible, setRestaurantInfoModalVisible] =
    useState(false);
  const [hoursModalVisible, setHoursModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [printSettingsModalVisible, setPrintSettingsModalVisible] =
    useState(false);

  // 🔐 États pour le secret easter egg
  const [secretModalVisible, setSecretModalVisible] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 🥚 Fonction pour gérer le tap secret sur la version
  const handleSecretTap = useCallback(() => {
    tapCountRef.current += 1;

    // Réinitialiser le compteur après 3 secondes d'inactivité
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
    }

    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 3000);

    // Si 10 taps sont détectés, montrer le modal secret
    if (tapCountRef.current === 10) {
      tapCountRef.current = 0; // Reset
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
      }

      // Petit effet de vibration/feedback si disponible
      try {
        // Dans une vraie app React Native, vous pourriez utiliser Haptics
        console.log('🥚 Easter egg activé!');
      } catch (error) {
        // Ignore l'erreur si Haptics n'est pas disponible
      }

      setSecretModalVisible(true);
      toast.showToast('🥚 Easter egg découvert !', 'info');
    }

    // Toast intermédiaire supprimé comme demandé
  }, [toast]);

  const handleResetAppData = useCallback(() => {
    Alert.alert(
      'Réinitialiser toutes les données',
      "Attention ! Cette action va supprimer tout l'historique des paiements, les tables ouvertes et les additions en cours. Cette action est irréversible.",
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessingAction(true);

              // Récupérer les tables pour conserver leur configuration
              const tables = await getTables();

              // Réinitialiser toutes les tables (elles seront remises aux valeurs par défaut)
              await resetAllTables();

              // Supprimer tout l'historique des factures
              await saveBills([]);

              // Réinitialiser les données du menu (disponibilité)
              await saveMenuAvailability([]);

              // Optionnel : Réinitialiser les items personnalisés du menu
              // await saveCustomMenuItems([]);

              // Nettoyer les autres données si nécessaire
              const keysToRemove = [
                'manjo_carn_menu_availability',
                // Ajoutez d'autres clés à nettoyer si nécessaire
              ];

              for (const key of keysToRemove) {
                try {
                  await AsyncStorage.removeItem(key);
                } catch (error) {
                  console.warn(`Impossible de supprimer la clé ${key}:`, error);
                }
              }

              toast.showToast(
                'Toutes les données ont été réinitialisées avec succès.',
                'success'
              );
            } catch (error) {
              console.error(
                'Erreur lors de la réinitialisation des données:',
                error
              );
              toast.showToast(
                'Une erreur est survenue lors de la réinitialisation des données.',
                'error'
              );
            } finally {
              setProcessingAction(false);
            }
          },
        },
      ]
    );
  }, [toast]);

  const handleCleanStorage = useCallback(async () => {
    setProcessingAction(true);
    try {
      // Nettoyer les anciennes factures (garder seulement les 30 derniers jours)
      const bills = await getBills();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentBills = bills.filter(
        (bill) => new Date(bill.timestamp) > thirtyDaysAgo
      );

      await saveBills(recentBills);

      // Nettoyer les données temporaires et le cache
      const allKeys = await AsyncStorage.getAllKeys();
      const tempKeys = allKeys.filter(
        (key) =>
          key.includes('temp_') ||
          key.includes('cache_') ||
          key.includes('_backup')
      );

      if (tempKeys.length > 0) {
        await AsyncStorage.multiRemove(tempKeys);
      }

      toast.showToast(
        `Nettoyage terminé. ${
          bills.length - recentBills.length
        } anciennes factures supprimées.`,
        'success'
      );
    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
      toast.showToast('Erreur lors du nettoyage des données', 'error');
    } finally {
      setProcessingAction(false);
    }
  }, [toast]);

  const handleSettingAction = useCallback(
    (id: string) => {
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
        case 'changePassword':
          setPasswordModalVisible(true);
          break;
        case 'printSettings':
          setPrintSettingsModalVisible(true);
          break;
        case 'cleanStorage':
          Alert.alert(
            'Nettoyer les données',
            'Cette action supprimera les anciennes factures (+ de 30 jours) et les données temporaires. Continuer?',
            [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Nettoyer',
                onPress: handleCleanStorage,
              },
            ]
          );
          break;
        default:
          break;
      }
    },
    [handleCleanStorage]
  );

  // Gestionnaires pour les modals
  const handleSaveRestaurantInfo = useCallback(
    (info: RestaurantInfo) => {
      updateRestaurantInfo(info);
      setRestaurantInfoModalVisible(false);
      toast.showToast(
        'Informations du restaurant sauvegardées avec succès.',
        'success'
      );
    },
    [updateRestaurantInfo, toast]
  );

  const handleSavePaymentMethods = useCallback(
    (methods: PaymentMethod[]) => {
      updatePaymentMethods(methods);
      setPaymentModalVisible(false);
      toast.showToast(
        'Méthodes de paiement sauvegardées avec succès.',
        'success'
      );
    },
    [updatePaymentMethods, toast]
  );

  const handleCancel = useCallback(() => {
    setPasswordModalVisible(false);
  }, []);

  // 🔐 Composant VersionFooter modifié avec easter egg
  const VersionFooter: React.FC<VersionFooterProps> = ({
    version = '2.3.0',
    buildNumber = '165',
    style,
    onSecretTap,
  }) => {
    const versionText = buildNumber
      ? `v${version} (${buildNumber})`
      : `v${version}`;

    return (
      <Pressable
        style={[styles.containerVersion, style]}
        onPress={onSecretTap}
        // Désactiver les effets visuels pour rester discret
        android_ripple={null}
        // Augmenter légèrement la zone de tap pour faciliter l'activation
        hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
      >
        <Text style={styles.versionText}>{versionText}</Text>
        {/* Petit indicateur visuel subtil pour ceux qui savent */}
        <Text style={styles.hiddenHint}>🥚</Text>
      </Pressable>
    );
  };

  // Filtrer les paramètres par catégorie active
  const filteredSettings = settings.filter(
    (setting) => setting.category === activeCategory
  );

  if (!isLoaded) {
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
          {settingsCategories.map((category) => (
            <Pressable
              key={category.id}
              style={[
                styles.categoryItem,
                activeCategory === category.id && styles.activeCategoryItem,
              ]}
              onPress={() => setActiveCategory(category.id)}
            >
              <Text
                style={[
                  styles.categoryText,
                  activeCategory === category.id && styles.activeCategoryText,
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
            {settingsCategories.find((cat) => cat.id === activeCategory)?.name}
          </Text>

          {filteredSettings.map((setting) => {
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
                }}
              >
                <View style={styles.settingIcon}>
                  <Icon size={24} color="#666" />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{setting.title}</Text>
                  <Text style={styles.settingDescription}>
                    {setting.description}
                  </Text>
                </View>
                {setting.type === 'toggle' ? (
                  <Switch
                    value={
                      typeof setting.value === 'boolean' ? setting.value : false
                    }
                    onValueChange={() => toggleSetting(setting.id)}
                    trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
                  />
                ) : (
                  <Text style={styles.actionText}>Configurer →</Text>
                )}
              </Pressable>
            );
          })}
          {activeCategory === 'data' && (
            <View style={styles.resetSection}>
              <Text style={styles.resetWarning}>
                Zone dangereuse - Les actions ci-dessous sont irréversibles
              </Text>
              <Pressable
                style={styles.dangerButton}
                onPress={handleResetAppData}
                disabled={processingAction}
              >
                <Trash2 size={24} color="white" />
                <Text style={styles.dangerButtonText}>
                  {processingAction
                    ? 'Réinitialisation...'
                    : 'Réinitialiser toutes les données'}
                </Text>
              </Pressable>
              <Text style={styles.resetDescription}>
                Cette action supprimera tout l'historique des paiements,
                réinitialisera les tables et videra les additions en cours. La
                structure des tables et leurs noms seront conservés.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Footer avec easter egg sur la version */}
      <VersionFooter
        version="2.2.0"
        buildNumber="160"
        style={{ borderTopWidth: 1, borderTopColor: '#e0e0e0' }}
        onSecretTap={handleSecretTap}
      />

      {/* Modals de configuration existants */}
      <RestaurantInfoModal
        visible={restaurantInfoModalVisible}
        onClose={() => setRestaurantInfoModalVisible(false)}
        restaurantInfo={config.restaurantInfo}
        onSave={handleSaveRestaurantInfo}
      />

      <PaymentMethodsModal
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        paymentMethods={config.paymentMethods}
        onSave={handleSavePaymentMethods}
      />

      <PasswordModal
        visible={passwordModalVisible}
        onSuccess={() => {
          setPasswordModalVisible(false);
          toast.showToast('Mot de passe changé avec succès.', 'success');
        }}
        onCancel={handleCancel}
        type="change"
      />

      {/* 🔐 NOUVEAU: Modal secret pour afficher le mot de passe */}
      <SecretPasswordModal
        visible={secretModalVisible}
        onClose={() => setSecretModalVisible(false)}
      />

      {/* Indicateur de sauvegarde */}
      {(isSaving || processingAction) && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.savingText}>
            {processingAction
              ? 'Traitement en cours...'
              : 'Sauvegarde en cours...'}
          </Text>
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
  // ... tous les autres styles existants restent identiques
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    width: '80%',
    maxHeight: '90%',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  formGroup: {
    marginBottom: 20,
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
    backgroundColor: '#fff',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
  modalBody: {
    flex: 1,
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
  disabledInput: {
    backgroundColor: '#f0f0f0',
    color: '#999',
  },
  resetSection: {
    marginTop: 30,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  resetWarning: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  dangerButton: {
    backgroundColor: '#F44336',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dangerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resetDescription: {
    marginTop: 16,
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  defaultBadge: {
    backgroundColor: '#4CAF50',
    color: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  paymentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  editButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  defaultButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  defaultButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  removeButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  removeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  addMethodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  addMethodInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  addMethodButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addMethodButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentMethodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // 🔐 NOUVEAUX STYLES pour l'easter egg
  containerVersion: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  hiddenHint: {
    fontSize: 8,
    opacity: 0.1, // Très discret
    color: '#999',
  },
});
