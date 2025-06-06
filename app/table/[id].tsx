// app/table/[id].tsx - VERSION FINALE ULTRA-SIMPLE (sans boucles)
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  CreditCard,
  Gift,
  Minus,
  Plus,
  Receipt,
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
import { useTableContext } from '@/utils/TableContext';

interface SimpleItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  offered: boolean;
  type: string;
}

export default function TableScreen() {
  const { id } = useLocalSearchParams();
  const tableId = parseInt(id as string, 10);
  const router = useRouter();
  const toast = useToast();
  const { refreshTables } = useTableContext();

  // États ultra-simples
  const [loading, setLoading] = useState(true);
  const [tableName, setTableName] = useState('');
  const [tableSection, setTableSection] = useState('');
  const [guestCount, setGuestCount] = useState('1');
  const [items, setItems] = useState<SimpleItem[]>([]);
  const [nextId, setNextId] = useState(1);

  const [activeType, setActiveType] = useState<'resto' | 'boisson'>('resto');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [splitModalVisible, setSplitModalVisible] = useState(false);

  const { isLoaded: menuLoaded, getAvailableItems, getCategories } = useMenu();

  // ✅ Chargement UNE SEULE FOIS (sans dépendances qui changent)
  useEffect(() => {
    let mounted = true;

    const loadOnce = async () => {
      try {
        const table = await getTable(tableId);
        if (!table || !mounted) return;

        if (!mounted) return;
        setTableName(table.name);
        setTableSection(table.section);
        setGuestCount(String(table.guests || 1));

        if (table.order?.items && table.order.items.length > 0) {
          const simpleItems: SimpleItem[] = table.order.items.map(
            (item, idx) => ({
              id: `existing-${item.id || idx}`,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              offered: Boolean(item.offered),
              type: item.type || 'resto',
            })
          );
          if (mounted) {
            setItems(simpleItems);
            setNextId(simpleItems.length + 100);
          }
        }
      } catch (error) {
        console.error('Erreur chargement:', error);
        if (mounted) {
          toast.showToast('Erreur de chargement', 'error');
          router.back();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadOnce();

    return () => {
      mounted = false;
    };
  }, [tableId]); // ✅ SEULEMENT tableId

  // ✅ Ajout simple SANS callback complexe
  const addItem = (menuItem: any) => {
    const newId = `item-${nextId}`;
    setNextId(nextId + 1);

    setItems((currentItems) => {
      // Chercher existant
      const existingIndex = currentItems.findIndex(
        (item) =>
          item.name === menuItem.name &&
          item.price === menuItem.price &&
          !item.offered
      );

      if (existingIndex >= 0) {
        // Augmenter quantité
        const updated = [...currentItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1,
        };
        return updated;
      } else {
        // Nouveau
        return [
          ...currentItems,
          {
            id: newId,
            name: menuItem.name,
            price: menuItem.price,
            quantity: 1,
            offered: false,
            type: menuItem.type,
          },
        ];
      }
    });

    toast.showToast(`${menuItem.name} ajouté`, 'success');
  };

  const updateQuantity = (itemId: string, increase: boolean) => {
    setItems((current) =>
      current
        .map((item) => {
          if (item.id === itemId) {
            const newQty = increase ? item.quantity + 1 : item.quantity - 1;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is SimpleItem => item !== null)
    );
  };

  const toggleOffered = (itemId: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, offered: !item.offered } : item
      )
    );
  };

  const clearAll = () => {
    if (items.length === 0) return;

    Alert.alert('Vider', 'Supprimer tous les articles ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => setItems([]) },
    ]);
  };

  const closeTable = () => {
    Alert.alert('Fermer', 'Fermer cette table ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Fermer',
        style: 'destructive',
        onPress: async () => {
          try {
            await resetTable(tableId);
            await refreshTables();
            toast.showToast('Table fermée', 'success');
            router.replace('/');
          } catch (error) {
            toast.showToast('Erreur', 'error');
          }
        },
      },
    ]);
  };

  const saveAndExit = async () => {
    try {
      const table = await getTable(tableId);
      if (!table) return;

      const total = items.reduce(
        (sum, item) => (item.offered ? sum : sum + item.price * item.quantity),
        0
      );

      const storageItems: OrderItem[] = items.map((item) => ({
        id: parseInt(item.id.split('-')[1]) || Math.random(),
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        offered: item.offered,
        type: item.type as 'resto' | 'boisson',
      }));

      const updatedTable: Table = {
        ...table,
        guests: parseInt(guestCount) || 1,
        status: items.length > 0 ? 'occupied' : 'available',
        order:
          items.length > 0
            ? {
                id: table.order?.id || Date.now(),
                items: storageItems,
                guests: parseInt(guestCount) || 1,
                status: 'active',
                timestamp: table.order?.timestamp || new Date().toISOString(),
                total: total,
              }
            : undefined,
      };

      await updateTable(updatedTable);
      await refreshTables();
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
    }
  };

  const goBack = async () => {
    await saveAndExit();
    router.replace('/');
  };

  const goToPayment = async (type: string) => {
    if (items.length === 0) {
      toast.showToast('Aucun article', 'warning');
      return;
    }

    const total = items.reduce(
      (sum, item) => (item.offered ? sum : sum + item.price * item.quantity),
      0
    );

    if (total <= 0) {
      toast.showToast('Rien à payer', 'warning');
      return;
    }

    await saveAndExit();

    const params = {
      tableId: String(tableId),
      total: String(total),
      items: JSON.stringify(items),
    };

    switch (type) {
      case 'full':
        router.push({ pathname: '/payment/full', params });
        break;
      case 'split':
        const guests = parseInt(guestCount) || 1;
        if (guests <= 1) {
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
          params: { tableId: String(tableId) },
        });
        break;
    }
  };

  // Calculs
  const total = items.reduce(
    (sum, item) => (item.offered ? sum : sum + item.price * item.quantity),
    0
  );

  const offeredTotal = items.reduce(
    (sum, item) => (item.offered ? sum + item.price * item.quantity : sum),
    0
  );

  // Menu
  const menuItems = menuLoaded
    ? getAvailableItems().filter((item) => {
        if (item.type !== activeType) return false;
        if (activeCategory && item.category !== activeCategory) return false;
        return true;
      })
    : [];

  const categories = menuLoaded ? getCategories(activeType) : [];

  // Catégories
  const plats = items.filter((item) => item.type === 'resto');
  const boissons = items.filter((item) => item.type === 'boisson');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.backLink}>
          <ArrowLeft size={28} color="#333" />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>{tableName}</Text>
          {tableSection && (
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionText}>{tableSection}</Text>
            </View>
          )}
        </View>

        <View style={styles.guestCounter}>
          <Users size={24} color="#666" />
          <Pressable
            onPress={() => {
              const current = parseInt(guestCount) || 1;
              setGuestCount(String(Math.max(1, current - 1)));
            }}
          >
            <Minus size={24} color="#666" />
          </Pressable>
          <Text style={styles.guestCount}>{guestCount}</Text>
          <Pressable
            onPress={() => {
              const current = parseInt(guestCount) || 1;
              setGuestCount(String(current + 1));
            }}
          >
            <Plus size={24} color="#666" />
          </Pressable>
        </View>

        <Pressable style={styles.clearButton} onPress={clearAll}>
          <ShoppingCart size={24} color="white" />
          <Text style={styles.clearButtonText}>Vider</Text>
        </Pressable>

        <Pressable style={styles.closeButton} onPress={closeTable}>
          <X size={24} color="white" />
          <Text style={styles.closeButtonText}>Fermer</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* Section commande */}
        <View style={styles.orderSection}>
          <Text style={styles.sectionTitle}>Commande actuelle</Text>

          {items.length === 0 ? (
            <Text style={styles.emptyOrder}>
              Aucun article dans la commande
            </Text>
          ) : (
            <View style={styles.orderColumns}>
              {/* Plats */}
              <View style={styles.orderColumn}>
                <Text style={styles.columnTitle}>
                  Plats ({String(plats.length)})
                </Text>
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
                            {item.name}
                            {item.offered ? ' (Offert)' : ''}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.itemPrice,
                            item.offered && styles.offeredPrice,
                          ]}
                        >
                          {String((item.price * item.quantity).toFixed(2))} €
                        </Text>
                      </View>

                      <View style={styles.itemActions}>
                        <View style={styles.quantityControl}>
                          <Pressable
                            style={styles.quantityButton}
                            onPress={() => updateQuantity(item.id, false)}
                          >
                            <Minus size={16} color="#666" />
                          </Pressable>
                          <Text style={styles.quantity}>
                            {String(item.quantity)}
                          </Text>
                          <Pressable
                            style={styles.quantityButton}
                            onPress={() => updateQuantity(item.id, true)}
                          >
                            <Plus size={16} color="#666" />
                          </Pressable>
                        </View>

                        <Pressable
                          style={styles.offerButton}
                          onPress={() => toggleOffered(item.id)}
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
                  Boissons ({String(boissons.length)})
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
                            {item.name}
                            {item.offered ? ' (Offert)' : ''}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.itemPrice,
                            item.offered && styles.offeredPrice,
                          ]}
                        >
                          {String((item.price * item.quantity).toFixed(2))} €
                        </Text>
                      </View>

                      <View style={styles.itemActions}>
                        <View style={styles.quantityControl}>
                          <Pressable
                            style={styles.quantityButton}
                            onPress={() => updateQuantity(item.id, false)}
                          >
                            <Minus size={16} color="#666" />
                          </Pressable>
                          <Text style={styles.quantity}>
                            {String(item.quantity)}
                          </Text>
                          <Pressable
                            style={styles.quantityButton}
                            onPress={() => updateQuantity(item.id, true)}
                          >
                            <Plus size={16} color="#666" />
                          </Pressable>
                        </View>

                        <Pressable
                          style={styles.offerButton}
                          onPress={() => toggleOffered(item.id)}
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

          {/* Total */}
          <View style={styles.totalSection}>
            <View style={styles.finalTotal}>
              <Text style={styles.totalLabel}>Total:</Text>
              {offeredTotal > 0 && (
                <Text style={styles.offeredTotal}>
                  Offerts: {String(offeredTotal.toFixed(2))} €
                </Text>
              )}
              <Text style={styles.totalAmount}>
                {String(total.toFixed(2))} €
              </Text>
            </View>
          </View>

          {/* Boutons paiement */}
          <View style={styles.paymentActions}>
            <View style={styles.paymentRow}>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#4CAF50' }]}
                onPress={() => goToPayment('full')}
              >
                <CreditCard size={20} color="white" />
                <Text style={styles.paymentButtonText}>Total</Text>
              </Pressable>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#673AB7' }]}
                onPress={() => goToPayment('items')}
              >
                <ShoppingCart size={20} color="white" />
                <Text style={styles.paymentButtonText}>Articles</Text>
              </Pressable>
            </View>
            <View style={styles.paymentRow}>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#FF9800' }]}
                onPress={() => goToPayment('custom')}
              >
                <Receipt size={20} color="white" />
                <Text style={styles.paymentButtonText}>Custom</Text>
              </Pressable>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#2196F3' }]}
                onPress={() => goToPayment('split')}
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
            <Text style={styles.sectionTitle}>Menu & Carte</Text>
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
                  🍽️ Plats
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
                  🥤 Boissons
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Catégories avec séparateur */}
          <View style={styles.categoriesSection}>
            <Text style={styles.categoriesLabel}>Catégories</Text>
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
                  Tout voir
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
                      activeCategory === category &&
                        styles.activeCategoryTabText,
                    ]}
                  >
                    {category}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Séparateur visuel */}
          <View style={styles.menuDivider} />

          {/* Items du menu organisés par catégorie */}
          <ScrollView
            style={styles.menuItems}
            showsVerticalScrollIndicator={false}
          >
            {activeCategory ? (
              // Affichage d'une catégorie spécifique
              <View style={styles.categorySection}>
                <Text style={styles.categoryHeaderText}>{activeCategory}</Text>
                <View style={styles.menuGrid}>
                  {menuItems.map((item) => (
                    <Pressable
                      key={String(item.id)}
                      style={[styles.menuItem, { borderLeftColor: item.color }]}
                      onPress={() => addItem(item)}
                    >
                      <Text style={styles.menuItemName}>{item.name}</Text>
                      <Text style={styles.menuItemPrice}>
                        {String(item.price.toFixed(2))} €
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              // Affichage par catégories groupées
              categories.map((category) => {
                const categoryItems = menuItems.filter(
                  (item) => item.category === category
                );
                if (categoryItems.length === 0) return null;

                return (
                  <View key={category} style={styles.categorySection}>
                    <View style={styles.categoryHeader}>
                      <Text style={styles.categoryHeaderText}>{category}</Text>
                      <Text style={styles.categoryCount}>
                        ({String(categoryItems.length)})
                      </Text>
                    </View>
                    <View style={styles.menuGrid}>
                      {categoryItems.map((item) => (
                        <Pressable
                          key={String(item.id)}
                          style={[
                            styles.menuItem,
                            { borderLeftColor: item.color },
                          ]}
                          onPress={() => addItem(item)}
                        >
                          <Text style={styles.menuItemName}>{item.name}</Text>
                          <Text style={styles.menuItemPrice}>
                            {String(item.price.toFixed(2))} €
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>

      <SplitSelectionModal
        visible={splitModalVisible}
        onClose={() => setSplitModalVisible(false)}
        onConfirm={async (partsCount: number) => {
          await saveAndExit();
          router.push({
            pathname: '/payment/split',
            params: {
              tableId: String(tableId),
              total: String(total.toFixed(2)),
              guests: String(partsCount),
              items: JSON.stringify(items),
            },
          });
        }}
        defaultPartsCount={parseInt(guestCount) || 1}
        tableName={tableName}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: { marginTop: 15, fontSize: 16, color: '#333' },
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  backLink: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  headerTitleContainer: { flex: 1 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  sectionBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  sectionText: { color: '#1976d2', fontWeight: '600', fontSize: 12 },
  guestCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  guestCount: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6b35',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  clearButtonText: { color: 'white', fontWeight: '600' },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f44336',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  closeButtonText: { color: 'white', fontWeight: '600' },
  content: { flex: 1, padding: 12, gap: 12, flexDirection: 'row' },
  orderSection: {
    flex: 2,
    minWidth: 300,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuSection: {
    flex: 3,
    minWidth: 300,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: '#333',
  },
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
  paymentActions: { marginTop: 16, gap: 10 },
  paymentRow: { flexDirection: 'row', gap: 10 },
  paymentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  paymentButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  typeFilters: { flexDirection: 'row', gap: 8 },
  typeFilterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  activeTypeButton: { backgroundColor: '#2196F3', borderColor: '#2196F3' },
  typeFilterText: { fontSize: 14, fontWeight: '500', color: '#666' },
  activeTypeText: { color: 'white', fontWeight: '600' },
  categoriesSection: { marginBottom: 16 },
  categoriesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    paddingLeft: 4,
  },
  categoryTabs: { marginBottom: 8 },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  activeCategoryTab: { backgroundColor: '#e3f2fd', borderColor: '#2196F3' },
  categoryTabText: { fontSize: 13, fontWeight: '500', color: '#666' },
  activeCategoryTabText: { fontWeight: '600', color: '#2196F3' },
  menuDivider: { height: 1, backgroundColor: '#e9ecef', marginVertical: 16 },
  menuItems: { flex: 1 },
  categorySection: { marginBottom: 24 },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 4,
  },
  categoryHeaderText: { fontSize: 16, fontWeight: '600', color: '#333' },
  categoryCount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  menuItem: {
    width: '31%',
    minWidth: 120,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  menuItemName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
    color: '#333',
    lineHeight: 16,
  },
  menuItemPrice: { fontSize: 13, fontWeight: '700', color: '#4CAF50' },
});
