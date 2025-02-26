import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DollarSign, CreditCard, Wallet } from 'lucide-react-native';

export default function SplitBillScreen() {
  const { tableId, total, guests } = useLocalSearchParams();
  const router = useRouter();
  const totalAmount = parseFloat(total as string);
  const guestCount = parseInt(guests as string, 10);
  const splitAmount = totalAmount / guestCount;

  const [payments, setPayments] = useState<Array<{
    id: number;
    amount: number;
    paid: boolean;
    method?: 'cash' | 'card';
  }>>(
    Array.from({ length: guestCount }, (_, i) => ({
      id: i + 1,
      amount: splitAmount,
      paid: false,
    }))
  );

  const remainingTotal = totalAmount - payments.reduce((sum, payment) => (
    payment.paid ? sum + payment.amount : sum
  ), 0);

  const handlePayment = (id: number, method: 'cash' | 'card') => {
    setPayments(prev =>
      prev.map(payment =>
        payment.id === id ? { ...payment, paid: true, method } : payment
      )
    );
  };

  const allPaid = payments.every(payment => payment.paid);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Split Bill - Table {tableId}</Text>
        <Text style={styles.subtitle}>
          Total: ${totalAmount.toFixed(2)} • {guestCount} Guests
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {payments.map(payment => (
          <View key={payment.id} style={styles.paymentCard}>
            <View style={styles.paymentHeader}>
              <Text style={styles.guestTitle}>Guest {payment.id}</Text>
              <Text style={styles.amount}>${payment.amount.toFixed(2)}</Text>
            </View>
            {!payment.paid ? (
              <View style={styles.paymentActions}>
                <Pressable
                  style={[styles.paymentButton, { backgroundColor: '#4CAF50' }]}
                  onPress={() => handlePayment(payment.id, 'card')}>
                  <CreditCard size={24} color="white" />
                  <Text style={styles.buttonText}>Pay with Card</Text>
                </Pressable>
                <Pressable
                  style={[styles.paymentButton, { backgroundColor: '#2196F3' }]}
                  onPress={() => handlePayment(payment.id, 'cash')}>
                  <Wallet size={24} color="white" />
                  <Text style={styles.buttonText}>Pay with Cash</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.paidStatus}>
                <Text style={styles.paidText}>
                  Paid with {payment.method === 'card' ? 'Card' : 'Cash'}
                </Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalSection}>
          <Text style={styles.remainingLabel}>Remaining</Text>
          <Text style={styles.remainingAmount}>
            ${remainingTotal.toFixed(2)}
          </Text>
        </View>
        {allPaid && (
          <Pressable
            style={styles.completeButton}
            onPress={() => router.push('/bills')}>
            <Text style={styles.completeButtonText}>Complete Payment</Text>
          </Pressable>
        )}
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  paymentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  amount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  paymentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  paidStatus: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  paidText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: 'white',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  remainingLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  remainingAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  completeButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});