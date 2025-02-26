import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useState } from 'react';
import { CirclePlus as PlusCircle, CircleMinus as MinusCircle, CreditCard as Edit } from 'lucide-react-native';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  available: boolean;
}

export default function MenuScreen() {
  const [menuItems] = useState<MenuItem[]>([
    { id: 1, name: 'Margherita Pizza', price: 12.99, category: 'Pizza', available: true },
    { id: 2, name: 'Pepperoni Pizza', price: 14.99, category: 'Pizza', available: true },
    { id: 3, name: 'Caesar Salad', price: 8.99, category: 'Salads', available: true },
    { id: 4, name: 'Greek Salad', price: 9.99, category: 'Salads', available: false },
    { id: 5, name: 'Spaghetti Carbonara', price: 13.99, category: 'Pasta', available: true },
    { id: 6, name: 'Tiramisu', price: 6.99, category: 'Desserts', available: true },
  ]);

  const categories = [...new Set(menuItems.map(item => item.category))];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu Management</Text>
        <Pressable style={styles.addButton}>
          <PlusCircle size={24} color="#fff" />
          <Text style={styles.addButtonText}>Add New Item</Text>
        </Pressable>
      </View>
      <ScrollView>
        {categories.map(category => (
          <View key={category} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category}</Text>
            {menuItems
              .filter(item => item.category === category)
              .map(item => (
                <View key={item.id} style={styles.menuItem}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                  </View>
                  <View style={styles.itemActions}>
                    <Pressable
                      style={[
                        styles.actionButton,
                        { backgroundColor: item.available ? '#f44336' : '#4CAF50' },
                      ]}>
                      {item.available ? (
                        <MinusCircle size={20} color="#fff" />
                      ) : (
                        <PlusCircle size={20} color="#fff" />
                      )}
                      <Text style={styles.actionButtonText}>
                        {item.available ? 'Mark Unavailable' : 'Mark Available'}
                      </Text>
                    </Pressable>
                    <Pressable style={[styles.actionButton, { backgroundColor: '#2196F3' }]}>
                      <Edit size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Edit</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
          </View>
        ))}
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  categorySection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  menuItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  itemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 6,
    gap: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
});