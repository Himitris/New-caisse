// Modifications for app/payment/full.tsx

import { View, Text, StyleSheet, Pressable, Alert, Switch } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CreditCard,
  Wallet,
  Receipt,
  ArrowLeft,
  Edit3,
} from 'lucide-react-native';
import {
  getTable,
  updateTable,
  resetTable,
  addBill,
} from '../../utils/storage';
import { useToast } from '../../utils/ToastContext';
import { EVENT_TYPES, events } from '@/utils/events';

export default function FullPaymentScreen() {
  const { tableId, total, items } = useLocalSearchParams();
  const router = useRouter();
  const [printReceipt, setPrintReceipt] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [tableName, setTableName] = useState('');
  const toast = useToast();
  const [totalOffered, setTotalOffered] = useState(0);

  const tableIdNum = parseInt(tableId as string, 10);
  const totalAmount = parseFloat(total as string);
  const orderItems = items ? JSON.parse(items as string) : [];

  // Get table name on load
  useEffect(() => {
    const fetchTableData = async () => {
      const tableData = await getTable(tableIdNum);
      if (tableData) {
        setTableName(tableData.name);

        // Calculer le montant des articles offerts
        if (tableData.order && tableData.order.items) {
          const offeredAmount = tableData.order.items.reduce((sum, item) => {
            if (item.offered) {
              return sum + item.price * item.quantity;
            }
            return sum;
          }, 0);

          setTotalOffered(offeredAmount);
        }
      }
    };

    fetchTableData();
  }, [tableIdNum]);

  // Rest of the payment handling code...
  const handlePayment = async (method: 'card' | 'cash' | 'check') => {
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
        status: 'paid' as 'paid',
        timestamp: new Date().toISOString(),
        tableName: table.name,
        section: table.section,
        paymentMethod: method,
        paymentType: 'full' as 'full',
        // Ajouter cette ligne pour stocker les articles payés
        paidItems: orderItems, // Ceci contiendra tous les détails des articles
        // Ajouter le montant des articles offerts
        offeredAmount: totalOffered,
      };

      // Add to bills history
      await addBill(bill);

      // Check if this payment completes the bill
      // Dans handlePayment après le paiement réussi
      if (totalAmount >= table.order.total) {
        try {
          // Reset the table if payment covers full amount
          await resetTable(tableIdNum);

          // Vérifier que la table est bien réinitialisée
          const checkTable = await getTable(tableIdNum);
          if (checkTable && (checkTable.order || checkTable.guests)) {
            console.warn(
              "La table n'a pas été correctement réinitialisée, nettoyage forcé"
            );
            await resetTable(tableIdNum); // Essayer à nouveau
          }

          // Émettre un événement pour s'assurer que l'interface est à jour
          events.emit(EVENT_TYPES.TABLE_UPDATED, tableIdNum);

          if (printReceipt) {
            router.push({
              pathname: '/print-preview',
              params: {
                tableId: tableIdNum.toString(),
                total: totalAmount.toString(),
                items: items as string,
                paymentMethod: method,
                tableName: table.name,
              },
            });
          } else {
            router.push('/');
          }
          toast.showToast(
            `${table.name} a été payée complètement en ${method}.`,
            'success'
          );
        } catch (error) {
          console.error(
            'Erreur lors de la réinitialisation de la table:',
            error
          );
          toast.showToast('Erreur lors de la fermeture de la table', 'error');
        }
      } else {
        // If payment is partial, update the table's total
        const remainingAmount = table.order.total - totalAmount;
        const updatedTable = {
          ...table,
          order: {
            ...table.order,
            total: remainingAmount,
          },
        };

        await updateTable(updatedTable);

        if (printReceipt) {
          router.push({
            pathname: '/print-preview',
            params: {
              tableId: tableIdNum.toString(),
              total: totalAmount.toString(),
              items: items as string,
              paymentMethod: method,
              isPartial: 'true',
              remaining: remainingAmount.toString(),
              tableName: table.name,
            },
          });
        } else {
          router.push(`/table/${tableIdNum}`);
        }

        toast.showToast(
          `Paiement ${method}: ${totalAmount.toFixed(
            2
          )} €\Reste: ${remainingAmount.toFixed(2)} €`,
          'success'
        );
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.showToast('There was an error processing your payment.', 'error');
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
        <Text style={styles.title}>
          Payment - {tableName || `Table ${tableId}`}
        </Text>
      </View>

      {/* Rest of the UI remains the same */}
      <View style={styles.content}>
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Montant total</Text>
          <Text style={styles.amount}>{totalAmount.toFixed(2)} €</Text>
          {totalOffered > 0 && (
            <View style={styles.offeredTotalSection}>
              <Text style={styles.offeredLabel}>Articles offerts:</Text>
              <Text style={styles.offeredAmount}>
                {totalOffered.toFixed(2)} €
              </Text>
            </View>
          )}

          <View style={styles.printOption}>
            <Text style={styles.printLabel}>Imprimer le ticket</Text>
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
            disabled={processing}
          >
            <CreditCard size={32} color="white" />
            <Text style={styles.buttonText}>Paiement par carte</Text>
          </Pressable>

          <Pressable
            style={[styles.paymentButton, { backgroundColor: '#2196F3' }]}
            onPress={() => handlePayment('cash')}
            disabled={processing}
          >
            <Wallet size={32} color="white" />
            <Text style={styles.buttonText}>Paiement en espèces</Text>
          </Pressable>

          <Pressable
            style={[styles.paymentButton, { backgroundColor: '#9C27B0' }]}
            onPress={() => handlePayment('check')}
            disabled={processing}
          >
            <Edit3 size={32} color="white" />
            <Text style={styles.buttonText}>Paiement par chèque</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  // Existing styles...
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
  offeredTotalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#FFD54F',
    borderStyle: 'dashed',
  },
  offeredLabel: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '500',
  },
  offeredAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9800',
  },
});
