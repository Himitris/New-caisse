// app/(tabs)/bills.tsx - Updated bill screen to show table names

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import { Receipt, Printer, Download } from 'lucide-react-native';
import { getBills } from '../../utils/storage';

interface Bill {
  id: number;
  tableNumber: number;
  tableName?: string;
  section?: string;
  amount: number;
  items: number;
  status: 'pending' | 'paid' | 'split';
  timestamp: string;
}

export default function BillsScreen() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  // Load bills on component mount
  useEffect(() => {
    loadBills();
  }, []);

  // Function to load bills from storage
  const loadBills = async () => {
    try {
      setLoading(true);
      const loadedBills = await getBills();
      // Sort bills by timestamp (newest first)
      const sortedBills = loadedBills.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setBills(sortedBills);
    } catch (error) {
      console.error('Error loading bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: Bill['status']) => {
    switch (status) {
      case 'pending':
        return '#FFC107';
      case 'paid':
        return '#4CAF50';
      case 'split':
        return '#2196F3';
      default:
        return '#E0E0E0';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading bills...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bills & Payments</Text>
      </View>
      
      {bills.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Receipt size={60} color="#cccccc" />
          <Text style={styles.emptyText}>No bills found</Text>
          <Text style={styles.emptySubtext}>Bills will appear here after payments</Text>
        </View>
      ) : (
        <ScrollView>
          {bills.map((bill) => (
            <Pressable key={bill.id} style={styles.billCard}>
              <View style={styles.billHeader}>
                <View>
                  <Text style={styles.tableNumber}>
                    {bill.tableName || `Table ${bill.tableNumber}`}
                  </Text>
                  <View style={styles.sectionAndDate}>
                    {bill.section && (
                      <View style={styles.sectionBadge}>
                        <Text style={styles.sectionText}>{bill.section}</Text>
                      </View>
                    )}
                    <Text style={styles.timestamp}>
                      {new Date(bill.timestamp).toLocaleString()}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.status, { color: getStatusColor(bill.status) }]}>
                  {bill.status}
                </Text>
              </View>
              <View style={styles.billDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount:</Text>
                  <Text style={styles.amount}>${bill.amount.toFixed(2)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Items:</Text>
                  <Text style={styles.items}>{bill.items} items</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable style={styles.actionButton}>
                  <Receipt size={20} color="#2196F3" />
                  <Text style={[styles.actionText, { color: '#2196F3' }]}>View</Text>
                </Pressable>
                <Pressable style={styles.actionButton}>
                  <Printer size={20} color="#4CAF50" />
                  <Text style={[styles.actionText, { color: '#4CAF50' }]}>Print</Text>
                </Pressable>
                <Pressable style={styles.actionButton}>
                  <Download size={20} color="#FF9800" />
                  <Text style={[styles.actionText, { color: '#FF9800' }]}>Export</Text>
                </Pressable>
              </View>
            </Pressable>
          ))}
        </ScrollView>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  billCard: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  tableNumber: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionAndDate: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionBadge: {
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  sectionText: {
    color: '#0288D1',
    fontWeight: '600',
    fontSize: 12,
  },
  timestamp: {
    fontSize: 14,
    color: '#666',
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  billDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  items: {
    fontSize: 16,
    color: '#333',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 16,
    paddingTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
  },
});