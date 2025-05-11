// app/payment/split.tsx - Écran de paiement partagé corrigé

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
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
import { EVENT_TYPES, events } from '@/utils/events';
import { processPartialPayment } from '@/utils/payment-utils';

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
  const [processing, setProcessing] = useState(false);
  const [totalOffered, setTotalOffered] = useState(0);
  const [tableFullyPaid, setTableFullyPaid] = useState(false);

  // Montant partagé par invité (partage égal)
  // Utiliser toFixed pour éviter les problèmes d'arrondis
  const splitAmount = Math.round((totalAmount / guestCount) * 100) / 100;

  // Récupérer les détails de la table au chargement
  useEffect(() => {
    const fetchTableDetails = async () => {
      const table = await getTable(tableIdNum);
      if (table) {
        setTableName(table.name);
        setTableSection(table.section);

        // Calculer le montant des articles offerts s'il y en a
        if (table.order && table.order.items) {
          const offeredAmount = table.order.items.reduce((sum, item) => {
            if (item.offered) {
              return sum + item.price * item.quantity;
            }
            return sum;
          }, 0);

          setTotalOffered(offeredAmount);
        }
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
  >([]);

  // Initialiser les paiements une fois que totalAmount est disponible
  useEffect(() => {
    if (totalAmount > 0 && guestCount > 0) {
      // Répartir équitablement le montant
      const baseAmount = splitAmount;
      const newPayments = Array.from({ length: guestCount }, (_, i) => ({
        id: i + 1,
        // Pour le dernier, ajuster pour compenser les arrondis
        amount:
          i === guestCount - 1
            ? totalAmount - baseAmount * (guestCount - 1)
            : baseAmount,
        paid: false,
      }));
      setPayments(newPayments);
    }
  }, [totalAmount, guestCount, splitAmount]);

  // Suivre le total restant
  const [remainingTotal, setRemainingTotal] = useState(totalAmount);

  // Mettre à jour le total restant lorsque les paiements changent
  useEffect(() => {
    const paidTotal = payments.reduce(
      (sum, payment) => (payment.paid ? sum + payment.amount : sum),
      0
    );

    const remaining = Math.max(
      0,
      parseFloat((totalAmount - paidTotal).toFixed(2))
    );
    setRemainingTotal(remaining);

    // Vérifier si tout est payé
    if (
      remaining < 0.01 &&
      payments.length > 0 &&
      payments.every((p) => p.paid)
    ) {
      setTableFullyPaid(true);
    }
  }, [payments, totalAmount]);

  const handlePayment = async (
    id: number,
    method: 'card' | 'cash' | 'check'
  ) => {
    try {
      setProcessing(true);
      // Trouver le paiement
      const payment = payments.find((p) => p.id === id);
      if (!payment) return;

      // Marquer comme payé avec la méthode
      setPayments((prev) =>
        prev.map((payment) =>
          payment.id === id ? { ...payment, paid: true, method } : payment
        )
      );

      // Utiliser la fonction optimisée de traitement du paiement partiel
      const result = await processPartialPayment(tableIdNum, payment.amount);

      if (!result.success) {
        toast.showToast('Erreur lors du traitement du paiement', 'error');
        return;
      }

      // Si la table a été fermée automatiquement
      if (result.tableClosed) {
        setTableFullyPaid(true);
      }

      // Créer la facture pour ce paiement
      const bill = {
        id: Date.now() + Math.random(),
        tableNumber: tableIdNum,
        tableName: tableName,
        section: tableSection,
        amount: payment.amount,
        items: orderItems.length,
        status: 'split' as 'split',
        timestamp: new Date().toISOString(),
        paymentMethod: method,
        paymentType: 'split' as 'split',
        paidItems: orderItems.map((item: any) => ({
          ...item,
          quantity: item.quantity / guestCount,
          splitPart: payment.id,
          totalParts: guestCount,
        })),
        // Ajouter le montant des articles offerts proportionnel à ce paiement
        offeredAmount: (payment.amount / totalAmount) * totalOffered,
      };

      // Ajouter à l'historique des factures
      await addBill(bill);

      // Si c'était le dernier paiement (vérifié avec le nouveau état)
      const updatedPayments = payments.map((p) =>
        p.id === id ? { ...p, paid: true, method } : p
      );
      const allPaid = updatedPayments.every((p) => p.paid);

      if (allPaid || result.tableClosed) {
        // Fermer la table explicitement, même si c'est potentiellement redondant
        await resetTable(tableIdNum);
        events.emit(EVENT_TYPES.TABLE_UPDATED, tableIdNum);
        setTableFullyPaid(true);
      }

      toast.showToast(`Paiement ${method} traité avec succès`, 'success');
    } catch (error) {
      console.error('Erreur de traitement du paiement:', error);
      toast.showToast('Échec du traitement du paiement', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const allPaid = payments.every((payment) => payment.paid);

  const handleComplete = () => {
    if (tableFullyPaid || allPaid) {
      // Si tout est payé, retourner à l'écran d'accueil
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
      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.processingText}>Traitement en cours...</Text>
        </View>
      )}
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
        {totalOffered > 0 && (
          <View style={styles.offeredInfoContainer}>
            <Text style={styles.offeredInfoText}>
              Articles offerts: {totalOffered.toFixed(2)} €
            </Text>
          </View>
        )}
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
            {tableFullyPaid || allPaid
              ? "Retour à l'Accueil"
              : 'Terminer & Retour à la Table'}
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
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  processingText: {
    color: 'white',
    marginTop: 12,
    fontSize: 16,
  },
  offeredInfoContainer: {
    backgroundColor: '#FFF8E1',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FFD54F',
  },
  offeredInfoText: {
    color: '#FF9800',
    fontWeight: '500',
    fontSize: 14,
  },
});
