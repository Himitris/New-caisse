// app/table/[id].tsx - VERSION ULTRA-SIMPLE
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  CreditCard,
  Gift,
  Minus,
  Plus,
  Receipt,
  Save,
  ShoppingCart,
  Split,
  Users,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  OrderItem,
  Table,
  getTable,
  resetTable,
  updateTable,
} from '../../utils/storage';
import { useToast } from '../../utils/ToastContext';
import { useMenu } from '../../utils/MenuManager';
import SplitSelectionModal from '../components/SplitSelectionModal';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  type: 'resto' | 'boisson';
  color: string;
}

export default function TableScreen() {
  const { id } = useLocalSearchParams();
  const tableId = parseInt(id as string, 10);
  const router = useRouter();
  const toast = useToast();

  // États locaux simples
  const [table, setTable] = useState<Table | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeType, setActiveType] = useState<'resto' | 'boisson'>('resto');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [splitModalVisible, setSplitModalVisible] = useState(false);

  const {
    isLoaded: menuLoaded,
    getAvailableItems,
    getCategories,
    getItem,
  } = useMenu();

  // Chargement initial simple
  useEffect(() => {
    const loadTable = async () => {
      try {
        const tableData = await getTable(tableId);
        if (tableData) {
          setTable(tableData);
        } else {
          toast.showToast('Table introuvable', 'error');
          router.back();
        }
      } catch (error) {
        console.error('Error loading table:', error);
        toast.showToast('Erreur de chargement', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadTable();
  }, [tableId, toast, router]);

  // Sauvegarde simple
  const saveTable = useCallback(async () => {
    if (!table) return;

    setSaving(true);
    try {
      await updateTable(table);
      toast.showToast('Sauvegardé', 'success');
    } catch (error) {
      console.error('Save error:', error);
      toast.showToast('Erreur de sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  }, [table, toast]);

  // Auto-sauvegarde toutes les 30 secondes
  useEffect(() => {
    if (!table) return;

    const interval = setInterval(() => {
      updateTable(table).catch(console.error);
    }, 30000);

    return () => clearInterval(interval);
  }, [table]);

  // Actions simples
  const addItemToOrder = useCallback(
    (menuItem: MenuItem) => {
      setTable((prevTable) => {
        if (!prevTable) return prevTable;

        const newTable = { ...prevTable };

        if (!newTable.order) {
          newTable.order = {
            id: Date.now(),
            items: [],
            guests: newTable.guests || 1,
            status: 'active',
            timestamp: new Date().toISOString(),
            total: 0,
          };
        }

        const existingIndex = newTable.order.items.findIndex(
          (item) => item.menuId === menuItem.id && item.name === menuItem.name
        );

        if (existingIndex >= 0) {
          newTable.order.items[existingIndex].quantity += 1;
        } else {
          newTable.order.items.push({
            id: Date.now() + Math.random(),
            menuId: menuItem.id,
            name: menuItem.name,
            price: menuItem.price,
            quantity: 1,
            type: menuItem.type,
          });
        }

        // Recalculer le total
        newTable.order.total = newTable.order.items.reduce((sum, item) => {
          return item.offered ? sum : sum + item.price * item.quantity;
        }, 0);

        return newTable;
      });

      toast.showToast(`${menuItem.name} ajouté`, 'success');
    },
    [toast]
  );

  const updateItemQuantity = useCallback(
    (itemId: number, increment: boolean) => {
      setTable((prevTable) => {
        if (!prevTable?.order) return prevTable;

        const newTable = { ...prevTable };
        const items = newTable.order!.items.filter((item) => {
          if (item.id === itemId) {
            const newQuantity = increment
              ? item.quantity + 1
              : item.quantity - 1;
            if (newQuantity > 0) {
              item.quantity = newQuantity;
              return true;
            }
            return false;
          }
          return true;
        });

        newTable.order!.items = items;
        newTable.order!.total = items.reduce((sum, item) => {
          return item.offered ? sum : sum + item.price * item.quantity;
        }, 0);

        return newTable;
      });
    },
    []
  );

  const toggleItemOffered = useCallback((itemId: number) => {
    setTable((prevTable) => {
      if (!prevTable?.order) return prevTable;

      const newTable = { ...prevTable };
      newTable.order!.items = newTable.order!.items.map((item) =>
        item.id === itemId ? { ...item, offered: !item.offered } : item
      );

      newTable.order!.total = newTable.order!.items.reduce((sum, item) => {
        return item.offered ? sum : sum + item.price * item.quantity;
      }, 0);

      return newTable;
    });
  }, []);

  const updateGuestCount = useCallback((newCount: number) => {
    const validCount = Math.max(1, newCount);
    setTable((prevTable) => {
      if (!prevTable) return prevTable;

      const newTable = { ...prevTable, guests: validCount };
      if (newTable.order) {
        newTable.order.guests = validCount;
      }
      return newTable;
    });
  }, []);

  const handleClearOrder = useCallback(() => {
    if (!table?.order || table.order.items.length === 0) return;

    Alert.alert('Supprimer la commande', 'Êtes-vous sûr ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          setTable((prevTable) => {
            if (!prevTable?.order) return prevTable;
            return {
              ...prevTable,
              order: { ...prevTable.order, items: [], total: 0 },
            };
          });
        },
      },
    ]);
  }, [table?.order]);

  const handleCloseTable = useCallback(() => {
    Alert.alert(
      'Fermer la table',
      `Êtes-vous sûr de vouloir fermer "${table?.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Fermer',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetTable(tableId);
              toast.showToast(`Table fermée`, 'success');
              router.replace('/');
            } catch (error) {
              toast.showToast('Erreur fermeture', 'error');
            }
          },
        },
      ]
    );
  }, [table?.name, tableId, router, toast]);

  const handlePayment = useCallback(
    (type: 'full' | 'split' | 'custom' | 'items') => {
      if (!table?.order || table.order.total <= 0) {
        toast.showToast('Rien à payer', 'warning');
        return;
      }

      const params = {
        tableId: tableId.toString(),
        total: table.order.total.toString(),
        items: JSON.stringify(table.order.items),
      };

      switch (type) {
        case 'full':
          router.push({ pathname: '/payment/full', params });
          break;
        case 'split':
          if ((table.guests || 1) <= 1) {
            toast.showToast('Il faut au moins 2 convives', 'warning');
            return;
          }
          setSplitModalVisible(true);
          break;
        case 'custom':
          router.push({ pathname: '/payment/custom', params });
          break;
        case 'items':
          router.push({
            pathname: '/payment/items',
            params: { tableId: tableId.toString() },
          });
          break;
      }
    },
    [table, tableId, router, toast]
  );

  // Filtrage simple du menu
  const menuItems = menuLoaded
    ? getAvailableItems().filter((item) => {
        if (item.type !== activeType) return false;
        if (activeCategory && item.category !== activeCategory) return false;
        return true;
      })
    : [];

  const categories = menuLoaded ? getCategories(activeType) : [];

  // Calculs simples
  const orderItems = table?.order?.items || [];
  const total = table?.order?.total || 0;
  const guestCount = table?.guests || 1;
  const offeredTotal = orderItems.reduce(
    (sum, item) => (item.offered ? sum + item.price * item.quantity : sum),
    0
  );

  // Catégorisation simple des items
  const plats = orderItems.filter((item) => {
    const menuItem = getItem(item.menuId || item.id);
    return (menuItem?.type || 'resto') === 'resto';
  });

  const boissons = orderItems.filter((item) => {
    const menuItem = getItem(item.menuId || item.id);
    return (menuItem?.type || 'resto') === 'boisson';
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (!table) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Table introuvable</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header simple */}
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/')} style={styles.backLink}>
          <ArrowLeft size={28} color="#333" />
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

        <Pressable
          style={styles.saveButton}
          onPress={saveTable}
          disabled={saving}
        >
          <Save size={24} color="white" />
          <Text style={styles.saveButtonText}>
            {saving ? 'Sauvegarde...' : 'Sauver'}
          </Text>
        </Pressable>

        <Pressable style={styles.clearButton} onPress={handleClearOrder}>
          <ShoppingCart size={24} color="white" />
          <Text style={styles.clearButtonText}>Vider</Text>
        </Pressable>

        <Pressable style={styles.closeButton} onPress={handleCloseTable}>
          <X size={24} color="white" />
          <Text style={styles.closeButtonText}>Fermer</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* Section commande */}
        <View style={styles.orderSection}>
          <Text style={styles.sectionTitle}>Commande actuelle</Text>

          {orderItems.length === 0 ? (
            <Text style={styles.emptyOrder}>
              Aucun article dans la commande
            </Text>
          ) : (
            <View style={styles.orderColumns}>
              {/* Plats */}
              <View style={styles.orderColumn}>
                <Text style={styles.columnTitle}>Plats ({plats.length})</Text>
                <ScrollView style={styles.orderColumnScroll}>
                  {plats.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.orderItem,
                        item.offered && styles.offeredItem,
                      ]}
                    >
                      <View style={styles.itemHeader}>
                        <View style={styles.itemNameContainer}>
                          {item.offered && <Gift size={14} color="#FF9800" />}
                          <Text
                            style={[
                              styles.itemName,
                              item.offered && styles.offeredItemText,
                            ]}
                          >
                            {item.name} {item.offered ? '(Offert)' : ''}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.itemPrice,
                            item.offered && styles.offeredPrice,
                          ]}
                        >
                          {(item.price * item.quantity).toFixed(2)} €
                        </Text>
                      </View>

                      <View style={styles.itemActions}>
                        <View style={styles.quantityControl}>
                          <Pressable
                            style={styles.quantityButton}
                            onPress={() => updateItemQuantity(item.id, false)}
                          >
                            <Minus size={16} color="#666" />
                          </Pressable>
                          <Text style={styles.quantity}>{item.quantity}</Text>
                          <Pressable
                            style={styles.quantityButton}
                            onPress={() => updateItemQuantity(item.id, true)}
                          >
                            <Plus size={16} color="#666" />
                          </Pressable>
                        </View>

                        <Pressable
                          style={styles.offerButton}
                          onPress={() => toggleItemOffered(item.id)}
                        >
                          <Text style={styles.offerButtonText}>
                            {item.offered ? 'Annuler' : 'Offrir'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>

              {/* Boissons */}
              <View style={styles.orderColumn}>
                <Text style={styles.columnTitle}>
                  Boissons ({boissons.length})
                </Text>
                <ScrollView style={styles.orderColumnScroll}>
                  {boissons.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.orderItem,
                        item.offered && styles.offeredItem,
                      ]}
                    >
                      <View style={styles.itemHeader}>
                        <View style={styles.itemNameContainer}>
                          {item.offered && <Gift size={14} color="#FF9800" />}
                          <Text
                            style={[
                              styles.itemName,
                              item.offered && styles.offeredItemText,
                            ]}
                          >
                            {item.name} {item.offered ? '(Offert)' : ''}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.itemPrice,
                            item.offered && styles.offeredPrice,
                          ]}
                        >
                          {(item.price * item.quantity).toFixed(2)} €
                        </Text>
                      </View>

                      <View style={styles.itemActions}>
                        <View style={styles.quantityControl}>
                          <Pressable
                            style={styles.quantityButton}
                            onPress={() => updateItemQuantity(item.id, false)}
                          >
                            <Minus size={16} color="#666" />
                          </Pressable>
                          <Text style={styles.quantity}>{item.quantity}</Text>
                          <Pressable
                            style={styles.quantityButton}
                            onPress={() => updateItemQuantity(item.id, true)}
                          >
                            <Plus size={16} color="#666" />
                          </Pressable>
                        </View>

                        <Pressable
                          style={styles.offerButton}
                          onPress={() => toggleItemOffered(item.id)}
                        >
                          <Text style={styles.offerButtonText}>
                            {item.offered ? 'Annuler' : 'Offrir'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          {/* Total et paiements */}
          <View style={styles.totalSection}>
            <View style={styles.finalTotal}>
              <Text style={styles.totalLabel}>Total:</Text>
              {offeredTotal > 0 && (
                <Text style={styles.offeredTotal}>
                  Offerts: {offeredTotal.toFixed(2)} €
                </Text>
              )}
              <Text style={styles.totalAmount}>{total.toFixed(2)} €</Text>
            </View>
          </View>

          <View style={styles.paymentActions}>
            <View style={styles.paymentRow}>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#4CAF50' }]}
                onPress={() => handlePayment('full')}
              >
                <CreditCard size={20} color="white" />
                <Text style={styles.paymentButtonText}>Total</Text>
              </Pressable>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#673AB7' }]}
                onPress={() => handlePayment('items')}
              >
                <ShoppingCart size={20} color="white" />
                <Text style={styles.paymentButtonText}>Articles</Text>
              </Pressable>
            </View>
            <View style={styles.paymentRow}>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#FF9800' }]}
                onPress={() => handlePayment('custom')}
              >
                <Receipt size={20} color="white" />
                <Text style={styles.paymentButtonText}>Custom</Text>
              </Pressable>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#2196F3' }]}
                onPress={() => handlePayment('split')}
              >
                <Split size={20} color="white" />
                <Text style={styles.paymentButtonText}>Partage</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Section menu */}
        <View style={styles.menuSection}>
          <View style={styles.menuHeader}>
            <Text style={styles.sectionTitle}>Menu</Text>
            <View style={styles.typeFilters}>
              <Pressable
                style={[
                  styles.typeFilterButton,
                  activeType === 'resto' && styles.activeTypeButton,
                ]}
                onPress={() => {
                  setActiveType('resto');
                  setActiveCategory(null);
                }}
              >
                <Text
                  style={[
                    styles.typeFilterText,
                    activeType === 'resto' && styles.activeTypeText,
                  ]}
                >
                  Plats
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.typeFilterButton,
                  activeType === 'boisson' && styles.activeTypeButton,
                ]}
                onPress={() => {
                  setActiveType('boisson');
                  setActiveCategory(null);
                }}
              >
                <Text
                  style={[
                    styles.typeFilterText,
                    activeType === 'boisson' && styles.activeTypeText,
                  ]}
                >
                  Boissons
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Catégories */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabs}
          >
            <Pressable
              style={[
                styles.categoryTab,
                !activeCategory && styles.activeCategoryTab,
              ]}
              onPress={() => setActiveCategory(null)}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  !activeCategory && styles.activeCategoryTabText,
                ]}
              >
                Tout
              </Text>
            </Pressable>
            {categories.map((category) => (
              <Pressable
                key={category}
                style={[
                  styles.categoryTab,
                  activeCategory === category && styles.activeCategoryTab,
                ]}
                onPress={() => setActiveCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    activeCategory === category && styles.activeCategoryTabText,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Items du menu */}
          <ScrollView style={styles.menuItems}>
            <View style={styles.menuGrid}>
              {menuItems.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.menuItem, { borderLeftColor: item.color }]}
                  onPress={() => addItemToOrder(item)}
                >
                  <Text style={styles.menuItemName}>{item.name}</Text>
                  <Text style={styles.menuItemPrice}>
                    {item.price.toFixed(2)} €
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      <SplitSelectionModal
        visible={splitModalVisible}
        onClose={() => setSplitModalVisible(false)}
        onConfirm={(partsCount: number) => {
          router.push({
            pathname: '/payment/split',
            params: {
              tableId: tableId.toString(),
              total: total.toString(),
              guests: partsCount.toString(),
              items: JSON.stringify(orderItems),
            },
          });
        }}
        defaultPartsCount={guestCount}
        tableName={table.name}
      />
    </View>
  );
}

// Styles simplifiés (conservés mais allégés)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: { marginTop: 15, fontSize: 16, color: '#333' },
  backButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  backButtonText: { color: 'white', fontWeight: '600' },
  header: {
    padding: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backLink: { padding: 8, borderRadius: 8, backgroundColor: '#f5f5f5' },
  headerTitleContainer: { flex: 1 },
  title: { fontSize: 20, fontWeight: 'bold' },
  sectionBadge: {
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  sectionText: { color: '#0288D1', fontWeight: '600', fontSize: 11 },
  guestCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f5f5f5',
    padding: 6,
    borderRadius: 8,
  },
  guestCount: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 20,
    textAlign: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  saveButtonText: { color: 'white', fontWeight: '600' },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6600',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  clearButtonText: { color: 'white', fontWeight: '600' },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F44336',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  closeButtonText: { color: 'white', fontWeight: '600' },
  content: { flex: 1, padding: 8, gap: 8, flexDirection: 'row' },
  orderSection: {
    flex: 2,
    minWidth: 300,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
  },
  menuSection: {
    flex: 3,
    minWidth: 300,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  emptyOrder: { flex: 1, textAlign: 'center', color: '#666', paddingTop: 40 },
  orderColumns: { flexDirection: 'row', gap: 12, flex: 1 },
  orderColumn: { flex: 1 },
  columnTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  orderColumnScroll: { maxHeight: 300 },
  orderItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 8,
    marginBottom: 4,
  },
  offeredItem: {
    backgroundColor: '#FFF8E1',
    borderLeftWidth: 2,
    borderLeftColor: '#FF9800',
    paddingLeft: 8,
    borderRadius: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemName: { fontSize: 12, fontWeight: '500', flex: 1 },
  offeredItemText: { fontStyle: 'italic', color: '#FF9800' },
  itemPrice: { fontSize: 13, fontWeight: '600', color: '#4CAF50' },
  offeredPrice: { textDecorationLine: 'line-through', color: '#FF9800' },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f5f5f5',
    padding: 4,
    borderRadius: 6,
  },
  quantityButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantity: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 20,
    textAlign: 'center',
  },
  offerButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#FF9800',
    borderRadius: 4,
  },
  offerButtonText: { fontSize: 10, color: '#FF9800' },
  totalSection: {
    borderTopWidth: 2,
    borderTopColor: '#e0e0e0',
    marginTop: 12,
    paddingTop: 12,
  },
  finalTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 16, fontWeight: '600' },
  offeredTotal: { fontSize: 14, color: '#FF9800', fontWeight: '500' },
  totalAmount: { fontSize: 20, fontWeight: 'bold', color: '#4CAF50' },
  paymentActions: { marginTop: 12, gap: 8 },
  paymentRow: { flexDirection: 'row', gap: 8 },
  paymentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  paymentButtonText: { color: 'white', fontSize: 13, fontWeight: '600' },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeFilters: { flexDirection: 'row', gap: 6 },
  typeFilterButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  activeTypeButton: { backgroundColor: '#2196F3' },
  typeFilterText: { fontSize: 13, fontWeight: '500', color: '#666' },
  activeTypeText: { color: 'white', fontWeight: '600' },
  categoryTabs: { marginBottom: 12 },
  categoryTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeCategoryTab: { borderBottomColor: '#2196F3' },
  categoryTabText: { fontSize: 13, fontWeight: '500', color: '#666' },
  activeCategoryTabText: { fontWeight: '600', color: '#2196F3' },
  menuItems: { flex: 1 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  menuItem: {
    width: '30%',
    minWidth: 100,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    padding: 8,
    borderLeftWidth: 4,
    alignItems: 'center',
    marginBottom: 8,
  },
  menuItemName: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
    textAlign: 'center',
  },
  menuItemPrice: { fontSize: 11, fontWeight: '600', color: '#4CAF50' },
});
