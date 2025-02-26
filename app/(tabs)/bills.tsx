import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useState } from 'react';
import { Receipt, Printer, Download } from 'lucide-react-native';

interface Bill {
  id: number;
  tableNumber: number;
  amount: number;
  items: number;
  status: 'pending' | 'paid' | 'split';
  timestamp: string;
}

export default function BillsScreen() {
  const [bills] = useState<Bill[]>([
    {
      id: 1,
      tableNumber: 2,
      amount: 89.97,
      items: 6,
      status: 'pending',
      timestamp: '2024-02-20 19:30',
    },
    {
      id: 2,
      tableNumber: 6,
      amount: 45.98,
      items: 3,
      status: 'split',
      timestamp: '2024-02-20 19:15',
    },
    {
      id: 3,
      tableNumber: 4,
      amount: 156.75,
      items: 8,
      status: 'paid',
      timestamp: '2024-02-20 18:45',
    },
  ]);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bills & Payments</Text>
      </View>
      <ScrollView>
        {bills.map((bill) => (
          <Pressable key={bill.id} style={styles.billCard}>
            <View style={styles.billHeader}>
              <View>
                <Text style={styles.tableNumber}>Table {bill.tableNumber}</Text>
                <Text style={styles.timestamp}>{bill.timestamp}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  },
  timestamp: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
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