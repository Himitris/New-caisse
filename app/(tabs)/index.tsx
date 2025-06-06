// app/(tabs)/index.tsx - VERSION ULTRA-SIMPLE
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Coffee, Filter, RefreshCcw, Users } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  resetAllTables,
  Table,
  getTables,
  updateTable,
} from '../../utils/storage';
import { useToast } from '../../utils/ToastContext';
import CoversSelectionModal from '../components/CoversSelectionModal';
import CustomCoversModal from '../components/CustomCoversModal';

const TABLE_COLORS = {
  available: ['#4CAF50', '#2E7D32'],
  occupied: ['#F44336', '#C62828'],
  reserved: ['#FFC107', '#FFA000'],
} as const;

const SECTIONS = ['Eau', 'Buis'];

export default function TablesScreen() {
  const router = useRouter();
  const toast = useToast();

  // États locaux simples
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Modals
  const [coversModalVisible, setCoversModalVisible] = useState(false);
  const [customCoversModalVisible, setCustomCoversModalVisible] =
    useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // Chargement simple des tables
  const loadTables = useCallback(async () => {
    try {
      const loadedTables = await getTables();
      setTables(loadedTables);
    } catch (error) {
      console.error('Error loading tables:', error);
      toast.showToast('Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  // Sauvegarde périodique simple (toutes les 30 secondes)
  useEffect(() => {
    const interval = setInterval(() => {
      // Sauvegarde silencieuse en arrière-plan
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadTables();
    toast.showToast('Tables mises à jour', 'success');
  }, [loadTables, toast]);

  const handleResetAll = useCallback(() => {
    Alert.alert('Réinitialiser toutes les tables', 'Êtes-vous sûr ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Réinitialiser',
        style: 'destructive',
        onPress: async () => {
          await resetAllTables();
          await loadTables();
          toast.showToast('Tables réinitialisées', 'success');
        },
      },
    ]);
  }, [loadTables, toast]);

  const openTable = useCallback(
    (table: Table) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (table.status === 'available') {
        setSelectedTable(table);
        setCoversModalVisible(true);
      } else if (table.status === 'occupied') {
        router.navigate(`/table/${table.id}`);
      } else if (table.status === 'reserved') {
        Alert.alert('Table Réservée', 'Que voulez-vous faire ?', [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Rendre Disponible',
            onPress: async () => {
              const updatedTable = { ...table, status: 'available' as const };
              await updateTable(updatedTable);
              await loadTables();
            },
          },
          {
            text: 'Ouvrir Table',
            onPress: () => openTable({ ...table, status: 'available' }),
          },
        ]);
      }
    },
    [router, loadTables]
  );

  const processOpenTable = useCallback(
    async (table: Table, guests: number) => {
      try {
        const updatedTable: Table = {
          ...table,
          status: 'occupied',
          guests,
          order: {
            id: Date.now(),
            items: [],
            guests,
            status: 'active',
            timestamp: new Date().toISOString(),
            total: 0,
          },
        };

        await updateTable(updatedTable);
        await loadTables();
        router.navigate(`/table/${table.id}`);
      } catch (error) {
        toast.showToast('Erreur ouverture table', 'error');
      }
    },
    [loadTables, router, toast]
  );

  const handleSelectCovers = useCallback(
    (covers: number) => {
      if (selectedTable) {
        setCoversModalVisible(false);
        processOpenTable(selectedTable, covers);
      }
    },
    [selectedTable, processOpenTable]
  );

  // Filtrage simple
  const displayedTables = tables.filter(
    (table) => !activeSection || table.section === activeSection
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CoversSelectionModal
        visible={coversModalVisible}
        onClose={() => setCoversModalVisible(false)}
        onSelectCovers={handleSelectCovers}
        onCustomCovers={() => {
          setCoversModalVisible(false);
          setCustomCoversModalVisible(true);
        }}
        tableName={selectedTable?.name || ''}
      />

      <CustomCoversModal
        visible={customCoversModalVisible}
        onClose={() => setCustomCoversModalVisible(false)}
        onConfirm={(covers) => {
          if (selectedTable) processOpenTable(selectedTable, covers);
        }}
        tableName={selectedTable?.name || ''}
      />

      {/* Header simple */}
      <LinearGradient colors={['#FFFFFF', '#F5F5F5']} style={styles.header}>
        <Text style={styles.title}>Plan du Restaurant</Text>
        <View style={styles.headerButtons}>
          <Pressable style={styles.refreshButton} onPress={handleRefresh}>
            <RefreshCcw size={20} color="#2196F3" />
            <Text style={styles.refreshButtonText}>Rafraîchir</Text>
          </Pressable>
          <Pressable style={styles.resetButton} onPress={handleResetAll}>
            <RefreshCcw size={20} color="white" />
            <Text style={styles.resetButtonText}>Reset</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <View style={styles.mainContent}>
        {/* Onglets sections */}
        <View style={styles.sectionTabs}>
          <Pressable
            style={[styles.sectionTab, !activeSection && styles.activeTab]}
            onPress={() => setActiveSection(null)}
          >
            <Text
              style={[
                styles.sectionTabText,
                !activeSection && styles.activeTabText,
              ]}
            >
              Tout
            </Text>
          </Pressable>
          {SECTIONS.map((section) => (
            <Pressable
              key={section}
              style={[
                styles.sectionTab,
                activeSection === section && styles.activeTab,
              ]}
              onPress={() => setActiveSection(section)}
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

        {/* Grille des tables */}
        <ScrollView style={styles.scrollContainer}>
          <View style={styles.tablesContainer}>
            {SECTIONS.map((section) => {
              if (activeSection && activeSection !== section) return null;

              const sectionTables = displayedTables.filter(
                (t) => t.section === section
              );

              return (
                <View key={section} style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>{section}</Text>
                  <View style={styles.tablesGrid}>
                    {sectionTables.map((table) => (
                      <Pressable
                        key={table.id}
                        style={styles.table}
                        onPress={() => openTable(table)}
                      >
                        <LinearGradient
                          colors={TABLE_COLORS[table.status]}
                          style={styles.tableGradient}
                        >
                          <View style={styles.tableHeader}>
                            <Text style={styles.tableNumber}>{table.name}</Text>
                            <View style={styles.tableInfo}>
                              <Users size={16} color="white" />
                              <Text style={styles.seats}>
                                {table.guests || 0}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.tableContent}>
                            {table.status === 'occupied' && (
                              <Coffee size={16} color="white" />
                            )}
                          </View>

                          <View style={styles.tableFooter}>
                            <Text style={styles.status}>{table.status}</Text>
                            {table.order?.total && (
                              <Text style={styles.orderInfo}>
                                {table.order.items.length} items -{' '}
                                {table.order.total.toFixed(2)}€
                              </Text>
                            )}
                          </View>
                        </LinearGradient>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

// Styles conservés (mêmes que l'original)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  headerButtons: { flexDirection: 'row', gap: 12 },
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
  refreshButtonText: { color: '#2196F3', fontWeight: '600' },
  resetButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  resetButtonText: { color: 'white', fontWeight: '600' },
  mainContent: { flex: 1, flexDirection: 'row' },
  sectionTabs: {
    width: 160,
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    padding: 10,
  },
  sectionTab: { padding: 12, marginBottom: 8, borderRadius: 8 },
  activeTab: { backgroundColor: '#e3f2fd' },
  sectionTabText: { fontSize: 16, fontWeight: '500', color: '#666' },
  activeTabText: { color: '#2196F3', fontWeight: '600' },
  scrollContainer: { flex: 1 },
  tablesContainer: { flex: 1, padding: 20 },
  sectionContainer: { marginBottom: 24 },
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
  tablesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  table: { width: 150, height: 150, borderRadius: 12, overflow: 'hidden' },
  tableGradient: { flex: 1, padding: 16, justifyContent: 'space-between' },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tableFooter: { marginTop: 'auto' },
  tableNumber: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  tableInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.15)',
    padding: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  seats: { color: 'white', fontSize: 14, fontWeight: '500' },
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
  },
});
