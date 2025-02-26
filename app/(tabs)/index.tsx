import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Users, RefreshCcw } from 'lucide-react-native';
import { getTables, saveTables, Table, resetAllTables } from '../../utils/storage';

export default function TablesScreen() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    setLoading(true);
    const loadedTables = await getTables();
    setTables(loadedTables);
    setLoading(false);
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
      // Prompt for number of guests
      Alert.prompt(
        'Open Table',
        `Enter number of guests for Table ${table.id}:`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open',
            onPress: async (guestCount) => {
              if (!guestCount) return;
              
              const guestNumber = parseInt(guestCount, 10);
              if (isNaN(guestNumber) || guestNumber <= 0) {
                Alert.alert('Invalid Input', 'Please enter a valid number of guests.');
                return;
              }

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
            }
          }
        ],
        'plain-text'
      );
    } else if (table.status === 'occupied') {
      router.push(`/table/${table.id}`);
    } else if (table.status === 'reserved') {
      Alert.alert(
        'Reserved Table',
        'This table is currently reserved. Would you like to change its status?',
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading tables...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Restaurant Floor Plan</Text>
        <Pressable style={styles.resetButton} onPress={handleResetAllTables}>
          <RefreshCcw size={20} color="white" />
          <Text style={styles.resetButtonText}>Reset All</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.tablesGrid}>
        {tables.map((table) => (
          <Pressable
            key={table.id}
            style={[
              styles.table,
              { backgroundColor: getTableColor(table.status) },
            ]}
            onPress={() => openTable(table)}>
            <Text style={styles.tableNumber}>Table {table.id}</Text>
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
  tablesGrid: {
    padding: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  table: {
    width: 160,
    height: 160,
    borderRadius: 8,
    padding: 16,
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
    fontSize: 18,
    fontWeight: 'bold',
  },
  tableInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seats: {
    color: 'white',
    fontSize: 16,
  },
  status: {
    color: 'white',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  orderInfo: {
    color: 'white',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 4,
    borderRadius: 4,
    marginTop: 4,
  },
});