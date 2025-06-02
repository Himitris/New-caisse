// app/payment/custom.tsx - Correction du bug des hooks

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  CreditCard,
  Wallet,
  Save,
  CheckCircle,
  Edit3,
} from 'lucide-react-native';
import {
  getTable,
  updateTable,
  addBill,
  resetTable,
} from '../../utils/storage';
import { useToast } from '../../utils/ToastContext';
import { EVENT_TYPES, events } from '@/utils/events';
import { processPartialPayment } from '@/utils/payment-utils';
import { useSettings } from '@/utils/useSettings';

export default function CustomSplitScreen() {
  const { tableId, total, items } = useLocalSearchParams();
  const router = useRouter();
  const tableIdNum = parseInt(tableId as string, 10);
  const totalAmount = parseFloat(total as string);
  const orderItems = items ? JSON.parse(items as string) : [];
  const toast = useToast();

  // ✅ TOUS LES HOOKS DOIVENT ÊTRE DÉCLARÉS EN PREMIER - SANS EXCEPTION
  const [processing, setProcessing] = useState(false);
  const [totalOffered, setTotalOffered] = useState(0);
  const [tableFullyPaid, setTableFullyPaid] = useState(false);
  const [tableName, setTableName] = useState('');
  const [tableSection, setTableSection] = useState('');
  const [splitAmounts, setSplitAmounts] = useState<string[]>(['']);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentTotal, setCurrentTotal] = useState(0);
  const [paymentMethodIds, setPaymentMethodIds] = useState<(string | null)[]>([
    null,
  ]);

  // ✅ Hooks personnalisés APRÈS les hooks de base
  const { paymentMethods, restaurantInfo } = useSettings();
  const enabledPaymentMethods = paymentMethods.filter(
    (method) => method.enabled
  );

  // ✅ TOUS LES useEffect et useCallback APRÈS
  useEffect(() => {
    const fetchTableDetails = async () => {
      const table = await getTable(tableIdNum);
      if (table) {
        setTableName(table.name);
        setTableSection(table.section);

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

  useEffect(() => {
    const calculatedTotal = splitAmounts.reduce((sum, amount) => {
      const parsedAmount = parseFloat(amount || '0');
      return sum + (isNaN(parsedAmount) ? 0 : parsedAmount);
    }, 0);

    const roundedTotal = Math.round(calculatedTotal * 100) / 100;
    setCurrentTotal(roundedTotal);

    if (roundedTotal > totalAmount + 0.01) {
      setErrorMessage('Le total des partages dépasse le montant de la facture');
    } else if (roundedTotal < totalAmount - 0.01 && roundedTotal > 0) {
      setErrorMessage(`Restant : ${(totalAmount - roundedTotal).toFixed(2)} €`);
    } else if (Math.abs(roundedTotal - totalAmount) <= 0.01) {
      setErrorMessage('');
    }
  }, [splitAmounts, totalAmount]);

  const addSplitAmount = useCallback(() => {
    setSplitAmounts([...splitAmounts, '']);
    setPaymentMethodIds([...paymentMethodIds, null]);
  }, [splitAmounts, paymentMethodIds]);

  const removeSplitAmount = useCallback(
    (index: number) => {
      const newAmounts = [...splitAmounts];
      newAmounts.splice(index, 1);
      setSplitAmounts(newAmounts);

      const newMethods = [...paymentMethodIds];
      newMethods.splice(index, 1);
      setPaymentMethodIds(newMethods);
    },
    [splitAmounts, paymentMethodIds]
  );

  const updateSplitAmount = useCallback(
    (index: number, value: string) => {
      const newAmounts = [...splitAmounts];

      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        newAmounts[index] = value;
        setSplitAmounts(newAmounts);
      }
    },
    [splitAmounts]
  );

  const calculateRemaining = useCallback(() => {
    const currentSum = splitAmounts.reduce((sum, amount) => {
      const parsedAmount = parseFloat(amount || '0');
      return sum + (isNaN(parsedAmount) ? 0 : parsedAmount);
    }, 0);

    const roundedSum = Math.round(currentSum * 100) / 100;
    const remaining = Math.round((totalAmount - roundedSum) * 100) / 100;

    if (remaining > 0) {
      const lastIndex = splitAmounts.length - 1;
      const lastAmount = parseFloat(splitAmounts[lastIndex] || '0');

      if (lastAmount === 0 && splitAmounts.length > 0) {
        const newAmounts = [...splitAmounts];
        newAmounts[lastIndex] = remaining.toFixed(2);
        setSplitAmounts(newAmounts);
      } else {
        const newAmounts = [...splitAmounts, remaining.toFixed(2)];
        const newMethods = [...paymentMethodIds, null];

        setSplitAmounts(newAmounts);
        setPaymentMethodIds(newMethods);
      }
    }
  }, [splitAmounts, paymentMethodIds, totalAmount]);

  const setPaymentMethod = useCallback(
    (index: number, methodId: string) => {
      const newMethods = [...paymentMethodIds];
      newMethods[index] = methodId;
      setPaymentMethodIds(newMethods);
    },
    [paymentMethodIds]
  );

  const processPaymentTransactions = useCallback(async () => {
    try {
      setProcessing(true);
      const table = await getTable(tableIdNum);

      if (!table || !table.order) {
        toast.showToast(
          'Impossible de récupérer les informations de la table',
          'error'
        );
        return;
      }

      let allPaymentsProcessed = true;
      let tableWasClosed = false;

      const validPayments = splitAmounts
        .map((amount, index) => ({
          amount: parseFloat(amount),
          methodId: paymentMethodIds[index],
        }))
        .filter((p) => !isNaN(p.amount) && p.amount > 0 && p.methodId !== null);

      const totalValidPayments = validPayments.reduce(
        (sum, payment) => sum + payment.amount,
        0
      );

      const willPayFull = Math.abs(totalValidPayments - totalAmount) <= 0.02;

      for (let i = 0; i < validPayments.length; i++) {
        const payment = validPayments[i];
        const isLastPayment = i === validPayments.length - 1;

        if (isLastPayment && willPayFull) {
          const remainingTable = await getTable(tableIdNum);
          if (remainingTable?.order?.total) {
            payment.amount = Math.min(
              payment.amount,
              remainingTable.order.total
            );
          }
        }

        const result = await processPartialPayment(tableIdNum, payment.amount);

        if (!result.success) {
          allPaymentsProcessed = false;
          console.error('Erreur de paiement:', result.error);
          continue;
        }

        if (result.tableClosed) {
          tableWasClosed = true;
        }

        const bill = {
          id: Date.now() + Math.random(),
          tableNumber: tableIdNum,
          tableName: tableName,
          section: tableSection,
          amount: payment.amount,
          items: orderItems.length,
          status: 'split' as 'split',
          timestamp: new Date().toISOString(),
          paymentMethod: payment.methodId as 'card' | 'cash' | 'check',
          paymentType: 'custom' as 'custom',
          paidItems: orderItems.map((item: any) => ({
            ...item,
            paymentPercentage: table.order
              ? (payment.amount / table.order.total) * 100
              : 0,
            customAmount: payment.amount,
          })),
          offeredAmount: (payment.amount / totalAmount) * totalOffered,
        };

        if (payment.methodId) {
          await addBill(bill);
        }
      }

      // ✅ CORRECTION PRINCIPALE : Traiter la navigation et le toast de manière séquentielle
      if (allPaymentsProcessed && willPayFull) {
        const finalCheck = await getTable(tableIdNum);
        if (finalCheck && (finalCheck.order || finalCheck.guests)) {
          console.warn(
            "La table n'a pas été correctement fermée, forçage de la réinitialisation"
          );
          await resetTable(tableIdNum);

          const verifyReset = await getTable(tableIdNum);
          if (verifyReset && (verifyReset.order || verifyReset.guests)) {
            const forcedCleanTable = {
              ...verifyReset,
              status: 'available' as 'available',
              guests: undefined,
              order: undefined,
            };
            await updateTable(forcedCleanTable);
          }
        }

        events.emit(EVENT_TYPES.TABLE_UPDATED, tableIdNum);
        setTableFullyPaid(true);

        // ✅ CORRECTION : Afficher le toast AVANT de naviguer
        toast.showToast(
          'Tous les partages ont été traités avec succès.',
          'success'
        );

        // ✅ Utiliser setTimeout pour s'assurer que le toast s'affiche avant la navigation
        setTimeout(() => {
          router.push('/');
        }, 100);
      } else {
        if (tableWasClosed) {
          const checkTable = await getTable(tableIdNum);
          if (checkTable && (checkTable.order || checkTable.guests)) {
            console.warn(
              'Table marquée comme fermée mais contient encore des données, nettoyage forcé'
            );
            await resetTable(tableIdNum);
          }

          setTableFullyPaid(true);

          // ✅ Même correction ici
          toast.showToast(
            'Tous les partages ont été traités avec succès.',
            'success'
          );

          setTimeout(() => {
            router.push('/');
          }, 100);
        } else {
          const updatedTable = await getTable(tableIdNum);
          const remainingAmount = updatedTable?.order?.total || 0;

          toast.showToast(
            `Paiement(s) traité(s) avec succès. Solde restant : ${remainingAmount.toFixed(
              2
            )} €`,
            'success'
          );

          setTimeout(() => {
            router.push(`/table/${tableIdNum}`);
          }, 100);
        }
      }
    } catch (error) {
      console.error('Erreur de paiement :', error);
      toast.showToast(
        'Il y a eu une erreur lors du traitement de vos paiements.',
        'error'
      );
    } finally {
      setProcessing(false);
    }
  }, [
    tableIdNum,
    splitAmounts,
    paymentMethodIds,
    totalAmount,
    tableName,
    tableSection,
    orderItems,
    totalOffered,
    router,
    toast,
  ]);

  const processPayments = useCallback(async () => {
    const isValid = splitAmounts.every((amount, index) => {
      const parsedAmount = parseFloat(amount || '0');
      return (
        !isNaN(parsedAmount) &&
        parsedAmount > 0 &&
        paymentMethodIds[index] !== null
      );
    });

    if (!isValid) {
      toast.showToast(
        'Veuillez entrer un montant et sélectionner une méthode de paiement pour chaque partage.',
        'warning'
      );
      return;
    }

    const calculatedTotal = splitAmounts.reduce((sum, amount) => {
      return sum + parseFloat(amount || '0');
    }, 0);

    if (Math.abs(calculatedTotal - totalAmount) > 0.02) {
      Alert.alert(
        'Montant incorrect',
        `Le total des partages (${calculatedTotal.toFixed(
          2
        )} €) ne correspond pas au montant de la facture (${totalAmount.toFixed(
          2
        )} €).`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Traiter quand même',
            onPress: () => processPaymentTransactions(),
          },
        ]
      );
    } else {
      processPaymentTransactions();
    }
  }, [
    splitAmounts,
    paymentMethodIds,
    totalAmount,
    processPaymentTransactions,
    toast,
  ]);

  const getMethodIcon = useCallback((methodId: string) => {
    switch (methodId) {
      case 'card':
        return <CreditCard size={20} color="white" />;
      case 'cash':
        return <Wallet size={20} color="white" />;
      case 'check':
        return <Edit3 size={20} color="white" />;
      default:
        return <Wallet size={20} color="white" />;
    }
  }, []);

  return (
    <View style={styles.container}>
      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.processingText}>Traitement en cours...</Text>
        </View>
      )}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#333" />
        </Pressable>
        <View>
          <Text style={styles.title}>
            Partage personnalisé - {tableName || `Table ${tableId}`}
          </Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionText}>{tableSection}</Text>
          </View>
          {totalOffered > 0 && (
            <View style={styles.offeredInfoContainer}>
              <Text style={styles.offeredInfoText}>
                Articles offerts: {totalOffered.toFixed(2)} €
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.leftColumn}>
          <ScrollView
            style={styles.splitAmountsList}
            showsVerticalScrollIndicator={false}
          >
            {splitAmounts.map((amount, index) => (
              <View key={index} style={styles.splitRow}>
                <View style={styles.splitInputContainer}>
                  <Text style={styles.splitLabel}>Partage {index + 1}</Text>
                  <View style={styles.amountInputContainer}>
                    <Text style={styles.currencySymbol}>€</Text>
                    <TextInput
                      style={styles.amountInput}
                      keyboardType="decimal-pad"
                      value={amount}
                      onChangeText={(value) => updateSplitAmount(index, value)}
                      placeholder="0.00"
                    />
                  </View>
                </View>

                <View style={styles.paymentMethodsRow}>
                  {enabledPaymentMethods.map((method) => (
                    <Pressable
                      key={method.id}
                      style={[
                        styles.methodButton,
                        paymentMethodIds[index] === method.id &&
                          styles.selectedMethodButton,
                      ]}
                      onPress={() => setPaymentMethod(index, method.id)}
                    >
                      {getMethodIcon(method.id)}
                      <Text
                        style={[
                          styles.methodText,
                          paymentMethodIds[index] === method.id &&
                            styles.selectedMethodText,
                        ]}
                      >
                        {method.name}
                      </Text>
                    </Pressable>
                  ))}

                  {splitAmounts.length > 1 && (
                    <Pressable
                      style={styles.removeButton}
                      onPress={() => removeSplitAmount(index)}
                    >
                      <Text style={styles.removeButtonText}>Supprimer</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}

            <View style={styles.actionsContainer}>
              <Pressable style={styles.addButton} onPress={addSplitAmount}>
                <Text style={styles.addButtonText}>
                  + Ajouter un autre partage
                </Text>
              </Pressable>

              <Pressable
                style={styles.calculateButton}
                onPress={calculateRemaining}
              >
                <Save size={20} color="white" />
                <Text style={styles.calculateButtonText}>
                  Créer un partage pour le reste
                </Text>
              </Pressable>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={[
                styles.processButton,
                (currentTotal === 0 || errorMessage.includes('dépasse')) &&
                  styles.disabledButton,
              ]}
              onPress={processPayments}
              disabled={currentTotal === 0 || errorMessage.includes('dépasse')}
            >
              <CheckCircle size={24} color="white" />
              <Text style={styles.processButtonText}>
                Traiter tous les paiements
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.rightColumn}>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Montant total de la facture</Text>
            <Text style={styles.totalAmount}>{totalAmount.toFixed(2)} €</Text>

            {totalOffered > 0 && (
              <View style={styles.offeredContainer}>
                <Text style={styles.offeredText}>
                  Articles offerts: {totalOffered.toFixed(2)} €
                </Text>
              </View>
            )}

            {errorMessage && (
              <Text
                style={[
                  styles.errorMessage,
                  errorMessage.includes('Restant')
                    ? styles.infoMessage
                    : styles.warningMessage,
                ]}
              >
                {errorMessage}
              </Text>
            )}

            <View style={styles.currentTotalRow}>
              <Text style={styles.currentTotalLabel}>
                Total des partages actuels :
              </Text>
              <Text style={styles.currentTotalAmount}>
                {currentTotal.toFixed(2)} €
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// Styles restent identiques
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 24,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  sectionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 8,
  },
  sectionText: {
    color: '#0288D1',
    fontWeight: '600',
    fontSize: 12,
  },
  leftColumn: {
    flex: 2,
    minWidth: 400,
  },
  rightColumn: {
    flex: 1,
    flexDirection: 'column',
    minWidth: 300,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    padding: 24,
    gap: 24,
  },
  totalCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  totalLabel: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 20,
  },
  errorMessage: {
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: 'center',
  },
  warningMessage: {
    backgroundColor: '#FFF3CD',
    color: '#856404',
  },
  infoMessage: {
    backgroundColor: '#D1ECF1',
    color: '#0C5460',
  },
  currentTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 16,
    marginTop: 8,
  },
  currentTotalLabel: {
    fontSize: 16,
    color: '#666',
  },
  currentTotalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  splitAmountsList: {
    flex: 1,
    paddingBottom: 20,
  },
  splitRow: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  splitInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  splitLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 12,
    paddingRight: 22,
  },
  amountInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 50,
  },
  currencySymbol: {
    fontSize: 18,
    marginRight: 12,
    color: '#666',
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    height: 50,
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
    gap: 8,
  },
  selectedMethodButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  methodText: {
    color: '#333',
    fontWeight: '500',
    fontSize: 14,
  },
  selectedMethodText: {
    color: 'white',
  },
  removeButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#f44336',
  },
  removeButtonText: {
    color: '#f44336',
    fontWeight: '500',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
    marginTop: 12,
  },
  addButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  calculateButton: {
    flex: 1.5,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  calculateButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  footer: {
    marginTop: 12,
    paddingBottom: 24,
  },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    gap: 12,
  },
  disabledButton: {
    backgroundColor: '#A5D6A7',
    opacity: 0.6,
  },
  processButtonText: {
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
    padding: 6,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FFD54F',
  },
  offeredInfoText: {
    color: '#FF9800',
    fontWeight: '500',
    fontSize: 13,
  },
  offeredContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD54F',
  },
  offeredText: {
    color: '#FF9800',
    fontWeight: '500',
    textAlign: 'center',
  },
});
