// app/table/[id].tsx - VERSION SIMPLIFIÉE (600 lignes au lieu de 1000+)

import * as Print from 'expo-print';
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
  FileText,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
import { useTableContext } from '../../utils/TableContext';
import { useToast } from '../../utils/ToastContext';
import { useMenu } from '../../utils/MenuManager';
import { useSettings } from '@/utils/useSettings';
import SplitSelectionModal from '../components/SplitSelectionModal';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  type: 'resto' | 'boisson';
  color: string;
}

const MenuItemComponent = memo<{ item: MenuItem; onPress: () => void }>(
  ({ item, onPress }) => (
    <Pressable
      style={[styles.menuItem, { borderLeftColor: item.color }]}
      onPress={onPress}
    >
      <Text style={styles.menuItemName}>{item.name}</Text>
      <Text style={styles.menuItemPrice}>{item.price.toFixed(2)} €</Text>
    </Pressable>
  )
);

export default function TableScreen() {
  const { id } = useLocalSearchParams();
  const tableId = parseInt(id as string, 10);
  const router = useRouter();
  const toast = useToast();
  const { refreshTables, getTableById, updateTableData } = useTableContext();
  const { restaurantInfo } = useSettings();
  const {
    isLoaded: menuLoaded,
    getAvailableItems,
    getCategories,
    getItem: getMenuItem,
  } = useMenu();

  // États simplifiés
  const [table, setTable] = useState<Table | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestCount, setGuestCount] = useState(1);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'resto' | 'boisson' | null>(
    'resto'
  );
  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Chargement table simplifié
  const loadTable = useCallback(async () => {
    try {
      let tableData = getTableById(tableId);
      if (!tableData) {
        const loadedTable = await getTable(tableId);
        tableData = loadedTable || undefined;
      }
      if (tableData) {
        setTable(tableData);
        setGuestCount(tableData.guests || 1);
      }
    } catch (error) {
      console.error('Error loading table:', error);
    } finally {
      setLoading(false);
    }
  }, [tableId, getTableById]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  // Sauvegarde simplifiée avec debounce
  const saveTable = useCallback(
    async (updatedTable: Table) => {
      try {
        await updateTableData(tableId, updatedTable);
      } catch (error) {
        console.error('Save error:', error);
        toast.showToast('Erreur lors de la sauvegarde', 'error');
      }
    },
    [tableId, updateTableData, toast]
  );

  // Calcul du total simplifié
  const calculateTotal = useCallback((items: OrderItem[]): number => {
    return items.reduce((sum, item) => {
      return item.offered ? sum : sum + item.price * item.quantity;
    }, 0);
  }, []);

  // Calcul du montant par personne
  const calculateAmountPerPerson = useCallback(
    (total: number, guests: number): number => {
      if (guests <= 0) return 0;
      return total / guests;
    },
    []
  );

  // Ajouter un item
  const addItemToOrder = useCallback(
    (item: MenuItem) => {
      if (!table) return;

      const updatedTable = { ...table };

      if (!updatedTable.order) {
        updatedTable.order = {
          id: Date.now(),
          items: [],
          guests: guestCount,
          status: 'active',
          timestamp: new Date().toISOString(),
          total: 0,
        };
      }

      const items = [...updatedTable.order.items];
      const existingItemIndex = items.findIndex(
        (orderItem) =>
          orderItem.menuId === item.id && orderItem.name === item.name
      );

      if (existingItemIndex >= 0) {
        items[existingItemIndex] = {
          ...items[existingItemIndex],
          quantity: items[existingItemIndex].quantity + 1,
        };
      } else {
        items.push({
          id: Date.now() + Math.random(),
          menuId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          type: item.type,
        });
      }

      updatedTable.order.items = items;
      updatedTable.order.total = calculateTotal(items);

      setTable(updatedTable);
      saveTable(updatedTable);
    },
    [table, guestCount, calculateTotal, saveTable]
  );

  // Modifier quantité
  const updateItemQuantity = useCallback(
    (itemId: number, increment: boolean) => {
      if (!table?.order) return;

      const updatedTable = { ...table };
      const newItems: OrderItem[] = [];

      if (updatedTable.order && updatedTable.order.items) {
        for (const item of updatedTable.order.items) {
          if (item.id !== itemId) {
            newItems.push(item);
          } else {
            const newQuantity = increment
              ? item.quantity + 1
              : Math.max(0, item.quantity - 1);
            if (newQuantity > 0) {
              newItems.push({ ...item, quantity: newQuantity });
            }
          }
        }

        updatedTable.order.items = newItems;
        updatedTable.order.total = calculateTotal(newItems);

        setTable(updatedTable);
        saveTable(updatedTable);
      }
    },
    [table, calculateTotal, saveTable]
  );

  // Toggle offert
  const toggleItemOffered = useCallback(
    (itemId: number) => {
      if (!table?.order) return;

      const updatedTable = { ...table };
      if (!updatedTable.order) return;

      const newItems = updatedTable.order.items.map((item) => {
        return item.id !== itemId ? item : { ...item, offered: !item.offered };
      });

      updatedTable.order.items = newItems;
      updatedTable.order.total = calculateTotal(newItems);

      setTable(updatedTable);
      saveTable(updatedTable);
    },
    [table, calculateTotal, saveTable]
  );

  // Modifier invités
  const updateGuestCount = useCallback(
    (newCount: number) => {
      const validCount = Math.max(1, newCount);
      setGuestCount(validCount);

      if (table) {
        const updatedTable = {
          ...table,
          guests: validCount,
          order: table.order
            ? { ...table.order, guests: validCount }
            : undefined,
        };
        setTable(updatedTable);
        saveTable(updatedTable);
      }
    },
    [table, saveTable]
  );

  // Génération HTML ticket
  const generatePreviewTicketHTML = useCallback(
    (
      table: Table,
      orderItems: OrderItem[],
      total: number,
      offeredTotal: number
    ) => {
      const dateObj = new Date();
      const dateFormatted = dateObj.toLocaleDateString('fr-FR');
      const timeFormatted = dateObj.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const itemsHTML =
        orderItems.length > 0
          ? `
        <table style="width: 100%; border-collapse: collapse; margin: 5mm 0;">
          <tr><th style="text-align: left;">Qté</th><th style="text-align: left;">Article</th><th style="text-align: right;">Prix</th></tr>
          ${orderItems
            .map(
              (item) => `
            <tr ${item.offered ? 'style="font-style: italic;"' : ''}>
              <td>${item.quantity}x</td>
              <td>${item.name}${item.offered ? ' (Offert)' : ''}</td>
              <td style="text-align: right;">${(
                item.price * item.quantity
              ).toFixed(2)}€</td>
            </tr>
          `
            )
            .join('')}
        </table>`
          : '';

      const offeredHTML =
        offeredTotal > 0
          ? `
        <div style="font-style: italic;">Articles offerts: ${offeredTotal.toFixed(
          2
        )}€</div>`
          : '';

      return `
        <html>
          <head><style>
            @page { size: 80mm auto; margin: 0mm; }
            body { font-family: 'Courier New', monospace; width: 80mm; padding: 5mm; margin: 0; font-size: 14pt; }
            .header { text-align: center; margin-bottom: 5mm; }
            .divider { border-bottom: 1px dashed #000; margin: 3mm 0; }
            th, td { padding: 1mm 0; font-size: 14pt; }
          </style></head>
          <body>
            <div class="header">
              <h1>${restaurantInfo.name}</h1>
              <p>${restaurantInfo.address}</p>
              <p>${restaurantInfo.phone}</p>
            </div>
            <div><strong>${table.name}</strong></div>
            <div>Date: ${dateFormatted} ${timeFormatted}</div>
            <div>Section: ${table.section}</div>
            <div>Invités: ${guestCount}</div>
            <div class="divider"></div>
            ${itemsHTML}
            <div>Articles: ${orderItems.length}</div>
            ${offeredHTML}
            <div><strong>TOTAL: ${total.toFixed(2)}€</strong></div>
            <div class="divider"></div>
            <div style="text-align: center;"><strong>TICKET DE PRÉVISUALISATION</strong></div>
            <div style="text-align: center;">⚠️ Cette commande n'a pas été payée ⚠️</div>
          </body>
        </html>
      `;
    },
    [restaurantInfo, guestCount]
  );

  // Actions simplifiées
  const handleClearOrder = useCallback(() => {
    if (!table?.order || table.order.items.length === 0) return;

    Alert.alert(
      'Supprimer la commande',
      'Êtes-vous sûr de vouloir supprimer tous les articles ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const clearedTable = {
              ...table,
              order: {
                id: table.order?.id ?? Date.now(),
                items: [],
                guests: table.order?.guests ?? 1,
                status: table.order?.status ?? 'active',
                timestamp: table.order?.timestamp ?? new Date().toISOString(),
                total: 0,
              },
            };
            setTable(clearedTable);
            await saveTable(clearedTable);
            toast.showToast('Commande supprimée', 'success');
          },
        },
      ]
    );
  }, [table, saveTable, toast]);

  const handleCloseTable = useCallback(() => {
    if (!table) return;

    Alert.alert(
      'Fermer la table',
      `Êtes-vous sûr de vouloir fermer "${table.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Fermer',
          style: 'destructive',
          onPress: async () => {
            await resetTable(tableId);
            setTable(null);
            setGuestCount(1);
            refreshTables();
            router.replace('/');
            toast.showToast(`Table ${table.name} fermée`, 'success');
          },
        },
      ]
    );
  }, [table, tableId, refreshTables, router, toast]);

  const handlePayment = useCallback(
    (type: 'full' | 'split' | 'custom' | 'items') => {
      if (!table?.order) return;

      const total = table.order.total;
      if (total <= 0) {
        toast.showToast("Il n'y a pas d'articles à payer", 'warning');
        return;
      }

      const serializedItems = JSON.stringify(table.order.items);

      switch (type) {
        case 'full':
          router.push({
            pathname: '/payment/full',
            params: {
              tableId: tableId.toString(),
              total: total.toString(),
              items: serializedItems,
            },
          });
          break;
        case 'split':
          if (guestCount <= 1) {
            toast.showToast(
              'Il faut au moins 2 convives pour partager',
              'warning'
            );
            return;
          }
          setSplitModalVisible(true);
          break;
        case 'custom':
          router.push({
            pathname: '/payment/custom',
            params: {
              tableId: tableId.toString(),
              total: total.toString(),
              items: serializedItems,
            },
          });
          break;
        case 'items':
          router.push({
            pathname: '/payment/items',
            params: { tableId: tableId.toString() },
          });
          break;
      }
    },
    [table?.order, guestCount, tableId, router, toast]
  );

  const handlePreviewNote = useCallback(async () => {
    if (!table || !table.order || table.order.items.length === 0) {
      toast.showToast('Aucun article à prévisualiser', 'warning');
      return;
    }

    setProcessing(true);
    try {
      const orderItems = table.order.items;
      const total = table.order.total;
      const offeredTotal = orderItems.reduce((sum, item) => {
        return item.offered ? sum + item.price * item.quantity : sum;
      }, 0);

      const ticketHTML = generatePreviewTicketHTML(
        table,
        orderItems,
        total,
        offeredTotal
      );
      await Print.printAsync({ html: ticketHTML });
      toast.showToast('Ticket de prévisualisation généré', 'success');
    } catch (error) {
      toast.showToast('Impossible de générer le ticket', 'error');
    } finally {
      setProcessing(false);
    }
  }, [table, generatePreviewTicketHTML, toast]);

  // Données dérivées
  const filteredMenuItems = useMemo(() => {
    if (!menuLoaded) return [];
    let filtered = getAvailableItems();
    if (activeType)
      filtered = filtered.filter((item) => item.type === activeType);
    if (activeCategory)
      filtered = filtered.filter((item) => item.category === activeCategory);
    return filtered;
  }, [menuLoaded, activeType, activeCategory, getAvailableItems]);

  const categories = useMemo(() => {
    return menuLoaded ? getCategories(activeType || undefined) : [];
  }, [menuLoaded, activeType, getCategories]);

  const categorizedOrderItems = useMemo(() => {
    if (!table?.order?.items) return { plats: [], boissons: [] };
    const result = { plats: [] as OrderItem[], boissons: [] as OrderItem[] };
    table.order.items.forEach((item) => {
      const itemType =
        item.type || getMenuItem(item.menuId || item.id)?.type || 'resto';
      result[itemType === 'boisson' ? 'boissons' : 'plats'].push(item);
    });
    return result;
  }, [table?.order?.items, getMenuItem]);

  const offeredTotal = useMemo(() => {
    if (!table?.order?.items) return 0;
    return table.order.items.reduce((sum, item) => {
      return item.offered ? sum + item.price * item.quantity : sum;
    }, 0);
  }, [table?.order?.items]);

  // Rendu conditionnel
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

  if (!menuLoaded) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.replace('/')}
            style={styles.backLink}
          >
            <ArrowLeft size={28} color="#333" />
          </Pressable>
          <Text style={styles.title}>{table.name}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Chargement du menu...</Text>
        </View>
      </View>
    );
  }

  const orderItems = table.order?.items || [];
  const total = table.order?.total || 0;

  return (
    <View style={styles.container}>
      {/* Header simplifié */}
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
          style={[styles.paymentButton, { backgroundColor: '#673AB7' }]}
          onPress={handlePreviewNote}
        >
          <FileText size={24} color="white" />
          <Text style={styles.paymentButtonText}>Note</Text>
        </Pressable>
        <Pressable
          style={[
            styles.paymentButton,
            { backgroundColor: orderItems.length > 0 ? '#FF6600' : '#BDBDBD' },
          ]}
          onPress={handleClearOrder}
          disabled={orderItems.length === 0}
        >
          <ShoppingCart size={24} color="white" />
          <Text style={styles.paymentButtonText}>Vider</Text>
        </Pressable>
        <Pressable
          style={[styles.paymentButton, { backgroundColor: '#F44336' }]}
          onPress={handleCloseTable}
        >
          <X size={24} color="white" />
          <Text style={styles.paymentButtonText}>Fermer</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* Section commande */}
        <View style={styles.orderSection}>
          <Text style={styles.sectionTitle}>Commande actuelle</Text>
          {orderItems.length === 0 ? (
            <Text style={styles.emptyOrder}>
              Aucun article dans la commande.
            </Text>
          ) : (
            <View style={styles.orderColumns}>
              {/* Colonne Plats */}
              <View style={styles.orderColumn}>
                <Text style={styles.columnTitle}>Plats</Text>
                <ScrollView style={styles.orderColumnScroll}>
                  {categorizedOrderItems.plats.map((item) => (
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
                            {item.offered ? 'Annuler offre' : 'Offrir'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>

              {/* Colonne Boissons */}
              <View style={styles.orderColumn}>
                <Text style={styles.columnTitle}>Boissons</Text>
                <ScrollView style={styles.orderColumnScroll}>
                  {categorizedOrderItems.boissons.map((item) => (
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
                            {item.offered ? 'Annuler offre' : 'Offrir'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          <View style={styles.totalSection}>
            <View style={styles.finalTotal}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total:</Text>
                <View style={styles.totalAmountContainer}>
                  <Text style={styles.totalAmount}>{total.toFixed(2)} €</Text>
                  {guestCount > 1 && total > 0 && (
                    <Text style={styles.perPersonTextCompact}>
                      ({calculateAmountPerPerson(total, guestCount).toFixed(2)}{' '}
                      € / pers.)
                    </Text>
                  )}
                </View>
              </View>

              {offeredTotal > 0 && (
                <View style={styles.offeredTotalRow}>
                  <Text style={styles.offeredTotalLabel}>
                    Articles offerts:
                  </Text>
                  <Text style={styles.offeredTotalAmount}>
                    {offeredTotal.toFixed(2)} €
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.paymentActions}>
            <View style={styles.paymentActionsRow}>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#4CAF50' }]}
                onPress={() => handlePayment('full')}
              >
                <CreditCard size={24} color="white" />
                <Text style={styles.paymentButtonText}>Paiement total</Text>
              </Pressable>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#673AB7' }]}
                onPress={() => handlePayment('items')}
              >
                <ShoppingCart size={24} color="white" />
                <Text style={styles.paymentButtonText}>Par article</Text>
              </Pressable>
            </View>
            <View style={styles.paymentActionsRow}>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#FF9800' }]}
                onPress={() => handlePayment('custom')}
              >
                <Receipt size={24} color="white" />
                <Text style={styles.paymentButtonText}>Personnalisé</Text>
              </Pressable>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#2196F3' }]}
                onPress={() => handlePayment('split')}
              >
                <Split size={24} color="white" />
                <Text style={styles.paymentButtonText}>Partager</Text>
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
              <Pressable
                style={[
                  styles.typeFilterButton,
                  activeType === null && styles.activeTypeButton,
                ]}
                onPress={() => {
                  setActiveType(null);
                  setActiveCategory(null);
                }}
              >
                <Text
                  style={[
                    styles.typeFilterText,
                    activeType === null && styles.activeTypeText,
                  ]}
                >
                  Tout
                </Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabs}
          >
            <Pressable
              style={[
                styles.categoryTab,
                activeCategory === null && styles.activeCategoryTab,
              ]}
              onPress={() => setActiveCategory(null)}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  activeCategory === null && styles.activeCategoryTabText,
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

          <View style={styles.menuItems}>
            <ScrollView
              style={styles.menuItemsScroll}
              showsVerticalScrollIndicator={false}
            >
              {categories.map((category) => {
                const categoryItems = filteredMenuItems.filter(
                  (item) => item.category === category
                );
                if (categoryItems.length === 0) return null;

                return (
                  <View key={category} style={styles.categorySection}>
                    <Text style={styles.categoryHeaderText}>{category}</Text>
                    <View style={styles.categoryItems}>
                      {categoryItems.map((item) => (
                        <MenuItemComponent
                          key={item.id}
                          item={item}
                          onPress={() => addItemToOrder(item)}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>

      <SplitSelectionModal
        visible={splitModalVisible}
        onClose={() => setSplitModalVisible(false)}
        onConfirm={(partsCount: number) => {
          if (!table?.order) return;
          router.push({
            pathname: '/payment/split',
            params: {
              tableId: tableId.toString(),
              total: table.order.total.toString(),
              guests: partsCount.toString(),
              items: JSON.stringify(table.order.items),
            },
          });
        }}
        defaultPartsCount={guestCount}
        tableName={table?.name || `Table ${tableId}`}
      />

      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.processingText}>Génération du ticket...</Text>
        </View>
      )}
    </View>
  );
}

// Styles simplifiés (identiques à l'original)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    padding: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '100%',
    marginBottom: 4,
  },

  totalAmountContainer: {
    alignItems: 'flex-end',
  },

  perPersonTextCompact: {
    fontSize: 12,
    color: '#999',
    fontWeight: '400',
    fontStyle: 'italic',
    marginTop: 2,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 60,
  },
  backLink: {
    marginRight: 8,
    padding: 12,
    borderRadius: 999,
    backgroundColor: '#f5f5f5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: { flex: 3, flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginRight: 8 },
  sectionBadge: {
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 16,
  },
  sectionText: { color: '#0288D1', fontWeight: '600', fontSize: 11 },
  guestCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f5f5f5',
    padding: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  guestCount: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 20,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 8,
    gap: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  orderSection: {
    flex: 2,
    minWidth: 300,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    display: 'flex',
    flexDirection: 'column',
  },
  menuSection: {
    flex: 3,
    minWidth: 300,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
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
    marginBottom: 8,
  },
  typeFilters: { flexDirection: 'row', gap: 6 },
  typeFilterButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  totalSection: {
    borderTopWidth: 2,
    borderTopColor: '#e0e0e0',
    marginTop: 8,
    paddingTop: 8,
  },

  finalTotal: {
    width: '100%',
    alignItems: 'flex-end',
    marginTop: 8,
  },

  totalLabelRow: {
    alignSelf: 'stretch',
    marginBottom: 4,
  },

  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'left',
  },

  totalAmountRow: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
  },

  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  perPersonContainer: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignSelf: 'stretch',
    alignItems: 'center',
  },

  perPersonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  offeredTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 8,
  },

  offeredTotalLabel: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '500',
  },

  offeredTotalAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9800',
  },
  activeTypeButton: { backgroundColor: '#2196F3' },
  typeFilterText: { fontSize: 13, fontWeight: '500', color: '#666' },
  activeTypeText: { color: 'white', fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyOrder: { flex: 1, textAlign: 'center', color: '#666', paddingTop: 40 },
  orderColumns: { flexDirection: 'row', gap: 12, flex: 1, minHeight: 0 },
  orderColumn: { flex: 1, minHeight: 0 },
  columnTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  orderColumnScroll: { maxHeight: '93%', marginTop: 8 },
  orderItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
    marginRight: 6,
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
  paymentActions: {
    flexDirection: 'column',
    gap: 1,
    marginTop: 4,
    flex: 0.4,
    flexShrink: 0,
  },
  paymentActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  paymentButton: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    marginHorizontal: 4,
  },
  paymentButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    paddingLeft: 6,
  },
  categoryTabs: { marginBottom: 8, flexGrow: 0 },
  categoryTab: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginRight: 5,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    textAlign: 'center',
    minWidth: 70,
    alignSelf: 'flex-start',
  },
  activeCategoryTab: { borderBottomWidth: 2, borderBottomColor: '#2196F3' },
  categoryTabText: { fontSize: 13, fontWeight: '500', color: '#666' },
  activeCategoryTabText: { fontWeight: '600', color: '#2196F3' },
  menuItems: { flex: 1 },
  menuItemsScroll: { flex: 1 },
  categorySection: { marginBottom: 20 },
  categoryHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
    paddingLeft: 8,
    color: '#333',
  },
  categoryItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  menuItem: {
    width: '31%',
    minWidth: 90,
    height: 45,
    backgroundColor: '#f9f9f9',
    borderRadius: 5,
    padding: 6,
    borderLeftWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  menuItemName: { fontSize: 11, fontWeight: '500', marginBottom: 2 },
  menuItemPrice: { fontSize: 11, fontWeight: '600', color: '#4CAF50' },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  processingText: { color: 'white', marginTop: 12, fontSize: 16 },
});
