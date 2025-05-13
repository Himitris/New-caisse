import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { Users, RefreshCcw, Filter, Coffee } from 'lucide-react-native';
import {
  getTables,
  saveTables,
  Table,
  resetAllTables,
  TABLE_SECTIONS,
} from '../../utils/storage';
import CustomCoversModal from '../components/CustomCoversModal';
import CoversSelectionModal from '../components/CoversSelectionModal';
import { useToast } from '../../utils/ToastContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

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

export default function TablesScreen() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Chargement initial des tables avec buffer optionnel
  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const initialize = async () => {
      // Delay initial loading slightly to allow UI to render
      timeoutId = setTimeout(() => {
        if (mounted) {
          loadTables(true);
        }
      }, LOADING_DELAY);
    };

    initialize();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  // Rafraîchir les tables à chaque fois que l'écran redevient actif
  useFocusEffect(
    useCallback(() => {
      console.log('Plan du restaurant en focus - rafraîchissement des données');
      
      // Animation d'entrée à chaque focus
      fadeAnim.setValue(0.7);
      slideAnim.setValue(20);
      
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
      
      loadTables(false);
      return () => {
        // Fonction de nettoyage si nécessaire
      };
    }, [])
  );

  const loadTables = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError(null);
    } else {
      setRefreshing(true);
      spinRefreshIcon();
    }

    try {
      // Récupérer les tables depuis le stockage
      const loadedTables = await getTables();

      setTables(loadedTables);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading tables:', error);
      setError(
        'Erreur lors du chargement des tables. Essayez de les réinitialiser.'
      );
    } finally {
      if (showLoading) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, [spinRefreshIcon]);

  // Fonction de rafraîchissement avec debounce
  const handleRefreshTables = useCallback(() => {
    loadTables(false);
    // Retour haptique sur rafraîchissement
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [loadTables]);

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
              await loadTables(true);
              toast.showToast(
                'Toutes les tables ont été réinitialisées.',
                'success',
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
  }, [loadTables, toast]);

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
                const updatedTables = tables.map((t) =>
                  t.id === table.id ? updatedTable : t
                );
                setTables(updatedTables);
                await saveTables(updatedTables);
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
    [router, tables]
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

        // Mettre à jour les tables dans l'état et le stockage
        const updatedTables = tables.map((t) =>
          t.id === table.id ? updatedTable : t
        );
        setTables(updatedTables);
        await saveTables(updatedTables);

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
    [tables, router, toast]
  );

  const getTableColors = useCallback((status: Table['status']) => {
    return TABLE_COLORS[status] || TABLE_COLORS.default;
  }, []);

  // Toggle section filtering
  const toggleSection = useCallback((section: string) => {
    // Retour haptique léger sur changement de section
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Réinitialiser les animations avant de changer de section
    // Cela garantit que les animations ne s'accumulent pas entre les transitions
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0.5,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Changer la section dans le callback d'animation
      setActiveSection((current) => {
        const newActive = current === section ? null : section;
        
        // Réanimer pour entrer la nouvelle section
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
        
        return newActive;
      });
    });
  }, [fadeAnim, slideAnim]);

  // Show all sections or just the active one
  const sectionsToDisplay = useMemo(() => {
    return activeSection ? [activeSection] : sections;
  }, [activeSection, sections]);

  // Référence aux valeurs animées pour chaque table
  // Les rendus avec index * X peuvent causer des problèmes avec recomposition
  const itemFadeAnims = useRef<{[id: string]: Animated.Value}>({}).current;
  const itemSlideAnims = useRef<{[id: string]: Animated.Value}>({}).current;
  
  // Rendus optimisés avec animations
  const renderTableItem = useCallback(
    (table: Table, index: number) => {
      const colorGradient = getTableColors(table.status);
      const tableStatusIcons = {
        available: null,
        occupied: <Coffee size={16} color="white" style={styles.statusIcon} />,
        reserved: null,
      };
      
      // Créer des animations individuelles pour chaque table si elles n'existent pas
      if (!itemFadeAnims[table.id]) {
        itemFadeAnims[table.id] = new Animated.Value(0);
        itemSlideAnims[table.id] = new Animated.Value(20);
        
        // Décaler légèrement l'animation de chaque table
        const delay = index * 50;
        Animated.parallel([
          Animated.timing(itemFadeAnims[table.id], {
            toValue: 1,
            duration: 300,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(itemSlideAnims[table.id], {
            toValue: 0,
            duration: 300,
            delay,
            useNativeDriver: true,
          }),
        ]).start();
      }
      
      return (
        <Animated.View
          key={table.id}
          style={[
            {
              opacity: itemFadeAnims[table.id],
              transform: [{ translateY: itemSlideAnims[table.id] }],
            },
          ]}
        >
          <Pressable
            style={({pressed}) => [
              styles.table,
              pressed && styles.tablePressed
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
                    {table.order.items.length} items - {table.order.total.toFixed(2)}€
                  </Text>
                ) : null}
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      );
    },
    [getTableColors, openTable, itemFadeAnims, itemSlideAnims]
  );

  // Référence pour les animations des sections
  const sectionAnims = useRef<{[section: string]: {fade: Animated.Value, slide: Animated.Value}}>({}).current;
  
  const resetTableAnimations = useCallback(() => {
    // Réinitialiser toutes les animations de table lors d'un changement de section
    Object.keys(itemFadeAnims).forEach(id => {
      itemFadeAnims[id].setValue(0);
      itemSlideAnims[id].setValue(20);
    });
  }, [itemFadeAnims, itemSlideAnims]);
  
  const renderSectionContent = useCallback(
    (section: string) => {
      const sectionTables = tablesBySection[section] || [];
      
      // Créer des animations pour chaque section si elles n'existent pas
      if (!sectionAnims[section]) {
        sectionAnims[section] = {
          fade: new Animated.Value(0),
          slide: new Animated.Value(20)
        };
        
        // Démarrer l'animation d'entrée de section
        Animated.parallel([
          Animated.timing(sectionAnims[section].fade, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(sectionAnims[section].slide, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }

      if (sectionTables.length === 0) {
        return (
          <Animated.View
            style={[
              styles.noTablesContainer,
              {
                opacity: sectionAnims[section].fade,
                transform: [{ translateY: sectionAnims[section].slide }],
              },
            ]}
          >
            <Text style={styles.noTablesText}>
              Aucune table dans cette section
            </Text>
            <Text style={styles.noTablesDetails}>
              Platform: {Platform.OS}, Total Tables: {tables.length}, Section:{' '}
              {section}
            </Text>
            <Pressable
              style={({pressed}) => [
                styles.sectionResetButton,
                pressed && styles.buttonPressed
              ]}
              onPress={handleResetAllTables}
            >
              <Text style={styles.sectionResetText}>
                Réinitialiser Toutes les Tables
              </Text>
            </Pressable>
          </Animated.View>
        );
      }

      return (
        <Animated.View 
          style={[
            styles.tablesGrid,
            {
              opacity: sectionAnims[section].fade,
              transform: [{ translateY: sectionAnims[section].slide }],
            },
          ]}
        >
          {sectionTables.map((table, index) => renderTableItem(table, index))}
        </Animated.View>
      );
    },
    [tablesBySection, tables.length, handleResetAllTables, renderTableItem, sectionAnims]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Animated.Text 
          style={[
            styles.loadingText,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          Chargement des tables...
        </Animated.Text>
      </View>
    );
  }

  if (error || tables.length === 0) {
    return (
      <Animated.View 
        style={[
          styles.loadingContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {error && <Text style={styles.errorText}>{error}</Text>}
        {tables.length === 0 && (
          <Text style={styles.errorText}>
            Aucune table trouvée. Veuillez initialiser la base de données.
          </Text>
        )}

        <Pressable 
          style={({pressed}) => [
            styles.resetButton,
            pressed && styles.buttonPressed
          ]} 
          onPress={handleResetAllTables}
        >
          <RefreshCcw size={20} color="white" />
          <Text style={styles.resetButtonText}>
            Réinitialiser Toutes les Tables
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
        },
      ]}
    >
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

      <LinearGradient
        colors={['#FFFFFF', '#F5F5F5']}
        style={styles.header}
      >
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
            style={({pressed}) => [
              styles.refreshButton,
              pressed && styles.buttonPressed
            ]} 
            onPress={handleRefreshTables}
          >
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <RefreshCcw size={20} color="#2196F3" />
            </Animated.View>
            <Text style={styles.refreshButtonText}>Rafraîchir</Text>
          </Pressable>
          <Pressable
            style={({pressed}) => [
              styles.filterButton,
              activeSection && styles.filterButtonInactive,
              pressed && styles.buttonPressed
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
            style={({pressed}) => [
              styles.resetButton,
              pressed && styles.buttonPressed
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
              style={({pressed}) => [
                styles.sectionTab,
                activeSection === section && styles.activeTab,
                pressed && styles.sectionTabPressed
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

        <Animated.ScrollView 
          style={[
            styles.scrollContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.tablesContainer}>
            {sectionsToDisplay.map((section) => (
              <Animated.View 
                key={section} 
                style={[
                  styles.sectionContainer,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <Text style={styles.sectionTitle}>{section}</Text>
                {renderSectionContent(section)}
              </Animated.View>
            ))}
          </View>
        </Animated.ScrollView>
      </View>
    </Animated.View>
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