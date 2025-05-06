// app/payment/split.tsx - Écran de paiement partagé mis à jour

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CreditCard, Wallet, Home, Edit3 } from 'lucide-react-native';
import {
  getTable,
  updateTable,
  addBill,
  resetTable,
} from '../../utils/storage';
import { useToast } from '../../utils/ToastContext';

export default function SplitBillScreen() {
  const { tableId, total, guests, items } = useLocalSearchParams();
  const router = useRouter();
  const totalAmount = parseFloat(total as string);
  const guestCount = parseInt(guests as string, 10);
  const tableIdNum = parseInt(tableId as string, 10);
  const orderItems = items ? JSON.parse(items as string) : [];
  const [tableName, setTableName] = useState('');
  const [tableSection, setTableSection] = useState('');
  const toast = useToast();

  // Montant partagé par invité (partage égal)
  const splitAmount = totalAmount / guestCount;

  // Récupérer les détails de la table au chargement
  useEffect(() => {
    const fetchTableDetails = async () => {
      const table = await getTable(tableIdNum);
      if (table) {
        setTableName(table.name);
        setTableSection(table.section);
      }
    };

    fetchTableDetails();
  }, [tableIdNum]);

  const [payments, setPayments] = useState<
    Array<{
      id: number;
      amount: number;
      paid: boolean;
      method?: 'cash' | 'card' | 'check';
    }>
  >(
    Array.from({ length: guestCount }, (_, i) => ({
      id: i + 1,
      amount: splitAmount,
      paid: false,
    }))
  );

  // Suivre le total restant
  const [remainingTotal, setRemainingTotal] = useState(totalAmount);

  // Mettre à jour le total restant lorsque les paiements changent
  useEffect(() => {
    const paidTotal = payments.reduce(
      (sum, payment) => (payment.paid ? sum + payment.amount : sum),
      0
    );

    setRemainingTotal(totalAmount - paidTotal);
  }, [payments, totalAmount]);

  const handlePayment = async (
    id: number,
    method: 'cash' | 'card' | 'check'
  ) => {
    try {
      // Trouver le paiement
      const payment = payments.find((p) => p.id === id);
      if (!payment) return;

      // Marquer comme payé avec la méthode
      setPayments((prev) =>
        prev.map((payment) =>
          payment.id === id ? { ...payment, paid: true, method } : payment
        )
      );

      const bill = {
        id: Date.now(),
        tableNumber: tableIdNum,
        tableName: tableName,
        section: tableSection,
        amount: payment.amount,
        items: orderItems.length,
        status: 'split' as 'split',
        timestamp: new Date().toISOString(),
        paymentMethod: method,
        paymentType: 'split' as 'split',
        // Ajouter les articles avec une quantité ajustée
        paidItems: orderItems.map((item: { quantity: number }) => ({
          ...item,
          quantity: item.quantity / guestCount, // Diviser la quantité par le nombre de parts
          splitPart: payment.id, // Ajouter un identifiant de la part pour référence
          totalParts: guestCount, // Le nombre total de parts
        })),
      };

      // Ajouter à l'historique des factures
      await addBill(bill);

      // Obtenir les données actuelles de la table pour vérifier si la table doit être réinitialisée
      const table = await getTable(tableIdNum);

      if (!table || !table.order) {
        console.error('Table non trouvée');
        return;
      }

      // Mettre à jour le total restant sur la commande de la table
      const newRemainingTotal = table.order.total - payment.amount;

      if (newRemainingTotal <= 0.01) {
        // Si c'était le dernier paiement, réinitialiser la table
        await resetTable(tableIdNum);
      } else {
        // Sinon, mettre à jour le total restant
        const updatedTable = {
          ...table,
          order: {
            ...table.order,
            total: newRemainingTotal,
          },
        };
        await updateTable(updatedTable);
      }
    } catch (error) {
      console.error('Erreur de traitement du paiement:', error);
      toast.showToast('Échec du traitement du paiement', 'error');
    }
  };

  const allPaid = payments.every((payment) => payment.paid);

  const handleComplete = () => {
    if (allPaid) {
      router.push('/');
      toast.showToast(
        'Tous les paiements ont été traités avec succès.',
        'success'
      );
    } else if (remainingTotal > 0) {
      Alert.alert(
        'Paiement Incomplet',
        `Il reste encore ${remainingTotal.toFixed(
          2
        )} € impayé. Voulez-vous retourner à la table ?`,
        [
          { text: 'Continuer les Paiements', style: 'cancel' },
          {
            text: 'Retour à la Table',
            onPress: () => router.push(`/table/${tableId}`),
          },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Partage de l'Addition - {tableName || `Table ${tableId}`}
        </Text>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionText}>{tableSection}</Text>
        </View>
        <Text style={styles.subtitle}>
          Total : {totalAmount.toFixed(2)} € • {guestCount} Invités
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {payments.map((payment) => (
          <View key={payment.id} style={styles.paymentCard}>
            <View style={styles.paymentHeader}>
              <Text style={styles.guestTitle}>Invité {payment.id}</Text>
              <Text style={styles.amount}>{payment.amount.toFixed(2)} €</Text>
            </View>
            {!payment.paid ? (
              <View style={styles.paymentActions}>
                <Pressable
                  style={[styles.paymentButton, { backgroundColor: '#4CAF50' }]}
                  onPress={() => handlePayment(payment.id, 'card')}
                >
                  <CreditCard size={24} color="white" />
                  <Text style={styles.buttonText}>Paiement par carte</Text>
                </Pressable>
                <Pressable
                  style={[styles.paymentButton, { backgroundColor: '#2196F3' }]}
                  onPress={() => handlePayment(payment.id, 'cash')}
                >
                  <Wallet size={24} color="white" />
                  <Text style={styles.buttonText}>Paiement en espèces</Text>
                </Pressable>
                <Pressable
                  style={[styles.paymentButton, { backgroundColor: '#9C27B0' }]}
                  onPress={() => handlePayment(payment.id, 'check')}
                >
                  <Edit3 size={24} color="white" />
                  <Text style={styles.buttonText}>Paiement par chèque</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.paidStatus}>
                <Text style={styles.paidText}>
                  Payé avec{' '}
                  {payment.method === 'card'
                    ? 'Carte'
                    : payment.method === 'cash'
                    ? 'Espèces'
                    : 'Chèque'}
                </Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalSection}>
          <Text style={styles.remainingLabel}>Restant</Text>
          <Text
            style={[
              styles.remainingAmount,
              remainingTotal <= 0 ? styles.paidAmount : {},
            ]}
          >
            {remainingTotal.toFixed(2)} €
          </Text>
        </View>
        <Pressable style={styles.completeButton} onPress={handleComplete}>
          <Home size={20} color="white" />
          <Text style={styles.completeButtonText}>
            {allPaid ? "Retour à l'Accueil" : 'Terminer & Retour à la Table'}
          </Text>
        </Pressable>
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
    marginBottom: 4,
  },
  sectionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 8,
  },
  sectionText: {
    color: '#0288D1',
    fontWeight: '600',
    fontSize: 12,
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
    color: '#F44336',
  },
  paidAmount: {
    color: '#4CAF50',
  },
  completeButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
