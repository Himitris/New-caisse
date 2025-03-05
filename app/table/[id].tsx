// app/table/[id].tsx

import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Users, Plus, Minus, Receipt, Split as Split2, CreditCard, ArrowLeft, Save, X } from 'lucide-react-native';
import { getTable, updateTable, OrderItem, Table, resetTable } from '../../utils/storage';
import priceData from '../../helpers/ManjosPrice';
import { getMenuAvailability, MenuItemAvailability } from '../../utils/storage';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  type: 'resto' | 'boisson';
  color: string; // Couleur pour la catégorie
}

// Définition des couleurs pour les catégories
const CATEGORY_COLORS: { [key: string]: string } = {
  // Resto
  'Plats Principaux': '#FF9800',
  'Plats Maxi': '#F44336',
  'Salades': '#4CAF50',
  'Accompagnements': '#CDDC39',
  'Desserts': '#E91E63',
  'Menu Enfant': '#8BC34A',
  // Boissons
  'Softs': '#03A9F4',
  'Boissons Chaudes': '#795548',
  'Bières': '#FFC107',
  'Vins': '#9C27B0',
  'Alcools': '#673AB7',
  'Glaces': '#00BCD4',
};

export default function TableScreen() {
  const { id } = useLocalSearchParams();
  const tableId = parseInt(id as string, 10);
  const router = useRouter();

  const [unavailableItems, setUnavailableItems] = useState<number[]>([]);
  const [guestCount, setGuestCount] = useState(1);
  const [table, setTable] = useState<Table | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'resto' | 'boisson' | null>('resto');
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Convertir les données de ManjosPrice en items de menu avec couleurs
  const menuItems: MenuItem[] = useMemo(() => {
    return priceData.map(item => {
      // Déterminer la catégorie en fonction du type et du nom
      let category = item.type === 'resto' ? 'Plats Principaux' : 'Softs';

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
        }
      }

      return {
        id: item.id,
        name: item.name,
        price: item.price,
        category,
        type: item.type as 'resto' | 'boisson',
        color: CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || '#757575'
      };
    });
  }, []);

  const handleCloseTable = async () => {
    if (!table) return;

    Alert.alert(
      'Fermer la table',
      `Êtes-vous sûr de vouloir fermer la table "${table.name}" ? Toutes les commandes non payées seront perdues.`,
      [
        {
          text: 'Annuler',
          style: 'cancel'
        },
        {
          text: 'Fermer',
          style: 'destructive',
          onPress: async () => {
            setSaveInProgress(true);
            try {
              await resetTable(tableId);
              Alert.alert(
                'Table fermée',
                'La table a été réinitialisée avec succès.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.back()
                  }
                ]
              );
            } catch (error) {
              console.error('Erreur lors de la fermeture de la table:', error);
              Alert.alert('Erreur', 'Impossible de fermer la table. Veuillez réessayer.');
            } finally {
              setSaveInProgress(false);
            }
          }
        }
      ]
    );
  };

  // Obtenir toutes les catégories uniques
  const categories = useMemo(() => {
    return [...new Set(menuItems.map(item => item.category))].sort();
  }, [menuItems]);

  // Obtenir les catégories par type
  const categoriesByType = useMemo(() => {
    const result = {
      resto: categories.filter(cat =>
        menuItems.some(item => item.category === cat && item.type === 'resto')
      ),
      boisson: categories.filter(cat =>
        menuItems.some(item => item.category === cat && item.type === 'boisson')
      )
    };
    return result;
  }, [categories, menuItems]);

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

  useEffect(() => {
    // Charger les articles indisponibles
    const loadUnavailableItems = async () => {
      const menuAvailability = await getMenuAvailability();
      const unavailable = menuAvailability
        .filter(item => !item.available)
        .map(item => item.id);
      setUnavailableItems(unavailable);
    };

    loadUnavailableItems();
  }, []);

  // Fonction pour filtrer les éléments du menu par catégorie
  const getMenuItemsByCategory = (category: string) => {
    return menuItems.filter(item => item.category === category);
  };

  // Fonction pour filtrer les catégories par type
  const getVisibleCategories = () => {
    if (!activeType) return categories;
    return categoriesByType[activeType];
  };

  // Fonction pour ajouter un item à la commande
  const addItemToOrder = (item: MenuItem) => {
    if (!table || !table.order) return;

    if (unavailableItems.includes(item.id)) {
      Alert.alert(
        "Article indisponible",
        `${item.name} n'est pas disponible actuellement.`
      );
      return;
    }

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
        <Pressable onPress={() => router.push('/')} style={styles.backLink}>
          <ArrowLeft size={24} color="#333" />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>{table.name}</Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionText}>{table.section}</Text>
          </View>
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
        {/* Section Commande Actuelle */}
        <View style={styles.orderSection}>
          <Text style={styles.sectionTitle}>Commande actuelle</Text>
          <ScrollView style={styles.orderList}>
            {orderItems.length === 0 ? (
              <Text style={styles.emptyOrder}>Aucun article dans la commande. Ajoutez-en depuis le menu.</Text>
            ) : (
              orderItems.map(item => (
                <View key={item.id} style={styles.orderItem}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>{(item.price * item.quantity).toFixed(2)} €</Text>
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
                      placeholder="Ajouter des notes..."
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
            <Text style={styles.totalAmount}>{total.toFixed(2)} €</Text>
          </View>
          <View style={styles.paymentActions}>
            <View style={ styles.generalButton }>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#4CAF50' }]}
                onPress={() => handlePayment('full')}>
                <CreditCard size={24} color="white" />
                <Text style={styles.paymentButtonText}>Paiement total</Text>
              </Pressable>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#2196F3' }]}
                onPress={() => handlePayment('split')}>
                <Split2 size={24} color="white" />
                <Text style={styles.paymentButtonText}>Partager</Text>
              </Pressable>
            </View>
            <View style={ styles.generalButton }>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#FF9800' }]}
                onPress={() => handlePayment('custom')}>
                <Receipt size={24} color="white" />
                <Text style={styles.paymentButtonText}>Partage personnalisé</Text>
              </Pressable>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#F44336' }]}
                onPress={handleCloseTable}>
                <X size={24} color="white" />
                <Text style={styles.paymentButtonText}>Fermer table</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Section Menu */}
        <View style={styles.menuSection}>
          <View style={styles.menuHeader}>
            <Text style={styles.sectionTitle}>Menu</Text>
            {/* Boutons de filtre par type */}
            <View style={styles.typeFilters}>
              <Pressable
                style={[
                  styles.typeFilterButton,
                  activeType === 'resto' && styles.activeTypeButton
                ]}
                onPress={() => setActiveType('resto')}>
                <Text style={[
                  styles.typeFilterText,
                  activeType === 'resto' && styles.activeTypeText
                ]}>
                  Plats
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.typeFilterButton,
                  activeType === 'boisson' && styles.activeTypeButton
                ]}
                onPress={() => setActiveType('boisson')}>
                <Text style={[
                  styles.typeFilterText,
                  activeType === 'boisson' && styles.activeTypeText
                ]}>
                  Boissons
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.typeFilterButton,
                  activeType === null && styles.activeTypeButton
                ]}
                onPress={() => setActiveType(null)}>
                <Text style={[
                  styles.typeFilterText,
                  activeType === null && styles.activeTypeText
                ]}>
                  Tout
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Onglets de catégories */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabs}>
            <Pressable
              style={[
                styles.categoryTab,
                activeCategory === null && styles.activeCategoryTab,
                activeCategory === null && { borderBottomColor: '#2196F3' }
              ]}
              onPress={() => setActiveCategory(null)}>
              <Text
                style={[
                  styles.categoryTabText,
                  activeCategory === null && styles.activeCategoryTabText
                ]}>
                Tout
              </Text>
            </Pressable>
            {getVisibleCategories().map(category => (
              <Pressable
                key={category}
                style={[
                  styles.categoryTab,
                  activeCategory === category && styles.activeCategoryTab,
                  activeCategory === category && { borderBottomColor: CATEGORY_COLORS[category] || '#2196F3' }
                ]}
                onPress={() => setActiveCategory(category)}>
                <Text
                  style={[
                    styles.categoryTabText,
                    activeCategory === category && styles.activeCategoryTabText,
                    activeCategory === category && { color: CATEGORY_COLORS[category] || '#2196F3' }
                  ]}>
                  {category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView style={styles.menuItems}>
            <View style={styles.menuGrid}>
              {(activeCategory
                ? [activeCategory]
                : getVisibleCategories()
              ).map(category => (
                <View key={category} style={styles.categorySection}>
                  <Text style={[
                    styles.categoryTitle,
                    { color: CATEGORY_COLORS[category] || '#757575' }
                  ]}>
                    {category}
                  </Text>
                  <View style={styles.menuItemsGrid}>
                    {getMenuItemsByCategory(category).map(item => (
                      <Pressable
                        key={item.id}
                        style={[
                          styles.menuItem,
                          { borderLeftColor: item.color },
                          unavailableItems.includes(item.id) && styles.unavailableItem // Ajoutez cette ligne
                        ]}
                        onPress={() => addItemToOrder(item)}>
                        <Text style={[
                          styles.menuItemName,
                          unavailableItems.includes(item.id) && styles.unavailableItemText // Ajoutez cette ligne
                        ]}>
                          {item.name}
                        </Text>
                        <Text style={styles.menuItemPrice}>{item.price.toFixed(2)} €</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
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
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backLink: {
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 12,
  },
  sectionBadge: {
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
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
    padding: 12,
    gap: 12,
    flexDirection: 'row',
  },
  orderSection: {
    flex: 2,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuSection: {
    flex: 3,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeFilters: {
    flexDirection: 'row',
    gap: 8,
  },
  typeFilterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  activeTypeButton: {
    backgroundColor: '#2196F3',
  },
  typeFilterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTypeText: {
    color: 'white',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  orderList: {
    flex: 5,
    maxHeight: 400,
    minHeight: 400,
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
    flex: 1,
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
    flex: 4,
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
    fontSize: 14,
    fontWeight: '600',
  },
  // Styles pour les onglets de catégorie
  categoryTabs: {
    marginBottom: 12,
    flexGrow: 0
  },
  categoryTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    textAlign: 'center',
    minWidth: 80, // Largeur minimale pour éviter l’étirement
    alignSelf: 'flex-start', // Empêche l'expansion verticale
  },
  activeCategoryTab: {
    borderBottomWidth: 2,
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeCategoryTabText: {
    fontWeight: '600',
  },
  menuItems: {
    flex: 1,
    maxHeight: 500,
  },
  menuGrid: {
    paddingBottom: 16,
  },
  categorySection: {
    marginBottom: 4,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    paddingLeft: 8,
  },
  menuItemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  menuItem: {
    width: '30%', // Ajuste pour éviter des espaces vides
    height: 50, // Fixe une hauteur raisonnable
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    padding: 8,
    borderLeftWidth: 4,
    justifyContent: 'center', // Centre le contenu verticalement
    alignItems: 'center', // Centre horizontalement
  },
  menuItemName: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  menuItemPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  unavailableItem: {
    opacity: 0.5,
    backgroundColor: '#f0f0f0',
  },
  unavailableItemText: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  generalButton: {
    flex: 1, 
    gap: 30
  },
});