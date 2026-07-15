// app/payment/full.tsx - Version simplifiée sans événements

import { View, Text, StyleSheet, Pressable, Alert, Switch } from 'react-native';
import { useMemo, useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CreditCard,
  Wallet,
  Receipt,
  ArrowLeft,
  Edit3,
} from 'lucide-react-native';
import { Table, getTable, resetTable, addBill } from '../../utils/storage';
import { useToast } from '../../utils/ToastContext';
import { useSettings } from '@/utils/useSettings';
import { useTableActions } from '@/utils/TableContext';
import { logger } from '@/utils/logger';

export default function FullPaymentScreen() {
  const { tableId } = useLocalSearchParams();
  const { paymentMethods, restaurantInfo, printSettings } = useSettings();
  const { refreshTables } = useTableActions();
  const router = useRouter();
  const [printReceipt, setPrintReceipt] = useState(printSettings.autoPrint);
  const [processing, setProcessing] = useState(false);
  const [table, setTable] = useState<Table | null>(null);
  const toast = useToast();

  const tableIdNum = parseInt(tableId as string, 10);
  const availableMethods = paymentMethods.filter((method) => method.enabled);

  // La commande vient uniquement de getTable() : la source de vérité, jamais
  // d'une copie sérialisée passée en param depuis l'écran précédent.
  const orderItems = useMemo(() => table?.order?.items ?? [], [table]);
  const totalAmount = table?.order?.total ?? 0;
  const totalOffered = useMemo(
    () =>
      orderItems.reduce(
        (sum, item) => (item.offered ? sum + item.price * item.quantity : sum),
        0
      ),
    [orderItems]
  );

  useEffect(() => {
    let cancelled = false;
    const fetchTableData = async () => {
      const tableData = await getTable(tableIdNum);
      if (!cancelled) {
        setTable(tableData);
      }
    };
    fetchTableData();
    return () => {
      cancelled = true;
    };
  }, [tableIdNum]);

  // Fonction utilitaire pour obtenir l'icône en fonction du type de méthode
  function getMethodIcon(methodId: string) {
    switch (methodId) {
      case 'card':
        return <CreditCard size={32} color="white" />;
      case 'cash':
        return <Wallet size={32} color="white" />;
      case 'check':
        return <Edit3 size={32} color="white" />;
      default:
        return <CreditCard size={32} color="white" />;
    }
  }

  // Fonction utilitaire pour les couleurs
  function getMethodColor(methodId: string) {
    switch (methodId) {
      case 'card':
        return '#673AB7';
      case 'cash':
        return '#2196F3';
      case 'check':
        return '#9C27B0';
      default:
        return '#757575';
    }
  }

  // Fonction de paiement simplifiée : "Paiement total" paie toujours le montant
  // couramment dû, relu depuis getTable() au moment du clic (jamais une copie
  // capturée au moment de la navigation), donc jamais de branche "partiel".
  const handlePayment = async (method: 'card' | 'cash' | 'check') => {
    if (processing) return;

    setProcessing(true);

    try {
      const currentTable = await getTable(tableIdNum);

      if (!currentTable || !currentTable.order) {
        Alert.alert('Error', 'Could not find table information');
        setProcessing(false);
        return;
      }

      const currentOrderItems = currentTable.order.items;
      const currentTotal = currentTable.order.total;
      const currentOffered = currentOrderItems.reduce(
        (sum, item) =>
          item.offered ? sum + item.price * item.quantity : sum,
        0
      );

      // Create a bill record
      const bill = {
        id: Date.now(),
        tableNumber: tableIdNum,
        amount: currentTotal,
        items: currentOrderItems.length,
        status: 'paid' as 'paid',
        timestamp: new Date().toISOString(),
        tableName: currentTable.name,
        section: currentTable.section,
        paymentMethod: method,
        paymentType: 'full' as 'full',
        paidItems: currentOrderItems,
        offeredAmount: currentOffered,
        guests: currentTable.guests,
      };

      // Add to bills history
      await addBill(bill);

      try {
        await resetTable(tableIdNum);
        await refreshTables();

        if (printReceipt) {
          router.push({
            pathname: '/print-preview',
            params: {
              tableId: tableIdNum.toString(),
              total: currentTotal.toString(),
              items: JSON.stringify(currentOrderItems),
              paymentMethod: method,
              tableName: currentTable.name,
            },
          });
        } else {
          router.replace('/');
        }
        toast.showToast(
          `${currentTable.name} a été payée complètement en ${method}.`,
          'success'
        );
      } catch (error) {
        logger.error(
          'Erreur lors de la réinitialisation de la table:',
          error
        );
        toast.showToast('Erreur lors de la fermeture de la table', 'error');
      }
    } catch (error) {
      logger.error('Payment error:', error);
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
          Payment - {table?.name || `Table ${tableId}`}
        </Text>
      </View>

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

        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName}>{restaurantInfo.name}</Text>
        </View>

        <View style={styles.paymentMethods}>
          {availableMethods.map((method) => (
            <Pressable
              key={method.id}
              style={[
                styles.paymentButton,
                { backgroundColor: getMethodColor(method.id) },
              ]}
              onPress={() =>
                handlePayment(method.id as 'card' | 'cash' | 'check')
              }
              disabled={processing}
            >
              {getMethodIcon(method.id)}
              <Text style={styles.buttonText}>{method.name}</Text>
            </Pressable>
          ))}
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
  restaurantInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  restaurantName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
});
