// app/(tabs)/index.tsx - Version optimisée et corrigée

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { Coffee, Filter, RefreshCcw, Users } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTableContext } from '../../utils/TableContext';
import { useToast } from '../../utils/ToastContext';
import {
  resetAllTables,
  saveTables,
  Table,
  TABLE_SECTIONS,
  updateTable
} from '../../utils/storage';
import CoversSelectionModal from '../components/CoversSelectionModal';
import CustomCoversModal from '../components/CustomCoversModal';

// Mise en cache des couleurs et gradients des tables
const TABLE_COLORS = {
  available: ['#4CAF50', '#2E7D32'],
  occupied: ['#F44336', '#C62828'],
  reserved: ['#FFC107', '#FFA000'],
  default: ['#E0E0E0', '#9E9E9E'],
} as const;

// Constantes optimisées
const LOADING_DELAY = 200; // ms
const REFRESH_DEBOUNCE = 300; // ms
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ANIMATION_DURATION = 300; // ms

// Système de cache mémoire pour les tables (version corrigée et simplifiée)
const tableCache = {
  data: null as Table[] | null,
  timestamp: 0,
  expiry: 10000, // 10 secondes
  isValid: function () {
    return this.data !== null && Date.now() - this.timestamp < this.expiry;
  },
  set: function (data: Table[]) {
    this.data = [...data]; // Copie profonde pour éviter les références
    this.timestamp = Date.now();
  },
  get: function (): Table[] | null {
    return this.isValid() ? this.data : null;
  },
  invalidate: function () {
    this.timestamp = 0;
  },
};

