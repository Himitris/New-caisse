import { View, Text, StyleSheet, Pressable, Alert, Switch } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CreditCard, Wallet, Receipt, ArrowLeft } from 'lucide-react-native';
import { getTable, updateTable, resetTable, addBill } from '../../utils/storage';

export default function FullPaymentScreen() {
  const { tableId, total, items } = useLocalSearchParams();
  const router = useRouter();
  const [printReceipt, setPrintReceipt] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const tableIdNum = parseInt(tableId as string, 10);
  const totalAmount = parseFloat(total as string);
  const orderItems = items ? JSON.parse(items as string) : [];

  const handlePayment = async (method: 'cash' | 'card') => {
    if (processing) return;
    
    setProcessing(true);
    
    try {
      // Get the latest table data
      const table = await getTable(tableIdNum);
      
      if (!table || !table.order) {
        Alert.alert('Error', 'Could not find table information');
        setProcessing(false);
        return;
      }
      
      // Create a bill record
      const bill = {
        id: Date.now(),
        tableNumber: tableIdNum,
        amount: totalAmount,
        items: orderItems.length,
        status: 'paid',
        timestamp: new Date().toISOString(),
      };
      
      // Add to bills history
      await addBill(bill);
      
      // Reset the table
      await resetTable(tableIdNum);
      
      // Show success message
      Alert.alert(
        'Payment Successful',
        `Table ${tableIdNum} has been paid in full with ${method}.`,
        [
          { 
            text: 'OK', 
            onPress: () => {
              if (printReceipt) {
                router.push({
                  pathname: '/print-preview',
                  params: {
                    tableId: tableIdNum.toString(),
                    total: totalAmount.toString(),
                    items: items as string,
                    paymentMethod: method
                  }
                });
              } else {
                router.push('/');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Payment Error', 'There was an error processing your payment.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#333" />
        </Pressable>
        <Text style={styles.title}>Payment - Table {tableId}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Total Amount</Text>
          <Text style={styles.amount}>${totalAmount.toFixed(2)}</Text>
          
          <View style={styles.printOption}>
            <Text style={styles.printLabel}>Print Receipt</Text>
            <Switch
              value={printReceipt}
              onValueChange={setPrintReceipt}
              trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
            />
          </View>
        </View>

        <View style={styles.paymentMethods}>
          <Pressable
            style={[styles.paymentButton, { backgroundColor: '#4CAF50' }]}
            onPress={() => handlePayment('card')}
            disabled={processing}>
            <CreditCard size={32} color="white" />
            <Text style={styles.buttonText}>Pay with Card</Text>
          </Pressable>

          <Pressable
            style={[styles.paymentButton, { backgroundColor: '#2196F3' }]}
            onPress={() => handlePayment('cash')}
            disabled={processing}>
            <Wallet size={32} color="white" />
            <Text style={styles.buttonText}>Pay with Cash</Text>
          </Pressable>
        </View>
      </View>
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  amountCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  amountLabel: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  amount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 24,
  },
  printOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  printLabel: {
    fontSize: 16,
    color: '#333',
  },
  paymentMethods: {
    gap: 16,
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 12,
    gap: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
});