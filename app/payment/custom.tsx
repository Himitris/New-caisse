// app/payment/custom.tsx - Fonctionnalité de partage personnalisé

import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CreditCard, Wallet, Save, CheckCircle } from 'lucide-react-native';
import { getTable, updateTable, addBill, resetTable } from '../../utils/storage';

export default function CustomSplitScreen() {
  const { tableId, total, items } = useLocalSearchParams();
  const router = useRouter();
  const tableIdNum = parseInt(tableId as string, 10);
  const totalAmount = parseFloat(total as string);
  const orderItems = items ? JSON.parse(items as string) : [];

  // Ajouter un état pour le nom et la section de la table
  const [tableName, setTableName] = useState("");
  const [tableSection, setTableSection] = useState("");

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

  // État pour les montants de partage personnalisés
  const [splitAmounts, setSplitAmounts] = useState<string[]>(['']);
  const [errorMessage, setErrorMessage] = useState('');

  // Suivre le total des montants saisis
  const [currentTotal, setCurrentTotal] = useState(0);

  // État pour la méthode de paiement sélectionnée pour chaque partage
  const [paymentMethods, setPaymentMethods] = useState<('card' | 'cash' | null)[]>([null]);

  useEffect(() => {
    // Calculer le total actuel de tous les montants saisis
    const calculatedTotal = splitAmounts.reduce((sum, amount) => {
      const parsedAmount = parseFloat(amount || '0');
      return sum + (isNaN(parsedAmount) ? 0 : parsedAmount);
    }, 0);

    setCurrentTotal(calculatedTotal);

    // Vérifier si le total est valide
    if (calculatedTotal > totalAmount) {
      setErrorMessage('Le total des partages dépasse le montant de la facture');
    } else if (calculatedTotal < totalAmount && calculatedTotal > 0) {
      setErrorMessage(`Restant : ${(totalAmount - calculatedTotal).toFixed(2)} €`);
    } else if (calculatedTotal === totalAmount) {
      setErrorMessage('');
    }
  }, [splitAmounts, totalAmount]);

  // Ajouter un nouveau champ de montant de partage
  const addSplitAmount = () => {
    setSplitAmounts([...splitAmounts, '']);
    setPaymentMethods([...paymentMethods, null]);
  };

  // Supprimer un champ de montant de partage
  const removeSplitAmount = (index: number) => {
    const newAmounts = [...splitAmounts];
    newAmounts.splice(index, 1);
    setSplitAmounts(newAmounts);

    const newMethods = [...paymentMethods];
    newMethods.splice(index, 1);
    setPaymentMethods(newMethods);
  };

  // Mettre à jour la valeur d'un montant de partage
  const updateSplitAmount = (index: number, value: string) => {
    const newAmounts = [...splitAmounts];

    // Autoriser uniquement les chiffres et une seule virgule
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      newAmounts[index] = value;
      setSplitAmounts(newAmounts);
    }
  };

  // Calculer automatiquement le montant restant
  const calculateRemaining = () => {
    // Calculer la somme de tous les montants sauf le dernier
    const sumExceptLast = splitAmounts.slice(0, -1).reduce((sum, amount) => {
      const parsedAmount = parseFloat(amount || '0');
      return sum + (isNaN(parsedAmount) ? 0 : parsedAmount);
    }, 0);

    // Définir le dernier montant sur le total restant
    const remaining = Math.max(0, totalAmount - sumExceptLast).toFixed(2);
    const newAmounts = [...splitAmounts];
    newAmounts[newAmounts.length - 1] = remaining;
    setSplitAmounts(newAmounts);
  };

  // Définir la méthode de paiement pour un partage spécifique
  const setPaymentMethod = (index: number, method: 'card' | 'cash') => {
    const newMethods = [...paymentMethods];
    newMethods[index] = method;
    setPaymentMethods(newMethods);
  };

  // Traiter le paiement pour tous les partages
  const processPayments = async () => {
    // Vérifier que tous les partages ont un montant et une méthode de paiement
    const isValid = splitAmounts.every((amount, index) => {
      const parsedAmount = parseFloat(amount || '0');
      return !isNaN(parsedAmount) && parsedAmount > 0 && paymentMethods[index] !== null;
    });

    if (!isValid) {
      Alert.alert('Informations incomplètes', 'Veuillez entrer un montant et sélectionner une méthode de paiement pour chaque partage.');
      return;
    }

    // Vérifier si le total correspond au montant de la facture
    const calculatedTotal = splitAmounts.reduce((sum, amount) => {
      return sum + parseFloat(amount || '0');
    }, 0);

    if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
      Alert.alert(
        'Montant incorrect',
        `Le total des partages (${calculatedTotal.toFixed(2)} €) ne correspond pas au montant de la facture (${totalAmount.toFixed(2)} €).`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Traiter quand même', onPress: () => processPaymentTransactions() }
        ]
      );
    } else {
      processPaymentTransactions();
    }
  };

  // Traiter les transactions de paiement réelles
  const processPaymentTransactions = async () => {
    try {
      // Obtenir les données actuelles de la table
      const table = await getTable(tableIdNum);

      if (!table || !table.order) {
        Alert.alert('Erreur', 'Impossible de trouver les informations de la table');
        return;
      }

      let remainingTotal = table.order.total;
      let allPaymentsProcessed = true;

      // Traiter chaque paiement
      for (let i = 0; i < splitAmounts.length; i++) {
        const amount = parseFloat(splitAmounts[i]);
        const method = paymentMethods[i];

        if (isNaN(amount) || amount <= 0 || method === null) {
          continue;
        }

        // Créer un enregistrement de facture
        const bill = {
          id: Date.now() + i,
          tableNumber: tableIdNum,
          tableName: tableName,
          section: tableSection,
          amount: amount,
          items: orderItems.length,
          status: 'split' as 'split',
          timestamp: new Date().toISOString(),
          paymentMethod: method
        };

        // Ajouter à l'historique des factures
        await addBill(bill);

        // Soustraire du total restant
        remainingTotal -= amount;
      }

      // Vérifier si tout a été payé
      if (remainingTotal <= 0.01) {
        // Réinitialiser la table
        await resetTable(tableIdNum);

        Alert.alert(
          'Paiement terminé',
          'Tous les partages ont été traités avec succès.',
          [{ text: 'OK', onPress: () => router.push('/') }]
        );
      } else {
        // Mettre à jour le total restant
        const updatedTable = {
          ...table,
          order: {
            ...table.order,
            total: remainingTotal
          }
        };

        await updateTable(updatedTable);

        Alert.alert(
          'Paiement partiel',
          `Paiement(s) traité(s) avec succès. Solde restant : ${remainingTotal.toFixed(2)} €`,
          [{ text: 'OK', onPress: () => router.push(`/table/${tableIdNum}`) }]
        );
      }
    } catch (error) {
      console.error('Erreur de paiement :', error);
      Alert.alert('Erreur de paiement', 'Il y a eu une erreur lors du traitement de vos paiements.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#333" />
        </Pressable>
        <View>
          <Text style={styles.title}>Partage personnalisé - {tableName || `Table ${tableId}`}</Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionText}>{tableSection}</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Montant total de la facture</Text>
          <Text style={styles.totalAmount}>{totalAmount.toFixed(2)} €</Text>

          {errorMessage && (
            <Text style={[
              styles.errorMessage,
              errorMessage.includes('Restant') ? styles.infoMessage : styles.warningMessage
            ]}>
              {errorMessage}
            </Text>
          )}

          <View style={styles.currentTotalRow}>
            <Text style={styles.currentTotalLabel}>Total des partages actuels :</Text>
            <Text style={styles.currentTotalAmount}>{currentTotal.toFixed(2)} €</Text>
          </View>
        </View>

        <ScrollView style={styles.splitAmountsList}>
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
                <Pressable
                  style={[
                    styles.methodButton,
                    paymentMethods[index] === 'card' && styles.selectedMethodButton
                  ]}
                  onPress={() => setPaymentMethod(index, 'card')}>
                  <CreditCard size={20} color={paymentMethods[index] === 'card' ? 'white' : '#333'} />
                  <Text style={[
                    styles.methodText,
                    paymentMethods[index] === 'card' && styles.selectedMethodText
                  ]}>Carte</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.methodButton,
                    paymentMethods[index] === 'cash' && styles.selectedMethodButton
                  ]}
                  onPress={() => setPaymentMethod(index, 'cash')}>
                  <Wallet size={20} color={paymentMethods[index] === 'cash' ? 'white' : '#333'} />
                  <Text style={[
                    styles.methodText,
                    paymentMethods[index] === 'cash' && styles.selectedMethodText
                  ]}>Espèces</Text>
                </Pressable>

                {splitAmounts.length > 1 && (
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => removeSplitAmount(index)}>
                    <Text style={styles.removeButtonText}>Supprimer</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}

          <View style={styles.actionsContainer}>
            <Pressable style={styles.addButton} onPress={addSplitAmount}>
              <Text style={styles.addButtonText}>+ Ajouter un autre partage</Text>
            </Pressable>

            <Pressable style={styles.calculateButton} onPress={calculateRemaining}>
              <Save size={20} color="white" />
              <Text style={styles.calculateButtonText}>Calculer automatiquement le reste</Text>
            </Pressable>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[
              styles.processButton,
              (currentTotal === 0 || errorMessage.includes('dépasse')) && styles.disabledButton
            ]}
            onPress={processPayments}
            disabled={currentTotal === 0 || errorMessage.includes('dépasse')}>
            <CheckCircle size={24} color="white" />
            <Text style={styles.processButtonText}>Traiter tous les paiements</Text>
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
  sectionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 4,
  },
  sectionText: {
    color: '#0288D1',
    fontWeight: '600',
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: 20,
    flexDirection: 'row',
  },
  totalCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
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
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 16,
    padding: 8,
    borderRadius: 6,
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
  },
  splitRow: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  splitInputContainer: {
    marginBottom: 16,
  },
  splitLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 50,
  },
  currencySymbol: {
    fontSize: 18,
    marginRight: 8,
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
    gap: 8,
  },
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: 10,
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
  },
  selectedMethodText: {
    color: 'white',
  },
  removeButton: {
    padding: 10,
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
    marginBottom: 20,
  },
  addButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  calculateButton: {
    flex: 1.5,
    padding: 12,
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
  },
  footer: {
    marginTop: 8,
  },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
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
});