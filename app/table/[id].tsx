// app/table/[id].tsx - Fixed TypeScript errors

import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Users, Plus, Minus, Receipt, Split as Split2, CreditCard } from 'lucide-react-native';
import { getTable, updateTable, OrderItem, Table } from '../../utils/storage';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
}

export default function TableScreen() {
  const { id } = useLocalSearchParams();
  const tableId = parseInt(id as string, 10);
  const router = useRouter();
  const [guestCount, setGuestCount] = useState(1);
  const [table, setTable] = useState<Table | null>(null);
  const [loading, setLoading] = useState(true);

  const menuItems: MenuItem[] = [
    // Menu items remain the same
    { id: 1, name: 'Margherita Pizza', price: 12.99, category: 'Pizza' },
    { id: 2, name: 'Pepperoni Pizza', price: 14.99, category: 'Pizza' },
    { id: 3, name: 'Caesar Salad', price: 8.99, category: 'Salads' },
    { id: 4, name: 'Greek Salad', price: 9.99, category: 'Salads' },
    { id: 5, name: 'Spaghetti Carbonara', price: 13.99, category: 'Pasta' },
    { id: 6, name: 'Fettuccine Alfredo', price: 12.99, category: 'Pasta' },
    { id: 7, name: 'Tiramisu', price: 6.99, category: 'Desserts' },
    { id: 8, name: 'Cheesecake', price: 7.99, category: 'Desserts' },
    { id: 9, name: 'Soda', price: 2.99, category: 'Drinks' },
    { id: 10, name: 'Iced Tea', price: 2.49, category: 'Drinks' },
  ];

  const categories = [...new Set(menuItems.map(item => item.category))];

  useEffect(() => {
    loadTable();
  }, [tableId]);

  const loadTable = async () => {
    setLoading(true);
    const loadedTable = await getTable(tableId);
    if (loadedTable) {
      setTable(loadedTable);
      setGuestCount(loadedTable.guests || 1);
    }
    setLoading(false);
  };

  // Fixed function to handle TypeScript errors
  const addItemToOrder = (item: MenuItem) => {
    if (!table || !table.order) return;

    const updatedTable = { ...table };
    
    // Ensure order exists (TypeScript safety)
    if (!updatedTable.order) {
      updatedTable.order = {
        id: Date.now(),
        items: [],
        guests: guestCount,
        status: 'active',
        timestamp: new Date().toISOString(),
        total: 0
      };
    }
    
    const existingItem = updatedTable.order.items.find(
      orderItem => orderItem.name === item.name
    );

    if (existingItem) {
      // Increment quantity if item already exists
      existingItem.quantity += 1;
    } else {
      // Add new item
      updatedTable.order.items.push({
        id: Date.now(),
        name: item.name,
        price: item.price,
        quantity: 1,
      });
    }

    // Recalculate total
    updatedTable.order.total = calculateTotal(updatedTable.order.items);
    
    setTable(updatedTable);
    updateTable(updatedTable);
  };

  // Fixed function to handle TypeScript errors
  const updateItemQuantity = (itemId: number, increment: boolean) => {
    if (!table || !table.order) return;

    const updatedTable = { ...table };
    
    // TypeScript safety
    if (!updatedTable.order) return;
    
    const updatedItems = updatedTable.order.items.map(item =>
      item.id === itemId
        ? { ...item, quantity: increment ? item.quantity + 1 : Math.max(0, item.quantity - 1) }
        : item
    ).filter(item => item.quantity > 0);

    updatedTable.order.items = updatedItems;
    updatedTable.order.total = calculateTotal(updatedItems);
    
    setTable(updatedTable);
    updateTable(updatedTable);
  };

  // Fixed function to handle TypeScript errors
  const updateItemNotes = (itemId: number, notes: string) => {
    if (!table || !table.order) return;

    const updatedTable = { ...table };
    
    // TypeScript safety
    if (!updatedTable.order) return;
    
    updatedTable.order.items = updatedTable.order.items.map(item =>
      item.id === itemId ? { ...item, notes } : item
    );
    
    setTable(updatedTable);
    updateTable(updatedTable);
  };

  const calculateTotal = (items: OrderItem[]): number => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  // Fixed function to handle TypeScript errors
  const updateGuestCount = (newCount: number) => {
    if (!table) return;
    
    const updatedCount = Math.max(1, newCount);
    setGuestCount(updatedCount);
    
    const updatedTable = { ...table, guests: updatedCount };
    
    // TypeScript safety - check if order exists
    if (updatedTable.order) {
      updatedTable.order.guests = updatedCount;
    }
    
    setTable(updatedTable);
    updateTable(updatedTable);
  };

  const handlePayment = (type: 'full' | 'split' | 'custom') => {
    if (!table || !table.order) return;
    
    const total = table.order.total;
    
    if (total <= 0) {
      Alert.alert('No Items', 'There are no items to pay for.');
      return;
    }

    if (type === 'full') {
      router.push({
        pathname: '/payment/full',
        params: { 
          tableId: tableId.toString(), 
          total: total.toString(),
          items: JSON.stringify(table.order.items)
        },
      });
    } else if (type === 'split') {
      if (guestCount <= 1) {
        Alert.alert('Cannot Split', 'Need at least 2 guests to split the bill.');
        return;
      }
      
      router.push({
        pathname: '/payment/split',
        params: { 
          tableId: tableId.toString(), 
          total: total.toString(), 
          guests: guestCount.toString(),
          items: JSON.stringify(table.order.items)
        },
      });
    } else if (type === 'custom') {
      router.push({
        pathname: '/payment/custom',
        params: { 
          tableId: tableId.toString(), 
          total: total.toString(),
          items: JSON.stringify(table.order.items)
        },
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading table information...</Text>
      </View>
    );
  }

  if (!table) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Table not found</Text>
        <Pressable 
          style={styles.backButton}
          onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const orderItems = table.order?.items || [];
  const total = table.order?.total || 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{table.name}</Text>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionText}>{table.section}</Text>
        </View>
        <View style={styles.guestCounter}>
          <Users size={24} color="#666" />
          <Pressable onPress={() => updateGuestCount(guestCount - 1)}>
            <Minus size={24} color="#666" />
          </Pressable>
          <Text style={styles.guestCount}>{guestCount}</Text>
          <Pressable onPress={() => updateGuestCount(guestCount + 1)}>
            <Plus size={24} color="#666" />
          </Pressable>
        </View>
      </View>

      {/* Rest of the component remains the same */}
      <View style={styles.content}>
        <View style={styles.orderSection}>
          <Text style={styles.sectionTitle}>Current Order</Text>
          <ScrollView style={styles.orderList}>
            {orderItems.length === 0 ? (
              <Text style={styles.emptyOrder}>No items in order. Add from the menu.</Text>
            ) : (
              orderItems.map(item => (
                <View key={item.id} style={styles.orderItem}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                  </View>
                  <View style={styles.itemActions}>
                    <View style={styles.quantityControl}>
                      <Pressable onPress={() => updateItemQuantity(item.id, false)}>
                        <Minus size={20} color="#666" />
                      </Pressable>
                      <Text style={styles.quantity}>{item.quantity}</Text>
                      <Pressable onPress={() => updateItemQuantity(item.id, true)}>
                        <Plus size={20} color="#666" />
                      </Pressable>
                    </View>
                    <TextInput
                      style={styles.notesInput}
                      placeholder="Add notes..."
                      value={item.notes}
                      onChangeText={(text) => updateItemNotes(item.id, text)}
                    />
                  </View>
                </View>
              ))
            )}
          </ScrollView>
          <View style={styles.totalSection}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
          </View>
          <View style={styles.paymentActions}>
            <Pressable
              style={[styles.paymentButton, { backgroundColor: '#4CAF50' }]}
              onPress={() => handlePayment('full')}>
              <CreditCard size={24} color="white" />
              <Text style={styles.paymentButtonText}>Pay Full</Text>
            </Pressable>
            <Pressable
              style={[styles.paymentButton, { backgroundColor: '#2196F3' }]}
              onPress={() => handlePayment('split')}>
              <Split2 size={24} color="white" />
              <Text style={styles.paymentButtonText}>Split Bill</Text>
            </Pressable>
            <Pressable
              style={[styles.paymentButton, { backgroundColor: '#FF9800' }]}
              onPress={() => handlePayment('custom')}>
              <Receipt size={24} color="white" />
              <Text style={styles.paymentButtonText}>Custom Split</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Menu</Text>
          <ScrollView>
            {categories.map(category => (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>{category}</Text>
                {menuItems
                  .filter(item => item.category === category)
                  .map(item => (
                    <Pressable
                      key={item.id}
                      style={styles.menuItem}
                      onPress={() => addItemToOrder(item)}>
                      <Text style={styles.menuItemName}>{item.name}</Text>
                      <Text style={styles.menuItemPrice}>${item.price.toFixed(2)}</Text>
                    </Pressable>
                  ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 16,
  },
  sectionText: {
    color: '#0288D1',
    fontWeight: '600',
    fontSize: 12,
  },
  guestCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 8,
  },
  guestCount: {
    fontSize: 18,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    padding: 20,
    gap: 20,
  },
  orderSection: {
    flex: 3,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuSection: {
    flex: 2,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  orderList: {
    flex: 1,
  },
  emptyOrder: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
  },
  orderItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 8,
  },
  quantity: {
    fontSize: 16,
    fontWeight: '500',
    minWidth: 24,
    textAlign: 'center',
  },
  notesInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 8,
    fontSize: 14,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: '#e0e0e0',
    marginTop: 16,
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  paymentActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  paymentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  paymentButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#666',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuItemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
});