export default function TablesScreen() {
  const router = useRouter();
  const {
    tables,
    isLoading: tablesLoading,
    refreshTables,
    refreshSingleTable,
  } = useTableContext();
  const [loading, setLoading] = useState(true); // Garder cette variable pour compatibilité
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const toast = useToast();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const refreshRotation = useRef(new Animated.Value(0)).current;

  // États pour les modals
  const [customCoversModalVisible, setCustomCoversModalVisible] =
    useState(false);
  const [coversSelectionModalVisible, setCoversSelectionModalVisible] =
    useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // Mémoïzation des sections
  const sections = useMemo(() => Object.values(TABLE_SECTIONS || {}), []);

  // Mémoïzation des tables par section
  const tablesBySection = useMemo(() => {
    return sections.reduce((acc, section) => {
      acc[section] = tables.filter((table) => {
        if (!table.section) return false;
        return table.section.toLowerCase() === section.toLowerCase();
      });
      return acc;
    }, {} as Record<string, Table[]>);
  }, [tables, sections]);

  // Animation de rotation pour le bouton de rafraîchissement
  const spinRefreshIcon = useCallback(() => {
    refreshRotation.setValue(0);
    Animated.timing(refreshRotation, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [refreshRotation]);

  // Transformation de rotation
  const spin = refreshRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Animation d'entrée
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    setLoading(tablesLoading);
  }, [tablesLoading]);

  useFocusEffect(
    useCallback(() => {
      console.log('Plan du restaurant en focus');

      // Animation d'entrée à chaque focus
      fadeAnim.setValue(0.8);
      slideAnim.setValue(10);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      return () => {
        // Fonction de nettoyage
      };
    }, [fadeAnim, slideAnim])
  );

  // Fonction de rafraîchissement
  const handleRefreshTables = useCallback(() => {
    setRefreshing(true);
    spinRefreshIcon();
    refreshTables().finally(() => {
      setRefreshing(false);
      setLastRefresh(new Date());
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [refreshTables, spinRefreshIcon]);

  const handleResetAllTables = useCallback(() => {
    Alert.alert(
      'Réinitialiser Toutes les Tables',
      'Êtes-vous sûr de vouloir réinitialiser toutes les tables?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            // Retour haptique sur action destructive
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await resetAllTables();
              await refreshTables(); // Au lieu de tableCache.invalidate() et loadTables(true)
              toast.showToast(
                'Toutes les tables ont été réinitialisées.',
                'success'
              );
            } catch (error) {
              console.error('Error resetting tables:', error);
              toast.showToast(
                'Un problème est survenu lors de la réinitialisation des tables.',
                'error'
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, [refreshTables, toast]);

  const openTable = useCallback(
    (table: Table) => {
      // Retour haptique léger lorsqu'on touche une table
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (table.status === 'available') {
        setSelectedTable(table);
        setCoversSelectionModalVisible(true);
      } else if (table.status === 'occupied') {
        router.replace(`/table/${table.id}`);
      } else if (table.status === 'reserved') {
        Alert.alert(
          'Table Réservée',
          `Cette table (${table.name}) est actuellement réservée. Que souhaitez-vous faire?`,
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Rendre Disponible',
              onPress: async () => {
                const updatedTable = { ...table, status: 'available' as const };
                await updateTable(updatedTable);
                refreshTables(); // Rafraîchir les tables via le context
              },
            },
            {
              text: 'Ouvrir Table',
              onPress: () => openTable({ ...table, status: 'available' }),
            },
          ]
        );
      }
    },
    [router, refreshTables]
  );

  // Gérer le nombre de couverts personnalisé
  const handleCustomCovers = useCallback(
    (covers: number) => {
      if (selectedTable) {
        processOpenTable(selectedTable, covers);
      }
    },
    [selectedTable]
  );

  // Gérer la sélection d'un nombre de couverts prédéfini
  const handleSelectCovers = useCallback(
    (covers: number) => {
      if (selectedTable) {
        setCoversSelectionModalVisible(false);
        processOpenTable(selectedTable, covers);
      }
    },
    [selectedTable]
  );

  // Ouvrir le modal de couverts personnalisés
  const handleCustomCoversOpen = useCallback(() => {
    setCoversSelectionModalVisible(false);
    setCustomCoversModalVisible(true);
  }, []);

  // Traiter l'ouverture d'une table avec un nombre spécifique de couverts
  const processOpenTable = useCallback(
    async (table: Table, guestNumber: number) => {
      try {
        // Retour haptique de succès
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Mettre à jour le statut de la table
        const updatedTable: Table = {
          ...table,
          status: 'occupied',
          guests: guestNumber,
          order: {
            id: Date.now(),
            items: [],
            guests: guestNumber,
            status: 'active',
            timestamp: new Date().toISOString(),
            total: 0,
          },
        };

        // Mise à jour dans le stockage
        await saveTables([
          ...tables.map((t) => (t.id === table.id ? updatedTable : t)),
        ]);

        // Rafraîchir les tables via le context
        await refreshTables();

        // Naviguer vers la page de détail de la table
        router.push(`/table/${table.id}`);
      } catch (error) {
        console.error('Error opening table:', error);
        toast.showToast(
          "Impossible d'ouvrir la table. Veuillez réessayer.",
          'error'
        );
      }
    },
    [tables, router, toast, refreshTables]
  );

  const getTableColors = useCallback((status: Table['status']) => {
    return TABLE_COLORS[status] || TABLE_COLORS.default;
  }, []);

  // Toggle section filtering
  const toggleSection = useCallback((section: string) => {
    // Retour haptique léger sur changement de section
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Animation simplifiée
    setActiveSection((current) => (current === section ? null : section));
  }, []);

  // Show all sections or just the active one
  const sectionsToDisplay = useMemo(() => {
    return activeSection ? [activeSection] : sections;
  }, [activeSection, sections]);

  // Rendu simplifié des tables
  const renderTableItem = useCallback(
    (table: Table) => {
      const colorGradient = getTableColors(table.status);
      const tableStatusIcons = {
        available: null,
        occupied: <Coffee size={16} color="white" style={styles.statusIcon} />,
        reserved: null,
      };

      return (
        <Pressable
          key={`table-${table.id}`}
          style={({ pressed }) => [
            styles.table,
            pressed && styles.tablePressed,
          ]}
          onPress={() => openTable(table)}
        >
          <LinearGradient
            colors={colorGradient}
            style={styles.tableGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.tableHeader}>
              <Text style={styles.tableNumber}>{table.name}</Text>
              <View style={styles.tableInfo}>
                <Users size={16} color="white" />
                <Text style={styles.seats}>{table.guests || 0}</Text>
              </View>
            </View>

            <View style={styles.tableContent}>
              {tableStatusIcons[table.status]}
            </View>

            <View style={styles.tableFooter}>
              <Text style={styles.status}>{table.status}</Text>
              {table.order?.items.length ? (
                <Text style={styles.orderInfo}>
                  {table.order.items.length} items -{' '}
                  {table.order.total.toFixed(2)}€
                </Text>
              ) : null}
            </View>
          </LinearGradient>
        </Pressable>
      );
    },
    [getTableColors, openTable]
  );

  const renderSectionContent = useCallback(
    (section: string) => {
      const sectionTables = tablesBySection[section] || [];

      if (sectionTables.length === 0) {
        return (
          <View style={styles.noTablesContainer}>
            <Text style={styles.noTablesText}>
              Aucune table dans cette section
            </Text>
            <Text style={styles.noTablesDetails}>
              Platform: {Platform.OS}, Total Tables: {tables.length}, Section:{' '}
              {section}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.sectionResetButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleResetAllTables}
            >
              <Text style={styles.sectionResetText}>
                Réinitialiser Toutes les Tables
              </Text>
            </Pressable>
          </View>
        );
      }

      return (
        <View style={styles.tablesGrid}>
          {sectionTables.map((table) => renderTableItem(table))}
        </View>
      );
    },
    [tablesBySection, tables.length, handleResetAllTables, renderTableItem]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Chargement des tables...</Text>
      </View>
    );
  }

  if (error || tables.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        {error && <Text style={styles.errorText}>{error}</Text>}
        {tables.length === 0 && (
          <Text style={styles.errorText}>
            Aucune table trouvée. Veuillez initialiser la base de données.
          </Text>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.resetButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleResetAllTables}
        >
          <RefreshCcw size={20} color="white" />
          <Text style={styles.resetButtonText}>
            Réinitialiser Toutes les Tables
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Modal pour le choix du nombre de couverts */}
      <CoversSelectionModal
        visible={coversSelectionModalVisible}
        onClose={() => setCoversSelectionModalVisible(false)}
        onSelectCovers={handleSelectCovers}
        onCustomCovers={handleCustomCoversOpen}
        tableName={selectedTable?.name || ''}
      />

      {/* Modal pour le nombre de couverts personnalisé */}
      <CustomCoversModal
        visible={customCoversModalVisible}
        onClose={() => setCustomCoversModalVisible(false)}
        onConfirm={handleCustomCovers}
        tableName={selectedTable?.name || ''}
      />

      <LinearGradient colors={['#FFFFFF', '#F5F5F5']} style={styles.header}>
        <Text style={styles.title}>Plan du Restaurant</Text>
        <View style={styles.headerButtons}>
          {refreshing && (
            <ActivityIndicator
              size="small"
              color="#2196F3"
              style={{ marginRight: 10 }}
            />
          )}
          <Pressable
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleRefreshTables}
          >
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <RefreshCcw size={20} color="#2196F3" />
            </Animated.View>
            <Text style={styles.refreshButtonText}>Rafraîchir</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.filterButton,
              activeSection && styles.filterButtonInactive,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => setActiveSection(null)}
          >
            <Filter size={20} color={activeSection ? '#666' : '#2196F3'} />
            <Text
              style={[
                styles.filterButtonText,
                { color: activeSection ? '#666' : '#2196F3' },
              ]}
            >
              Tout
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.resetButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleResetAllTables}
          >
            <RefreshCcw size={20} color="white" />
            <Text style={styles.resetButtonText}>Réinitialiser</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <View style={styles.mainContent}>
        <View style={styles.sectionTabs}>
          {sections.map((section) => (
            <Pressable
              key={section}
              style={({ pressed }) => [
                styles.sectionTab,
                activeSection === section && styles.activeTab,
                pressed && styles.sectionTabPressed,
              ]}
              onPress={() => toggleSection(section)}
            >
              <Text
                style={[
                  styles.sectionTabText,
                  activeSection === section && styles.activeTabText,
                ]}
              >
                {section}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.tablesContainer}>
            {sectionsToDisplay.map((section) => (
              <View key={section} style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>{section}</Text>
                {renderSectionContent(section)}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    zIndex: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resetButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    shadowColor: '#F44336',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  resetButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    backgroundColor: 'white',
  },
  refreshButtonText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    backgroundColor: 'white',
  },
  filterButtonInactive: {
    borderColor: '#ddd',
  },
  filterButtonText: {
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  sectionTabs: {
    width: 160,
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    padding: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTab: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#e3f2fd',
  },
  sectionTabPressed: {
    opacity: 0.7,
    backgroundColor: '#f0f0f0',
  },
  sectionTabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
  },
  tablesContainer: {
    flex: 1,
    padding: 20,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
    paddingLeft: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
    paddingVertical: 4,
  },
  noTablesContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    margin: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  noTablesText: {
    textAlign: 'center',
    color: '#856404',
    fontStyle: 'italic',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  noTablesDetails: {
    textAlign: 'center',
    color: '#856404',
    fontSize: 12,
    marginBottom: 10,
  },
  sectionResetButton: {
    backgroundColor: '#F44336',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionResetText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  table: {
    width: 150,
    height: 150,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
    overflow: 'hidden',
  },
  tablePressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  tableGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableFooter: {
    marginTop: 'auto',
  },
  tableNumber: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tableInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.15)',
    padding: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  seats: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  status: {
    color: 'white',
    fontSize: 12,
    textTransform: 'capitalize',
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  statusIcon: {
    marginBottom: 10,
  },
  orderInfo: {
    color: 'white',
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 6,
    fontWeight: '500',
    overflow: 'hidden',
    maxWidth: '100%',
  },
});
