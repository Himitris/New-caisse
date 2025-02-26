// app/(tabs)/index.tsx - Fix tables display

import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Users, RefreshCcw, Filter } from 'lucide-react-native';
import { getTables, saveTables, Table, resetAllTables, TABLE_SECTIONS } from '../../utils/storage';

export default function TablesScreen() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    setLoading(true);
    try {
      const loadedTables = await getTables();
      console.log("Loaded tables:", loadedTables.length);
      setTables(loadedTables);
    } catch (error) {
      console.error("Error loading tables:", error);
      // If error loading, use a fallback
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetAllTables = async () => {
    Alert.alert(
      'Reset All Tables',
      'Are you sure you want to reset all tables to available?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
            await resetAllTables();
            loadTables();
          }
        }
      ]
    );
  };

  const openTable = (table: Table) => {
    if (table.status === 'available') {
      // Use a more cross-platform approach with Alert.alert instead of Alert.prompt
      Alert.alert(
        'Open Table',
        `Enter number of guests for ${table.name}:`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: '1 Guest',
            onPress: async () => processOpenTable(table, 1)
          },
          {
            text: '2 Guests',
            onPress: async () => processOpenTable(table, 2)
          },
          {
            text: '4 Guests',
            onPress: async () => processOpenTable(table, 4)
          },
          {
            text: 'Other...',
            onPress: () => {
              // For custom guest count in a real app, you'd use a modal with input
              processOpenTable(table, 2);
            }
          }
        ]
      );
    } else if (table.status === 'occupied') {
      router.push(`/table/${table.id}`);
    } else if (table.status === 'reserved') {
      Alert.alert(
        'Reserved Table',
        `This table (${table.name}) is currently reserved. Would you like to change its status?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Make Available', 
            onPress: async () => {
              const updatedTable = { ...table, status: 'available' as const };
              const updatedTables = tables.map(t => 
                t.id === table.id ? updatedTable : t
              );
              setTables(updatedTables);
              await saveTables(updatedTables);
            }
          },
          { 
            text: 'Open Table', 
            onPress: () => openTable({ ...table, status: 'available' }) 
          }
        ]
      );
    }
  };

  // Helper function to process opening a table with a specific guest count
  const processOpenTable = async (table: Table, guestNumber: number) => {
    try {
      // Update table status
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
          total: 0
        }
      };

      // Update tables in state and storage
      const updatedTables = tables.map(t => 
        t.id === table.id ? updatedTable : t
      );
      setTables(updatedTables);
      await saveTables(updatedTables);

      // Navigate to table detail
      router.push(`/table/${table.id}`);
    } catch (error) {
      console.error("Error opening table:", error);
      Alert.alert("Error", "Could not open table. Please try again.");
    }
  };

  const getTableColor = (status: Table['status']) => {
    switch (status) {
      case 'available':
        return '#4CAF50';
      case 'occupied':
        return '#F44336';
      case 'reserved':
        return '#FFC107';
      default:
        return '#E0E0E0';
    }
  };

  // Get all available sections
  const sections = Object.values(TABLE_SECTIONS || {});

  // Filter tables by section
  const getTablesBySection = (section: string) => {
    console.log("Filtering tables by section:", section);
    return tables.filter(table => table.section === section);
  };

  // Toggle section filtering
  const toggleSection = (section: string) => {
    if (activeSection === section) {
      setActiveSection(null); // Show all sections
    } else {
      setActiveSection(section); // Filter to just this section
    }
  };

  // Show all sections or just the active one
  const sectionsToDisplay = activeSection ? [activeSection] : sections;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading tables...</Text>
      </View>
    );
  }

  // Debug check - no tables
  if (tables.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text>No tables found. Please initialize your database.</Text>
        <Pressable 
          style={styles.resetButtonBig} 
          onPress={handleResetAllTables}>
          <Text style={styles.resetButtonText}>Reset Tables</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Restaurant Floor Plan</Text>
        <View style={styles.headerButtons}>
          <Pressable style={styles.filterButton} onPress={() => setActiveSection(null)}>
            <Filter size={20} color={activeSection ? '#666' : '#2196F3'} />
            <Text style={[styles.filterButtonText, { color: activeSection ? '#666' : '#2196F3' }]}>
              All
            </Text>
          </Pressable>
          <Pressable style={styles.resetButton} onPress={handleResetAllTables}>
            <RefreshCcw size={20} color="white" />
            <Text style={styles.resetButtonText}>Reset All</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionTabs}>
        {sections.map(section => (
          <Pressable
            key={section}
            style={[
              styles.sectionTab,
              activeSection === section && styles.activeTab
            ]}
            onPress={() => toggleSection(section)}
          >
            <Text 
              style={[
                styles.sectionTabText,
                activeSection === section && styles.activeTabText
              ]}
            >
              {section}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.scrollContainer}>
        {sectionsToDisplay.map(section => {
          const sectionTables = getTablesBySection(section);
          
          return (
            <View key={section} style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>{section}</Text>
              {sectionTables.length === 0 ? (
                <Text style={styles.noTablesText}>No tables in this section</Text>
              ) : (
                <View style={styles.tablesGrid}>
                  {sectionTables.map((table) => (
                    <Pressable
                      key={table.id}
                      style={[
                        styles.table,
                        { backgroundColor: getTableColor(table.status) },
                      ]}
                      onPress={() => openTable(table)}>
                      <Text style={styles.tableNumber}>{table.name}</Text>
                      <View style={styles.tableInfo}>
                        <Users size={20} color="white" />
                        <Text style={styles.seats}>
                          {table.guests || 0}/{table.seats}
                        </Text>
                      </View>
                      <Text style={styles.status}>{table.status}</Text>
                      {table.order && table.order.items.length > 0 && (
                        <Text style={styles.orderInfo}>
                          {table.order.items.length} items - ${table.order.total.toFixed(2)}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
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
  resetButtonBig: {
    marginTop: 20,
    backgroundColor: '#F44336',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  header: {
    padding: 20,
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
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 10,
  },
  sectionTab: {
    padding: 12,
    marginRight: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
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
  sectionContainer: {
    marginBottom: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    padding: 20,
    paddingBottom: 10,
  },
  noTablesText: {
    textAlign: 'center',
    padding: 20,
    color: '#666',
    fontStyle: 'italic',
  },
  tablesGrid: {
    padding: 20,
    paddingTop: 0,
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