// app/(tabs)/menu.tsx - Mise à jour avec les prix de Manjos

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useState } from 'react';
import { CirclePlus as PlusCircle, CircleMinus as MinusCircle, CreditCard as Edit } from 'lucide-react-native';
import priceData from '../../helpers/ManjosPrice';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  available: boolean;
  type: 'resto' | 'boisson';
}

export default function MenuScreen() {
  // Convertir les données de ManjosPrice en items de menu
  const convertedItems: MenuItem[] = priceData.map(item => ({
    id: item.id,
    name: item.name,
    price: item.price,
    category: item.type === 'resto' ? 'Plats' : 'Boissons',
    available: true,
    type: item.type as 'resto' | 'boisson'
  }));

  // Organiser les items en catégories plus spécifiques
  const organizeMenuItems = (items: MenuItem[]): MenuItem[] => {
    return items.map(item => {
      // Pour les plats (resto)
      if (item.type === 'resto') {
        if (item.name.toLowerCase().includes('salade')) {
          return { ...item, category: 'Salades' };
        } else if (item.name.toLowerCase().includes('dessert')) {
          return { ...item, category: 'Desserts' };
        } else if (item.name.toLowerCase().includes('frites')) {
          return { ...item, category: 'Accompagnements' };
        } else if (item.name.toLowerCase().includes('menu enfant')) {
          return { ...item, category: 'Menu Enfant' };
        } else if (item.name.toLowerCase().includes('maxi')) {
          return { ...item, category: 'Plats Maxi' };
        } else {
          return { ...item, category: 'Plats Principaux' };
        }
      }
      // Pour les boissons
      else {
        if (item.name.toLowerCase().includes('glace')) {
          return { ...item, category: 'Glaces' };
        } else if (item.name.toLowerCase().includes('thé') || item.name.toLowerCase().includes('café')) {
          return { ...item, category: 'Boissons Chaudes' };
        } else if (item.name.toLowerCase().includes('bière') || item.name.toLowerCase().includes('blonde') || item.name.toLowerCase().includes('ambree')) {
          return { ...item, category: 'Bières' };
        } else if (item.name.toLowerCase().includes('vin') || item.name.toLowerCase().includes('pichet') || item.name.toLowerCase().includes('btl')) {
          return { ...item, category: 'Vins' };
        } else if (item.name.toLowerCase().includes('apero') || item.name.toLowerCase().includes('digestif') || item.name.toLowerCase().includes('ricard') || item.name.toLowerCase().includes('alcool') || item.name.toLowerCase().includes('punch') || item.name.toLowerCase().includes('cocktail')) {
          return { ...item, category: 'Alcools' };
        } else {
          return { ...item, category: 'Softs' };
        }
      }
    });
  };

  const [menuItems, setMenuItems] = useState<MenuItem[]>(organizeMenuItems(convertedItems));

  // Obtenir les catégories uniques et les trier
  const categories = [...new Set(menuItems.map(item => item.category))].sort();

  // Fonction pour marquer un item disponible/indisponible
  const toggleItemAvailability = (itemId: number) => {
    setMenuItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId ? { ...item, available: !item.available } : item
      )
    );
  };

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
                      ]}
                      onPress={() => toggleItemAvailability(item.id)}>
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