// app/payment/custom.tsx - Custom split functionality

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
  
  // Add state for table name and section
  const [tableName, setTableName] = useState("");
  const [tableSection, setTableSection] = useState("");

  // Fetch table details on load
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
  
  // State for custom split amounts
  const [splitAmounts, setSplitAmounts] = useState<string[]>(['']);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Track total of entered amounts
  const [currentTotal, setCurrentTotal] = useState(0);
  
  // State for selected payment method for each split
  const [paymentMethods, setPaymentMethods] = useState<('card' | 'cash' | null)[]>([null]);
  
  useEffect(() => {
    // Calculate the current total of all entered amounts
    const calculatedTotal = splitAmounts.reduce((sum, amount) => {
      const parsedAmount = parseFloat(amount || '0');
      return sum + (isNaN(parsedAmount) ? 0 : parsedAmount);
    }, 0);
    
    setCurrentTotal(calculatedTotal);
    
    // Check if total is valid
    if (calculatedTotal > totalAmount) {
      setErrorMessage('Split total exceeds bill amount');
    } else if (calculatedTotal < totalAmount && calculatedTotal > 0) {
      setErrorMessage(`Remaining: $${(totalAmount - calculatedTotal).toFixed(2)}`);
    } else if (calculatedTotal === totalAmount) {
      setErrorMessage('');
    }
  }, [splitAmounts, totalAmount]);

  // Add a new split amount field
  const addSplitAmount = () => {
    setSplitAmounts([...splitAmounts, '']);
    setPaymentMethods([...paymentMethods, null]);
  };

  // Remove a split amount field
  const removeSplitAmount = (index: number) => {
    const newAmounts = [...splitAmounts];
    newAmounts.splice(index, 1);
    setSplitAmounts(newAmounts);
    
    const newMethods = [...paymentMethods];
    newMethods.splice(index, 1);
    setPaymentMethods(newMethods);
  };

  // Update a split amount value
  const updateSplitAmount = (index: number, value: string) => {
    const newAmounts = [...splitAmounts];
    
    // Only allow numbers and a single decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      newAmounts[index] = value;
      setSplitAmounts(newAmounts);
    }
  };

  // Auto-calculate the remaining amount
  const calculateRemaining = () => {
    // Calculate sum of all but the last amount
    const sumExceptLast = splitAmounts.slice(0, -1).reduce((sum, amount) => {
      const parsedAmount = parseFloat(amount || '0');
      return sum + (isNaN(parsedAmount) ? 0 : parsedAmount);
    }, 0);
    
    // Set the last amount to the remaining total
    const remaining = Math.max(0, totalAmount - sumExceptLast).toFixed(2);
    const newAmounts = [...splitAmounts];
    newAmounts[newAmounts.length - 1] = remaining;
    setSplitAmounts(newAmounts);
  };

  // Set payment method for a specific split
  const setPaymentMethod = (index: number, method: 'card' | 'cash') => {
    const newMethods = [...paymentMethods];
    newMethods[index] = method;
    setPaymentMethods(newMethods);
  };

  // Process payment for all splits
  const processPayments = async () => {
    // Validate that all splits have an amount and payment method
    const isValid = splitAmounts.every((amount, index) => {
      const parsedAmount = parseFloat(amount || '0');
      return !isNaN(parsedAmount) && parsedAmount > 0 && paymentMethods[index] !== null;
    });
    
    if (!isValid) {
      Alert.alert('Incomplete Information', 'Please enter an amount and select a payment method for each split.');
      return;
    }
    
    // Check if total matches bill amount
    const calculatedTotal = splitAmounts.reduce((sum, amount) => {
      return sum + parseFloat(amount || '0');
    }, 0);
    
    if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
      Alert.alert(
        'Amount Mismatch',
        `The split total ($${calculatedTotal.toFixed(2)}) doesn't match the bill amount ($${totalAmount.toFixed(2)}).`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Process Anyway', onPress: () => processPaymentTransactions() }
        ]
      );
    } else {
      processPaymentTransactions();
    }
  };

  // Process the actual payment transactions
  const processPaymentTransactions = async () => {
    try {
      // Get current table data
      const table = await getTable(tableIdNum);
      
      if (!table || !table.order) {
        Alert.alert('Error', 'Could not find table information');
        return;
      }
      
      let remainingTotal = table.order.total;
      let allPaymentsProcessed = true;
      
      // Process each payment
      for (let i = 0; i < splitAmounts.length; i++) {
        const amount = parseFloat(splitAmounts[i]);
        const method = paymentMethods[i];
        
        if (isNaN(amount) || amount <= 0 || method === null) {
          continue;
        }
        
        // Create a bill record
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
        
        // Add to bills history
        await addBill(bill);
        
        // Subtract from remaining total
        remainingTotal -= amount;
      }
      
      // Check if everything has been paid
      if (remainingTotal <= 0.01) {
        // Reset the table
        await resetTable(tableIdNum);
        
        Alert.alert(
          'Payment Complete',
          'All splits have been processed successfully.',
          [{ text: 'OK', onPress: () => router.push('/') }]
        );
      } else {
        // Update the remaining total
        const updatedTable = {
          ...table,
          order: {
            ...table.order,
            total: remainingTotal
          }
        };
        
        await updateTable(updatedTable);
        
        Alert.alert(
          'Partial Payment',
          `Processed payment(s) successfully. Remaining balance: $${remainingTotal.toFixed(2)}`,
          [{ text: 'OK', onPress: () => router.push(`/table/${tableIdNum}`) }]
        );
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Payment Error', 'There was an error processing your payments.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#333" />
        </Pressable>
        <View>
          <Text style={styles.title}>Custom Split - {tableName || `Table ${tableId}`}</Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionText}>{tableSection}</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Bill Amount</Text>
          <Text style={styles.totalAmount}>${totalAmount.toFixed(2)}</Text>
          
          {errorMessage && (
            <Text style={[
              styles.errorMessage, 
              errorMessage.includes('Remaining') ? styles.infoMessage : styles.warningMessage
            ]}>
              {errorMessage}
            </Text>
          )}
          
          <View style={styles.currentTotalRow}>
            <Text style={styles.currentTotalLabel}>Current Split Total:</Text>
            <Text style={styles.currentTotalAmount}>${currentTotal.toFixed(2)}</Text>
          </View>
        </View>

        <ScrollView style={styles.splitAmountsList}>
          {splitAmounts.map((amount, index) => (
            <View key={index} style={styles.splitRow}>
              <View style={styles.splitInputContainer}>
                <Text style={styles.splitLabel}>Split {index + 1}</Text>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
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
                  ]}>Card</Text>
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
                  ]}>Cash</Text>
                </Pressable>
                
                {splitAmounts.length > 1 && (
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => removeSplitAmount(index)}>
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
          
          <View style={styles.actionsContainer}>
            <Pressable style={styles.addButton} onPress={addSplitAmount}>
              <Text style={styles.addButtonText}>+ Add Another Split</Text>
            </Pressable>
            
            <Pressable style={styles.calculateButton} onPress={calculateRemaining}>
              <Save size={20} color="white" />
              <Text style={styles.calculateButtonText}>Auto-Calculate Remaining</Text>
            </Pressable>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable 
            style={[
              styles.processButton,
              (currentTotal === 0 || errorMessage.includes('exceeds')) && styles.disabledButton
            ]} 
            onPress={processPayments}
            disabled={currentTotal === 0 || errorMessage.includes('exceeds')}>
            <CheckCircle size={24} color="white" />
            <Text style={styles.processButtonText}>Process All Payments</Text>
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