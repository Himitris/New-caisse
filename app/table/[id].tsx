// app/table/[id].tsx - Mise à jour pour utiliser ManjosPrice

import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Users, Plus, Minus, Receipt, Split as Split2, CreditCard } from 'lucide-react-native';
import { getTable, updateTable, OrderItem, Table } from '../../utils/storage';
import priceData from '../../helpers/ManjosPrice';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  type: 'resto' | 'boisson';
}

export default function TableScreen() {
  const { id } = useLocalSearchParams();
  const tableId = parseInt(id as string, 10);
  const router = useRouter();
  const [guestCount, setGuestCount] = useState(1);
  const [table, setTable] = useState<Table | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Convertir les données de ManjosPrice en items de menu
  const convertPriceDataToMenuItems = (): MenuItem[] => {
    return priceData.map(item => {
      // Déterminer la catégorie en fonction du type et du nom
      let category = item.type === 'resto' ? 'Plats' : 'Boissons';
      
      // Pour les plats (resto)
      if (item.type === 'resto') {
        if (item.name.toLowerCase().includes('salade')) {
          category = 'Salades';
        } else if (item.name.toLowerCase().includes('dessert')) {
          category = 'Desserts';
        } else if (item.name.toLowerCase().includes('frites')) {
          category = 'Accompagnements';
        } else if (item.name.toLowerCase().includes('menu enfant')) {
          category = 'Menu Enfant';
        } else if (item.name.toLowerCase().includes('maxi')) {
          category = 'Plats Maxi';
        } else {
          category = 'Plats Principaux';
        }
      }
      // Pour les boissons
      else {
        if (item.name.toLowerCase().includes('glace')) {
          category = 'Glaces';
        } else if (item.name.toLowerCase().includes('thé') || item.name.toLowerCase().includes('café')) {
          category = 'Boissons Chaudes';
        } else if (item.name.toLowerCase().includes('bière') || item.name.toLowerCase().includes('blonde') || item.name.toLowerCase().includes('ambree')) {
          category = 'Bières';
        } else if (item.name.toLowerCase().includes('vin') || item.name.toLowerCase().includes('pichet') || item.name.toLowerCase().includes('btl')) {
          category = 'Vins';
        } else if (item.name.toLowerCase().includes('apero') || item.name.toLowerCase().includes('digestif') || item.name.toLowerCase().includes('ricard') || item.name.toLowerCase().includes('alcool') || item.name.toLowerCase().includes('punch') || item.name.toLowerCase().includes('cocktail')) {
          category = 'Alcools';
        } else {
          category = 'Softs';
        }
      }
      
      return {
        id: item.id,
        name: item.name,
        price: item.price,
        category,
        type: item.type as 'resto' | 'boisson'
      };
    });
  };

  const menuItems: MenuItem[] = convertPriceDataToMenuItems();
  const categories = [...new Set(menuItems.map(item => item.category))].sort();

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

  // Fonction pour filtrer les éléments du menu par catégorie
  const getMenuItemsByCategory = (category: string) => {
    return menuItems.filter(item => item.category === category);
  };

  // Fonction pour ajouter un item à la commande
  const addItemToOrder = (item: MenuItem) => {
    if (!table || !table.order) return;

    const updatedTable = { ...table };
    
    // Assurer que la commande existe
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
    
    // Vérifier si l'item existe déjà
    const existingItem = updatedTable.order.items.find(
      orderItem => orderItem.name === item.name
    );

    if (existingItem) {
      // Incrémenter la quantité si l'item existe déjà
      existingItem.quantity += 1;
    } else {
      // Ajouter un nouvel item
      updatedTable.order.items.push({
        id: Date.now(),
        name: item.name,
        price: item.price,
        quantity: 1,
      });
    }

    // Recalculer le total
    updatedTable.order.total = calculateTotal(updatedTable.order.items);
    
    setTable(updatedTable);
    updateTable(updatedTable);
  };

  // Mettre à jour la quantité d'un item
  const updateItemQuantity = (itemId: number, increment: boolean) => {
    if (!table || !table.order) return;

    const updatedTable = { ...table };
    
    // Vérification TypeScript
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

  // Mettre à jour les notes d'un item
  const updateItemNotes = (itemId: number, notes: string) => {
    if (!table || !table.order) return;

    const updatedTable = { ...table };
    
    // Vérification TypeScript
    if (!updatedTable.order) return;
    
    updatedTable.order.items = updatedTable.order.items.map(item =>
      item.id === itemId ? { ...item, notes } : item
    );
    
    setTable(updatedTable);
    updateTable(updatedTable);
  };

  // Calculer le total de la commande
  const calculateTotal = (items: OrderItem[]): number => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  // Mettre à jour le nombre de convives
  const updateGuestCount = (newCount: number) => {
    if (!table) return;
    
    const updatedCount = Math.max(1, newCount);
    setGuestCount(updatedCount);
    
    const updatedTable = { ...table, guests: updatedCount };
    
    // Vérification TypeScript
    if (updatedTable.order) {
      updatedTable.order.guests = updatedCount;
    }
    
    setTable(updatedTable);
    updateTable(updatedTable);
  };

  // Gérer le paiement
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
          
          {/* Onglets de catégories */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryTabs}>
            <Pressable
              style={[
                styles.categoryTab,
                activeCategory === null && styles.activeCategoryTab
              ]}
              onPress={() => setActiveCategory(null)}>
              <Text 
                style={[
                  styles.categoryTabText,
                  activeCategory === null && styles.activeCategoryTabText
                ]}>
                All
              </Text>
            </Pressable>
            {categories.map(category => (
              <Pressable
                key={category}
                style={[
                  styles.categoryTab,
                  activeCategory === category && styles.activeCategoryTab
                ]}
                onPress={() => setActiveCategory(category)}>
                <Text 
                  style={[
                    styles.categoryTabText,
                    activeCategory === category && styles.activeCategoryTabText
                  ]}>
                  {category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          
          <ScrollView>
            {(activeCategory ? [activeCategory] : categories).map(category => (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>{category}</Text>
                {getMenuItemsByCategory(category).map(item => (
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
  // Nouveaux styles pour les onglets de catégorie
  categoryTabs: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
  },
  activeCategoryTab: {
    backgroundColor: '#2196F3',
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeCategoryTabText: {
    color: 'white',
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