import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Modal } from 'react-native';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  Users, Plus, Minus, Receipt, Split, CreditCard, ArrowLeft, X, Printer, History
} from 'lucide-react-native';
import {
  getTable, updateTable, OrderItem, Table, resetTable,
  getMenuAvailability, getCustomMenuItems,
  CustomMenuItem, BillManager, Bill
} from '../../utils/storage';
import { events, EVENT_TYPES } from '../../utils/events';
import priceData from '../../helpers/ManjosPrice';
import SplitSelectionModal from '../components/SplitSelectionModal';
import PaymentHistoryModal from '../components/PaymentHistoryModal';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  type: 'resto' | 'boisson';
  color: string;
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

// Fonction pour fermer la table
const handleCloseTable = async (tableId: number, table: Table | null, router: any, setSaveInProgress: (value: boolean) => void) => {
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
                  onPress: () => router.push('/')
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

// Fonction pour imprimer la facture
const handlePrintBill = (table: Table | null, router: any, tableId: number) => {
  if (!table || !table.order || table.order.items.length === 0) {
    Alert.alert('Information', 'Il n\'y a aucun article à imprimer.');
    return;
  }

  // Naviguer vers l'écran de prévisualisation d'impression avec les détails de la table
  router.push({
    pathname: '/print-preview',
    params: {
      tableId: tableId.toString(),
      total: (table.order.total || 0).toString(),
      items: JSON.stringify(table.order.items),
      isPreview: 'true',  // Ajouter ce paramètre pour indiquer que c'est juste une prévisualisation
      tableName: table.name
    }
  });
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
  const [customMenuItems, setCustomMenuItems] = useState<CustomMenuItem[]>([]);

  // États pour l'historique des paiements
  const [tableHistory, setTableHistory] = useState<Bill[]>([]);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const [splitModalVisible, setSplitModalVisible] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const items = await getCustomMenuItems();
        setCustomMenuItems(items);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, []);

  // Convertir les données de ManjosPrice en items de menu avec couleurs
  const menuItems: MenuItem[] = useMemo(() => {
    // Commencer avec les articles standard de priceData
    const standardItems = priceData.map(item => {
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

    // Ajouter les articles personnalisés
    const customItems = customMenuItems.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      type: item.type,
      color: CATEGORY_COLORS[item.category as keyof typeof CATEGORY_COLORS] || '#757575'
    }));

    // Combiner les deux listes d'articles
    return [...standardItems, ...customItems];
  }, [customMenuItems]);

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

  // Fonction pour charger l'historique des paiements
  const loadTableHistory = async () => {
    try {
      setRefreshingHistory(true);
      if (tableId && table && table.order) {
        // Récupérer tous les paiements pour cette table
        const allHistory = await BillManager.getBillsForTable(tableId);

        // Filtrer uniquement les paiements effectués après l'ouverture de cette table
        // en utilisant le timestamp de l'ordre actuel comme référence
        const currentSessionTimestamp = new Date(table.order.timestamp).getTime();

        const currentHistory = allHistory.filter(bill => {
          const billTimestamp = new Date(bill.timestamp).getTime();
          return billTimestamp >= currentSessionTimestamp;
        });

        setTableHistory(currentHistory);
      } else {
        setTableHistory([]);
      }
    } catch (error) {
      console.error('Error loading table history:', error);
      setTableHistory([]);
    } finally {
      setRefreshingHistory(false);
    }
  };

  // Fonction pour forcer le rafraîchissement de l'historique
  const refreshTableHistory = async () => {
    await loadTableHistory();
  };

  // Forcer le rafraîchissement de l'historique
  const forceHistoryRefresh = () => {
    setRefreshCounter(prev => prev + 1);
  };

  // Écouter les événements de paiement
  useEffect(() => {
    // S'abonner à l'événement de paiement ajouté
    const unsubscribe = events.on(EVENT_TYPES.PAYMENT_ADDED, (tableNumber, bill) => {
      // Vérifier si l'événement concerne notre table
      if (tableNumber === tableId) {
        console.log(`Payment event received for table ${tableId}, refreshing history`);
        refreshTableHistory();
      }
    });

    // Se désabonner quand le composant est démonté
    return () => {
      unsubscribe();
    };
  }, [tableId]);

  // Rafraîchir l'historique quand l'écran est revisité
  useFocusEffect(
    useCallback(() => {
      if (tableId && table) {
        refreshTableHistory();
      }
      return () => {
        // Fonction de nettoyage si nécessaire
      };
    }, [tableId, table])
  );

  // Rafraîchir l'historique lorsque le compteur change
  useEffect(() => {
    if (refreshCounter > 0) { // Ignorer l'initialisation
      refreshTableHistory();
    }
  }, [refreshCounter]);

  // Rafraîchir l'historique lorsque les données de la table changent
  useEffect(() => {
    if (table && table.order) {
      loadTableHistory();
    } else {
      setTableHistory([]);
    }
  }, [table]);

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

    // Vérifier si l'item existe déjà en comparant à la fois le nom ET le prix
    const existingItem = updatedTable.order.items.find(
      orderItem => orderItem.name === item.name && orderItem.price === item.price
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
      // Vérifier s'il y a suffisamment de couverts avant d'ouvrir le modal
      if (guestCount <= 1) {
        Alert.alert('Impossible de partager', 'Il faut au moins 2 convives pour partager l\'addition.');
        return;
      }

      // Afficher le modal de sélection de parts plutôt que de naviguer directement
      setSplitModalVisible(true);
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

  const handleSplitConfirm = (partsCount: number) => {
    if (!table || !table.order) return;

    const total = table.order.total;

    router.push({
      pathname: '/payment/split',
      params: {
        tableId: tableId.toString(),
        total: total.toString(),
        guests: partsCount.toString(),  // Utiliser le nombre de parts choisi ici
        items: JSON.stringify(table.order.items)
      },
    });
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

        {/* Badge d'historique des paiements */}
        {tableHistory.length > 0 && (
          <View style={styles.historyBadgeContainer}>
            <Pressable
              style={styles.historyBadge}
              onPress={() => setHistoryModalVisible(true)}
            >
              <History size={20} color="white" />
              <Text style={styles.historyBadgeText}>
                {tableHistory.length} paiement{tableHistory.length > 1 ? 's' : ''} partiel{tableHistory.length > 1 ? 's' : ''}
              </Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={[styles.paymentButton, { backgroundColor: '#F44336', marginLeft: 40 }]}
          onPress={() => handleCloseTable(tableId, table, router, setSaveInProgress)}>
          <X size={24} color="white" />
          <Text style={styles.paymentButtonText}>Fermer table</Text>
        </Pressable>
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
            <View style={styles.finalTotal}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalAmount}>{total.toFixed(2)} €</Text>
            </View>
          </View>
          <View style={styles.paymentActions}>
            <View style={styles.paymentActionsRow}>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#4CAF50' }]}
                onPress={() => handlePayment('full')}>
                <CreditCard size={24} color="white" />
                <Text style={styles.paymentButtonText}>Paiement total</Text>
              </Pressable>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#2196F3' }]}
                onPress={() => handlePayment('split')}>
                <Split size={24} color="white" />
                <Text style={styles.paymentButtonText}>Partager</Text>
              </Pressable>
            </View>
            <View style={styles.paymentActionsRow}>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#FF9800' }]}
                onPress={() => handlePayment('custom')}>
                <Receipt size={24} color="white" />
                <Text style={styles.paymentButtonText}>Partage personnalisé</Text>
              </Pressable>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#9C27B0' }]}
                onPress={() => handlePrintBill(table, router, tableId)}>
                <Printer size={24} color="white" />
                <Text style={styles.paymentButtonText}>Imprimer note</Text>
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
                  styles.typeFilterText, activeType === null && styles.activeTypeText
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
                          unavailableItems.includes(item.id) && styles.unavailableItem
                        ]}
                        onPress={() => addItemToOrder(item)}>
                        <Text style={[
                          styles.menuItemName,
                          unavailableItems.includes(item.id) && styles.unavailableItemText
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

      {/* Modal d'historique des paiements */}
      <PaymentHistoryModal
        visible={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
        tableHistory={tableHistory}
        tableName={table?.name || `Table ${tableId}`}
        tableTotal={table?.order?.total}
        refreshing={refreshingHistory}
        onRefresh={refreshTableHistory}
      />
      <SplitSelectionModal
        visible={splitModalVisible}
        onClose={() => setSplitModalVisible(false)}
        onConfirm={handleSplitConfirm}
        defaultPartsCount={guestCount}
        tableName={table?.name || `Table ${tableId}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    flex: 4,
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
    flexWrap: 'wrap', // Permet aux éléments de passer à la ligne sur petits écrans
  },
  orderSection: {
    flex: 2,
    minWidth: 300, // Définit une largeur minimale
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
    minWidth: 300, // Définit une largeur minimale
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
    minHeight: '40%',
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
  },

  finalTotal: {
    width: '100%', // Assure que le total prend toute la largeur
    flexDirection: 'row',
    justifyContent: 'space-between', // Change à space-between au lieu de space-evenly
    alignItems: 'center',
    marginTop: 10,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    alignItems: 'center',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  paymentActions: {
    flexDirection: 'column',
    gap: 1,
    marginTop: 6,
    flex: 2,
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
    minWidth: 80, // Largeur minimale pour éviter l'étirement
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
    gap: 6,
    justifyContent: 'space-between', // Mieux répartir les éléments
  },

  menuItem: {
    width: '31%', // Ajusté pour tenir compte du gap
    minWidth: 90, // Largeur minimale
    height: 50,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    padding: 8,
    borderLeftWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6, // Ajoute de l'espace sous chaque élément
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
  paymentActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap', // Permet aux boutons de passer à la ligne sur petits écrans
  },

  paymentButton: {
    flex: 1,
    minWidth: 130, // Largeur minimale pour les boutons
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8, // Ajoute une marge en bas pour l'espacement
  },

  // Styles pour l'historique des paiements
  historyBadgeContainer: {
    marginLeft: 16,
  },
  historyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    padding: 8,
    borderRadius: 16,
    gap: 6,
  },
  historyBadgeText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyModalContent: {
    backgroundColor: 'white',
    width: '60%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  historyList: {
    flex: 1,
    maxHeight: 400,
  },
  emptyHistory: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  historyItem: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyItemDate: {
    fontSize: 14,
    color: '#666',
  },
  historyItemStatus: {
    fontWeight: '600',
    fontSize: 14,
  },
  historyItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyItemAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  historyItemMethod: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  historyCloseButton: {
    marginTop: 16,
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  historyCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  historySummary: {
    backgroundColor: '#FFF8E1',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  historySummaryText: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  historySummaryAmount: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  historySummaryRemaining: {
    fontSize: 16,
    color: '#F44336',
    fontWeight: '500',
  },
  historySummaryBold: {
    fontWeight: 'bold',
  },
  loadingContainer: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  loadingText: {
    marginLeft: 10,
    color: '#FF9800',
    fontSize: 14,
  },
  paymentTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    marginTop: 16,
  },
  paymentTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  paymentTypeAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  historyItemTypeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyItemType: {
    fontSize: 14,
    fontWeight: '600',
  },
  paymentItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  paymentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentType: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  paymentMethod: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  paymentDate: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
});