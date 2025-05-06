import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { Users, RefreshCcw, Filter } from 'lucide-react-native';
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

// Mise en cache des couleurs des tables
const TABLE_COLORS = {
  available: '#4CAF50',
  occupied: '#F44336',
  reserved: '#FFC107',
  default: '#E0E0E0',
} as const;

// Constantes optimisées
const LOADING_DELAY = 200; // ms
const REFRESH_DEBOUNCE = 300; // ms

export default function TablesScreen() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const toast = useToast();

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
  }, []);

  // Fonction de rafraîchissement avec debounce
  const handleRefreshTables = useCallback(() => {
    loadTables(false);
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

  const getTableColor = useCallback((status: Table['status']) => {
    return TABLE_COLORS[status] || TABLE_COLORS.default;
  }, []);

  // Toggle section filtering
  const toggleSection = useCallback((section: string) => {
    setActiveSection((current) => (current === section ? null : section));
  }, []);

  // Show all sections or just the active one
  const sectionsToDisplay = useMemo(() => {
    return activeSection ? [activeSection] : sections;
  }, [activeSection, sections]);

  // Rendering optimisations
  const renderTableItem = useCallback(
    (table: Table) => (
      <Pressable
        key={table.id}
        style={[styles.table, { backgroundColor: getTableColor(table.status) }]}
        onPress={() => openTable(table)}
      >
        <Text style={styles.tableNumber}>{table.name}</Text>
        <View style={styles.tableInfo}>
          <Users size={20} color="white" />
          <Text style={styles.seats}>{table.guests || 0}</Text>
        </View>
        <Text style={styles.status}>{table.status}</Text>
        {table.order?.items.length ? (
          <Text style={styles.orderInfo}>
            {table.order.items.length} items - {table.order.total.toFixed(2)}€
          </Text>
        ) : null}
      </Pressable>
    ),
    [getTableColor, openTable]
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
              style={styles.sectionResetButton}
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
          {sectionTables.map(renderTableItem)}
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

        <Pressable style={styles.resetButton} onPress={handleResetAllTables}>
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

      <View style={styles.header}>
        <Text style={styles.title}>Plan du Restaurant</Text>
        <View style={styles.headerButtons}>
          {refreshing && (
            <ActivityIndicator
              size="small"
              color="#2196F3"
              style={{ marginRight: 10 }}
            />
          )}
          <Pressable style={styles.refreshButton} onPress={handleRefreshTables}>
            <RefreshCcw size={20} color="#2196F3" />
            <Text style={styles.refreshButtonText}>Rafraîchir</Text>
          </Pressable>
          <Pressable
            style={styles.filterButton}
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
          <Pressable style={styles.resetButton} onPress={handleResetAllTables}>
            <RefreshCcw size={20} color="white" />
            <Text style={styles.resetButtonText}>Réinitialiser</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.mainContent}>
        <View style={styles.sectionTabs}>
          {sections.map((section) => (
            <Pressable
              key={section}
              style={[
                styles.sectionTab,
                activeSection === section && styles.activeTab,
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

        <ScrollView style={styles.scrollContainer}>
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
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 20,
  },
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
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
    borderColor: '#ddd',
    backgroundColor: 'white',
  },
  filterButtonText: {
    fontWeight: '600',
  },
  sectionTabs: {
    width: 160,
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    padding: 10,
  },
  sectionTab: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#e3f2fd',
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
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  noTablesContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    margin: 10,
    borderRadius: 8,
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
    width: 140,
    height: 140,
    borderRadius: 8,
    padding: 12,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tableNumber: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tableInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seats: {
    color: 'white',
    fontSize: 14,
  },
  status: {
    color: 'white',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  orderInfo: {
    color: 'white',
    fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 4,
    borderRadius: 4,
    marginTop: 4,
  },
});
