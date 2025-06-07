// app/table/[id].tsx - AVEC NOTE DE PRÉVISUALISATION

import * as Print from 'expo-print';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  startTransition,
  useDeferredValue,
  JSX,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
import { menuManager, useMenu } from '../../utils/MenuManager';
import { useInstanceManager } from '../../utils/useInstanceManager';
import { useSettings } from '@/utils/useSettings';
import SplitSelectionModal from '../components/SplitSelectionModal';

// ✅ Types
interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  type: 'resto' | 'boisson';
  color: string;
}

// ✅ Composant MenuItem optimisé
interface MenuItemProps {
  item: MenuItem;
  onPress: () => void;
}

const MenuItemComponent = memo<MenuItemProps>(({ item, onPress }) => (
  <Pressable
    style={[styles.menuItem, { borderLeftColor: item.color }]}
    onPress={onPress}
    android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
  >
    <Text style={styles.menuItemName}>{item.name}</Text>
    <Text style={styles.menuItemPrice}>{item.price.toFixed(2)} €</Text>
  </Pressable>
));


export default function TableScreen(): JSX.Element {
  const { id } = useLocalSearchParams();
  const tableId = parseInt(id as string, 10);
  const router = useRouter();
  const toast = useToast();
  const { refreshTables, getTableById, updateTableData } = useTableContext();
  const { restaurantInfo } = useSettings();

  // ✅ Utilisation des nouveaux hooks
  const { instanceId, isMounted, safeExecute, setSafeTimeout, addCleanup } =
    useInstanceManager('TableScreen');
  const {
    isLoaded: menuLoaded,
    getAvailableItems,
    getCategories,
    getItem: getMenuItem,
    getItemsByType,
    getItemsByCategory,
  } = useMenu();

  // ✅ États simplifiés
  const [table, setTable] = useState<Table | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [guestCount, setGuestCount] = useState<number>(1);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'resto' | 'boisson' | null>(
    'resto'
  );
  const [splitModalVisible, setSplitModalVisible] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);

  // ✅ État différé pour optimisation
  const deferredTable = useDeferredValue(table);

  // ✅ Fonction pour générer le HTML du ticket de prévisualisation
  const generatePreviewTicketHTML = useCallback(
    (
      table: Table,
      orderItems: OrderItem[],
      total: number,
      offeredTotal: number
    ) => {
      const dateObj = new Date();
      const dateFormatted = dateObj.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const timeFormatted = dateObj.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      let itemsHTML = '';
      if (orderItems.length > 0) {
        itemsHTML = `
      <div class="items-section">
        <table style="width: 100%; border-collapse: collapse; margin: 5mm 0;">
          <tr>
            <th style="text-align: left; padding: 2mm 0;">Qté</th>
            <th style="text-align: left; padding: 2mm 0;">Article</th>
            <th style="text-align: right; padding: 2mm 0;">Prix</th>
          </tr>
          ${orderItems
            .map(
              (item) => `
            <tr ${item.offered ? 'style="font-style: italic;"' : ''}>
              <td style="padding: 1mm 0;">${item.quantity}x</td>
              <td style="padding: 1mm 0;">${item.name}${
                item.offered ? ' (Offert)' : ''
              }</td>
              <td style="text-align: right; padding: 1mm 0;">${(
                item.price * item.quantity
              ).toFixed(2)}€</td>
            </tr>
          `
            )
            .join('')}
        </table>
      </div>
    `;
      }

      let offeredHTML = '';
      if (offeredTotal > 0) {
        offeredHTML = `
      <div class="total-line" style="font-style: italic;">
        <span>Articles offerts:</span>
        <span>${offeredTotal.toFixed(2)}€</span>
      </div>
    `;
      }

      return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @page { size: 80mm auto; margin: 0mm; }
          body { 
            font-family: 'Courier New', monospace; 
            width: 80mm;
            padding: 5mm;
            margin: 0;
            font-size: 14pt;
          }
          .header, .footer { 
            text-align: center; 
            margin-bottom: 5mm;
          }
          .header h1 {
            font-size: 18pt;
            margin: 0 0 2mm 0;
          }
          .header p, .footer p {
            margin: 0 0 1mm 0;
            font-size: 14pt;
          }
          .divider {
            border-bottom: 1px dashed #000;
            margin: 3mm 0;
          }
          .info {
            margin-bottom: 3mm;
          }
          .info p {
            margin: 0 0 1mm 0;
          }
          .totals {
            margin: 2mm 0;
          }
          .total-line {
            display: flex;
            justify-content: space-between;
            margin: 1mm 0;
            font-size: 16pt;
          }
          .total-amount {
            font-weight: bold;
            font-size: 16pt;
            text-align: right;
            margin: 2mm 0;
          }
          .preview-info {
            text-align: center;
            margin: 3mm 0;
            font-size: 14pt;
          }
          .preview-info p {
            margin: 0 0 1mm 0;
          }
          th, td {
            padding: 1mm 0;
            font-size: 14pt;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${restaurantInfo.name}</h1>
          <p>${restaurantInfo.address}</p>
          <p>${restaurantInfo.phone}</p>
        </div>
        
        <div class="info">
          <p><strong>${table.name}</strong></p>
          <p>Date: ${dateFormatted} ${timeFormatted}</p>
          <p>Section: ${table.section}</p>
          <p>Invités: ${guestCount}</p>
        </div>

        <div class="divider"></div>

        ${itemsHTML}

        <div class="totals">
          <div class="total-line">
            <span>Articles:</span>
            <span>${orderItems.length}</span>
          </div>
          ${offeredHTML}
          <div class="total-amount">
            TOTAL: ${total.toFixed(2)}€
          </div>
        </div>

        <div class="divider"></div>

        <div class="preview-info">
          <p><strong>TICKET DE PRÉVISUALISATION</strong></p>
          <p>⚠️ Cette commande n'a pas été payée ⚠️</p>
        </div>

        <div class="divider"></div>

        <div class="footer">
          <p>${restaurantInfo.taxInfo}</p>
          <p>Document de prévisualisation - ${restaurantInfo.owner}</p>
        </div>
      </body>
    </html>
  `;
    },
    [restaurantInfo, guestCount]
  );

  // ✅ Fonction de calcul du total mémorisée
  const calculateTotal = useCallback((items: OrderItem[]): number => {
    return items.reduce((sum, item) => {
      return item.offered ? sum : sum + item.price * item.quantity;
    }, 0);
  }, []);

  // ✅ Charger la table
  const loadTable = useCallback(async (): Promise<void> => {
    if (!isMounted()) return;

    try {
      let tableData = getTableById(tableId);
      if (!tableData) {
        const loadedTable = await getTable(tableId);
        tableData = loadedTable || undefined;
      }

      if (tableData && isMounted()) {
        setTable(tableData);
        setGuestCount(tableData.guests || 1);
      }
    } catch (error) {
      console.error('Error loading table:', error);
    } finally {
      if (isMounted()) {
        setLoading(false);
      }
    }
  }, [tableId, getTableById, isMounted]);

  // ✅ Chargement initial et focus
  useEffect(() => {
    loadTable();
  }, [loadTable]);

  useEffect(() => {
    loadTable();
  }, [tableId]);

  // ✅ Modifier la gestion du bouton retour pour être plus brutal
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        router.replace('/');
        return true;
      }
    );

    addCleanup(() => {
      backHandler.remove();
    });
  }, [router, addCleanup]);

  // ✅ Handler pour ajouter un item (avec debounce)
  const addItemToOrder = useCallback(
    (item: MenuItem): void => {
      if (!table || !isMounted()) return;

      safeExecute(() => {
        setTable((prevTable) => {
          if (!prevTable) return prevTable;

          const updatedTable = { ...prevTable };

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
              orderItem.menuId === item.id &&
              orderItem.name === item.name &&
              orderItem.price === item.price
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

          return updatedTable;
        });
      });

      setSafeTimeout(async () => {
        if (!isMounted()) return;

        try {
          const currentTable = getTableById(tableId);
          if (currentTable) {
            await updateTableData(tableId, currentTable);
          }
        } catch (error) {
          console.error('Error saving table updates:', error);
          if (isMounted()) {
            loadTable();
            toast.showToast('Erreur lors de la sauvegarde', 'error');
          }
        }
      }, 500);
    },
    [
      table,
      guestCount,
      tableId,
      updateTableData,
      getTableById,
      loadTable,
      toast,
      calculateTotal,
      isMounted,
      safeExecute,
      setSafeTimeout,
    ]
  );

  // ✅ Items de menu filtrés (utilise le nouveau système)
  const filteredMenuItems = useMemo((): MenuItem[] => {
    if (!menuLoaded) {
      return [];
    }

    let filtered = getAvailableItems();

    if (activeType) {
      filtered = filtered.filter((item) => item.type === activeType);
    }

    if (activeCategory) {
      filtered = filtered.filter((item) => item.category === activeCategory);
    }

    return filtered;
  }, [menuLoaded, activeType, activeCategory, getAvailableItems]);

  // ✅ Catégories (utilise le nouveau système)
  const categories = useMemo((): string[] => {
    if (!menuLoaded) {
      return [];
    }

    return getCategories(activeType || undefined);
  }, [menuLoaded, activeType, getCategories]);

  // ✅ Items de commande catégorisés
  const categorizedOrderItems = useMemo(() => {
    if (!deferredTable?.order?.items) return { plats: [], boissons: [] };

    const result = { plats: [] as OrderItem[], boissons: [] as OrderItem[] };

    deferredTable.order.items.forEach((item) => {
      // ✅ Utiliser le type stocké dans l'item ou fallback sur menu
      const itemType =
        item.type || getMenuItem(item.menuId || item.id)?.type || 'resto';
      result[itemType === 'boisson' ? 'boissons' : 'plats'].push(item);
    });

    return result;
  }, [deferredTable?.order?.items, getMenuItem]);

  // ✅ Autres handlers (simplifiés mais fonctionnels)
  const updateItemQuantity = useCallback(
    (itemId: number, increment: boolean): void => {
      if (!table?.order || !isMounted()) return;

      safeExecute(() => {
        setTable((prevTable) => {
          if (!prevTable?.order) return prevTable;

          const updatedTable = { ...prevTable };
          const newItems: OrderItem[] = [];

          for (const item of updatedTable.order!.items) {
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

          updatedTable.order!.items = newItems;
          updatedTable.order!.total = calculateTotal(newItems);

          return updatedTable;
        });
      });

      setSafeTimeout(async () => {
        if (!isMounted()) return;
        try {
          const currentTable = getTableById(tableId);
          if (currentTable) {
            await updateTableData(tableId, currentTable);
          }
        } catch (error) {
          console.error('Error updating quantity:', error);
        }
      }, 500);
    },
    [
      table?.order,
      tableId,
      updateTableData,
      getTableById,
      calculateTotal,
      isMounted,
      safeExecute,
      setSafeTimeout,
    ]
  );

  const toggleItemOffered = useCallback(
    (itemId: number): void => {
      if (!table?.order || !isMounted()) return;

      safeExecute(() => {
        setTable((prevTable) => {
          if (!prevTable?.order) return prevTable;

          const updatedTable = { ...prevTable };
          const newItems = updatedTable.order!.items.map((item) => {
            return item.id !== itemId
              ? item
              : { ...item, offered: !item.offered };
          });

          updatedTable.order!.items = newItems;
          updatedTable.order!.total = calculateTotal(newItems);

          return updatedTable;
        });
      });

      setSafeTimeout(async () => {
        if (!isMounted()) return;
        try {
          const currentTable = getTableById(tableId);
          if (currentTable) {
            await updateTableData(tableId, currentTable);
          }
        } catch (error) {
          console.error('Error toggling offered:', error);
        }
      }, 500);
    },
    [
      table?.order,
      tableId,
      updateTableData,
      getTableById,
      calculateTotal,
      isMounted,
      safeExecute,
      setSafeTimeout,
    ]
  );

  const updateGuestCount = useCallback(
    (newCount: number): void => {
      if (!table) return;

      const validCount = Math.max(1, newCount);
      setGuestCount(validCount);

      setTable((prevTable) => {
        if (!prevTable) return prevTable;
        return {
          ...prevTable,
          guests: validCount,
          order: prevTable.order
            ? { ...prevTable.order, guests: validCount }
            : undefined,
        };
      });

      setSafeTimeout(async () => {
        try {
          const currentTable = getTableById(tableId);
          if (currentTable) {
            await updateTableData(tableId, currentTable);
          }
        } catch (error) {
          console.error('Error updating guest count:', error);
        }
      }, 1000);
    },
    [table, tableId, updateTableData, getTableById, setSafeTimeout]
  );

  // ✅ Handlers d'actions
  const handleClearOrder = useCallback((): void => {
    if (!table?.order || table.order.items.length === 0) return;

    Alert.alert(
      'Supprimer la commande',
      'Êtes-vous sûr de vouloir supprimer tous les articles ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            safeExecute(() => {
              setTable((prevTable) => {
                if (!prevTable?.order) return prevTable;
                return {
                  ...prevTable,
                  order: { ...prevTable.order, items: [], total: 0 },
                };
              });
            });

            setSafeTimeout(async () => {
              try {
                const currentTable = getTableById(tableId);
                if (currentTable) {
                  await updateTableData(tableId, currentTable);
                  toast.showToast('Commande supprimée', 'success');
                }
              } catch (error) {
                console.error('Error clearing order:', error);
                loadTable();
                toast.showToast('Impossible de supprimer la commande', 'error');
              }
            }, 100);
          },
        },
      ]
    );
  }, [
    table?.order,
    tableId,
    updateTableData,
    getTableById,
    loadTable,
    toast,
    safeExecute,
    setSafeTimeout,
  ]);

  const handleCloseTable = useCallback((): void => {
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
            try {
              await resetTable(tableId);
              setTable(null);
              setGuestCount(1);
              refreshTables();
              router.replace('/');
              toast.showToast(`Table ${table.name} fermée`, 'success');
            } catch (error) {
              console.error('Error closing table:', error);
              toast.showToast('Erreur lors de la fermeture', 'error');
            }
          },
        },
      ]
    );
  }, [table, tableId, refreshTables, router, toast]);

  const handlePayment = useCallback(
    (type: 'full' | 'split' | 'custom' | 'items'): void => {
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

  // ✅ Handler pour générer le ticket de prévisualisation
  const handlePreviewNote = useCallback(async () => {
    if (!table || !isMounted()) return;

    if (!table.order || table.order.items.length === 0) {
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

      await Print.printAsync({
        html: ticketHTML,
      });

      if (isMounted()) {
        toast.showToast('Ticket de prévisualisation généré', 'success');
      }
    } catch (error) {
      console.error('Erreur lors de la génération du ticket:', error);
      if (isMounted()) {
        toast.showToast('Impossible de générer le ticket', 'error');
      }
    } finally {
      if (isMounted()) {
        setProcessing(false);
      }
    }
  }, [table, generatePreviewTicketHTML, toast, isMounted]);

  // ✅ Calculs dérivés
  const offeredTotal = useMemo((): number => {
    if (!deferredTable?.order?.items) return 0;
    return deferredTable.order.items.reduce((sum, item) => {
      return item.offered ? sum + item.price * item.quantity : sum;
    }, 0);
  }, [deferredTable?.order?.items]);

  // ✅ Affichage conditionnel pour le chargement
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
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  // ✅ Affichage si menu pas encore chargé
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
          <View style={styles.headerTitleContainer}>
            <Text style={styles.title}>{table.name}</Text>
          </View>
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
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace('/')}
          style={({ pressed }) => [
            styles.backLink,
            pressed && { backgroundColor: '#d0d0d0' },
          ]}
        >
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

        {/* ✅ NOUVEAU BOUTON NOTE DE PRÉVISUALISATION */}
        <Pressable
          style={[
            styles.paymentButton,
            { backgroundColor: '#673AB7', marginRight: 8 },
          ]}
          onPress={handlePreviewNote}
        >
          <FileText size={24} color="white" />
          <Text style={styles.paymentButtonText}>Note</Text>
        </Pressable>

        <Pressable
          style={[
            styles.paymentButton,
            {
              backgroundColor: orderItems.length > 0 ? '#FF6600' : '#BDBDBD',
            },
          ]}
          onPress={handleClearOrder}
          disabled={orderItems.length === 0}
        >
          <ShoppingCart size={24} color="white" />
          <Text style={styles.paymentButtonText}>Vider</Text>
        </Pressable>

        <Pressable
          style={[
            styles.paymentButton,
            { backgroundColor: '#F44336', marginLeft: 8 },
          ]}
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
              Aucun article dans la commande. Ajoutez-en depuis le menu.
            </Text>
          ) : (
            <View style={styles.orderColumns}>
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
              <Text style={styles.totalLabel}>Total:</Text>
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
              <Text style={styles.totalAmount}>{total.toFixed(2)} €</Text>
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
                  startTransition(() => {
                    setActiveType('resto');
                    setActiveCategory(null);
                  });
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
                  startTransition(() => {
                    setActiveType('boisson');
                    setActiveCategory(null);
                  });
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
                  startTransition(() => {
                    setActiveType(null);
                    setActiveCategory(null);
                  });
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
              onPress={() => {
                startTransition(() => {
                  setActiveCategory(null);
                });
              }}
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
                onPress={() => {
                  startTransition(() => {
                    setActiveCategory(category);
                  });
                }}
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

// ✅ Styles mis à jour avec les nouveaux composants
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    padding: 20,
  },
  loadingText: { marginTop: 15, fontSize: 16, color: '#333' },
  backButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  backButtonPressed: {
    backgroundColor: 'red',
    transform: [{ scale: 0.98 }],
    opacity: 0.8,
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
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: '#e0e0e0',
    marginTop: 8,
  },
  finalTotal: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  totalLabel: { fontSize: 16, fontWeight: '600', alignItems: 'center' },
  totalAmount: { fontSize: 20, fontWeight: 'bold', color: '#4CAF50' },
  offeredTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offeredTotalLabel: { fontSize: 14, color: '#FF9800', fontWeight: '500' },
  offeredTotalAmount: { fontSize: 16, fontWeight: '600', color: '#FF9800' },
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

  // ✅ STYLES POUR L'OVERLAY DE PROCESSING
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
  processingText: {
    color: 'white',
    marginTop: 12,
    fontSize: 16,
  },
});
