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
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import priceData from '../../helpers/ManjosPrice';
import { EVENT_TYPES, events } from '../../utils/events';
import {
  CustomMenuItem,
  OrderItem,
  Table,
  getCustomMenuItems,
  getMenuAvailability,
  getTable,
  resetTable,
  updateTable,
} from '../../utils/storage';
import { useTableContext } from '../../utils/TableContext';
import { useToast } from '../../utils/ToastContext';
import SplitSelectionModal from '../components/SplitSelectionModal';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  type: 'resto' | 'boisson';
  color: string;
}

const serializationCache = new Map<string, string>();

const getCachedSerialization = (items: OrderItem[]): string => {
  // Créer une clé basée sur les items (hash simple)
  const cacheKey = items
    .map((item) => `${item.id}-${item.quantity}-${item.offered || false}`)
    .join('|');

  if (serializationCache.has(cacheKey)) {
    return serializationCache.get(cacheKey)!;
  }

  const serialized = JSON.stringify(items);
  serializationCache.set(cacheKey, serialized);

  // Limiter la taille du cache
  if (serializationCache.size > 10) {
    const firstKey = serializationCache.keys().next().value;
    if (typeof firstKey === 'string') {
      serializationCache.delete(firstKey);
    }
  }

  return serialized;
};

// Définition des couleurs pour les catégories
const CATEGORY_COLORS: { [key: string]: string } = {
  // Resto
  'Plats Principaux': '#FF9800',
  'Plats Maxi': '#F44336',
  Salades: '#4CAF50',
  Accompagnements: '#CDDC39',
  Desserts: '#E91E63',
  'Menu Enfant': '#8BC34A',
  // Boissons
  Softs: '#03A9F4',
  'Boissons Chaudes': '#795548',
  Bières: '#FFC107',
  Vins: '#9C27B0',
  Alcools: '#673AB7',
  Glaces: '#00BCD4',
};

// Fonction de catégorisation mémoïzée
const getCategoryFromName = (
  name: string,
  type: 'resto' | 'boisson'
): string => {
  const lowerName = name.toLowerCase();

  if (type === 'resto') {
    if (lowerName.includes('salade')) return 'Salades';
    if (lowerName.includes('dessert')) return 'Desserts';
    if (lowerName.includes('frites')) return 'Accompagnements';
    if (lowerName.includes('menu enfant')) return 'Menu Enfant';
    if (lowerName.includes('maxi')) return 'Plats Maxi';
    return 'Plats Principaux';
  } else {
    if (lowerName.includes('glace')) return 'Glaces';
    if (lowerName.includes('thé') || lowerName.includes('café'))
      return 'Boissons Chaudes';
    if (
      lowerName.includes('bière') ||
      lowerName.includes('blonde') ||
      lowerName.includes('ambree')
    )
      return 'Bières';
    if (
      lowerName.includes('vin') ||
      lowerName.includes('pichet') ||
      lowerName.includes('btl')
    )
      return 'Vins';
    if (
      lowerName.includes('apero') ||
      lowerName.includes('digestif') ||
      lowerName.includes('ricard') ||
      lowerName.includes('alcool') ||
      lowerName.includes('punch') ||
      lowerName.includes('cocktail')
    )
      return 'Alcools';
    return 'Softs';
  }
};

// === HOOKS OPTIMISÉS ===

// Hook pour mémoïsation stable des données du menu
const useStableMenuItems = (customMenuItems: CustomMenuItem[]) => {
  const menuItemsRef = useRef<MenuItem[]>([]);
  const customItemsHashRef = useRef<string>('');

  return useMemo(() => {
    // Créer un hash simple pour détecter les changements
    const customItemsHash = JSON.stringify(
      customMenuItems.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
      }))
    );

    // Si rien n'a changé, retourner la référence existante
    if (
      customItemsHash === customItemsHashRef.current &&
      menuItemsRef.current.length > 0
    ) {
      return menuItemsRef.current;
    }

    // Recalculer seulement si nécessaire
    const standardItems = priceData.map((item) => {
      const category = getCategoryFromName(
        item.name,
        item.type as 'resto' | 'boisson'
      );
      return {
        id: item.id,
        name: item.name,
        price: item.price,
        category,
        type: item.type as 'resto' | 'boisson',
        color: CATEGORY_COLORS[category] || '#757575',
      };
    });

    const customItems = customMenuItems.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      type: item.type,
      color:
        CATEGORY_COLORS[item.category as keyof typeof CATEGORY_COLORS] ||
        '#757575',
    }));

    const newMenuItems = [...standardItems, ...customItems];

    // Mettre à jour les références
    menuItemsRef.current = newMenuItems;
    customItemsHashRef.current = customItemsHash;

    return newMenuItems;
  }, [customMenuItems]);
};

// Hook pour les catégories avec mémoïsation stable
const useStableCategories = (menuItems: MenuItem[]) => {
  const categoriesRef = useRef<string[]>([]);
  const menuItemsLengthRef = useRef(0);

  return useMemo(() => {
    // 🔥 OPTIMISATION: Ne recalculer que si le nombre d'items change
    if (
      menuItemsLengthRef.current === menuItems.length &&
      categoriesRef.current.length > 0
    ) {
      return categoriesRef.current;
    }

    const newCategories = [
      ...new Set(menuItems.map((item) => item.category)),
    ].sort();

    categoriesRef.current = newCategories;
    menuItemsLengthRef.current = menuItems.length;

    return newCategories;
  }, [menuItems.length]); // 🔥 Dépendance simplifiée
};

// Hook pour les items filtrés avec debouncing
const useFilteredMenuItems = (
  menuItems: MenuItem[],
  activeType: 'resto' | 'boisson' | null,
  activeCategory: string | null,
  unavailableItems: number[]
) => {
  // 🔥 AJOUT: Mémoriser les filtres pour éviter les recalculs
  const filtersRef = useRef({
    activeType: null as 'resto' | 'boisson' | null,
    activeCategory: null as string | null,
    unavailableHash: '',
  });
  const resultRef = useRef<MenuItem[]>([]);

  return useMemo(() => {
    const unavailableHash = unavailableItems.join(',');

    // 🔥 OPTIMISATION: Vérifier si les filtres ont vraiment changé
    if (
      filtersRef.current.activeType === activeType &&
      filtersRef.current.activeCategory === activeCategory &&
      filtersRef.current.unavailableHash === unavailableHash &&
      resultRef.current.length > 0
    ) {
      return resultRef.current; // Retourner le cache
    }

    // 🔥 OPTIMISATION: Créer un Set une seule fois pour unavailable
    const unavailableSet =
      unavailableItems.length > 0 ? new Set(unavailableItems) : null;

    // Filtrage optimisé
    const filtered = menuItems.filter((item) => {
      if (unavailableSet?.has(item.id)) return false;
      if (activeType && item.type !== activeType) return false;
      if (activeCategory && item.category !== activeCategory) return false;
      return true;
    });

    // Mettre à jour les caches
    filtersRef.current = { activeType, activeCategory, unavailableHash };
    resultRef.current = filtered;

    return filtered;
  }, [menuItems.length, activeType, activeCategory, unavailableItems.length]); // 🔥 Dépendances optimisées
};

// Callback stable pour addItemToOrder
const useStableAddItemCallback = (
  table: Table | null,
  guestCount: number,
  updateTableInContext: (table: Table) => Promise<void>,
  setTable: (table: Table | ((prev: Table | null) => Table | null)) => void
) => {
  // 🔥 OPTIMISATION: Éviter les re-créations de callback
  return useCallback(
    async (item: MenuItem) => {
      if (!table) return;

      setTable((prevTable) => {
        if (!prevTable) return prevTable;

        const updatedTable = { ...prevTable };

        if (!updatedTable.order) {
          updatedTable.order = {
            id: Date.now() + Math.random(),
            items: [],
            guests: guestCount,
            status: 'active',
            timestamp: new Date().toISOString(),
            total: 0,
          };
        }

        // 🔥 OPTIMISATION: Cloner seulement les items nécessaires
        const items = [...updatedTable.order.items];
        const existingItemIndex = items.findIndex(
          (orderItem) =>
            orderItem.name === item.name && orderItem.price === item.price
        );

        if (existingItemIndex >= 0) {
          items[existingItemIndex] = {
            ...items[existingItemIndex],
            quantity: items[existingItemIndex].quantity + 1,
          };
        } else {
          items.push({
            id: Date.now() + Math.random(),
            name: item.name,
            price: item.price,
            quantity: 1,
          });
        }

        // Recalcul optimisé du total
        const total = items.reduce((sum, orderItem) => {
          return orderItem.offered
            ? sum
            : sum + orderItem.price * orderItem.quantity;
        }, 0);

        updatedTable.order = {
          ...updatedTable.order,
          items,
          total,
        };

        // 🔥 OPTIMISATION: Mise à jour async pour éviter les blocages
        Promise.resolve().then(() => updateTableInContext(updatedTable));

        return updatedTable;
      });
    },
    [table?.id, guestCount]
  );
};

// Composant MenuItem mémoïzé avec optimisations
const MenuItemComponent = memo(
  ({ item, onPress }: { item: MenuItem; onPress: () => void }) => (
    <Pressable
      key={`menu-item-${item.id}-${item.category}`}
      style={[styles.menuItem, { borderLeftColor: item.color }]}
      onPress={onPress}
    >
      <Text style={styles.menuItemName}>{item.name}</Text>
      <Text style={styles.menuItemPrice}>{item.price.toFixed(2)} €</Text>
    </Pressable>
  ),
  (prevProps, nextProps) => prevProps.item.id === nextProps.item.id
);

export default function TableScreen() {
  const { id } = useLocalSearchParams();
  const tableId = parseInt(id as string, 10);
  const router = useRouter();
  const toast = useToast();
  const { getTableById, updateTableInContext, refreshSingleTable } =
    useTableContext();

  // ✅ TOUS LES HOOKS DOIVENT ÊTRE DÉCLARÉS EN PREMIER - SANS EXCEPTION
  const [unavailableItems, setUnavailableItems] = useState<number[]>([]);
  const [guestCount, setGuestCount] = useState(() => {
    const contextTable = getTableById(tableId);
    return contextTable?.guests || contextTable?.order?.guests || 1;
  });
  const [table, setTable] = useState<Table | null>(
    getTableById(tableId) || null
  );
  const [loading, setLoading] = useState(!table);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'resto' | 'boisson' | null>(
    'resto'
  );
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [customMenuItems, setCustomMenuItems] = useState<CustomMenuItem[]>([]);
  const [splitModalVisible, setSplitModalVisible] = useState(false);

  // Refs pour le debouncing et le batching
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ TOUS LES HOOKS PERSONNALISÉS AUSSI
  const menuItems = useStableMenuItems(customMenuItems);
  const categories = useStableCategories(menuItems);
  const filteredMenuItems = useFilteredMenuItems(
    menuItems,
    activeType,
    activeCategory,
    unavailableItems
  );
  const addItemToOrder = useStableAddItemCallback(
    table,
    guestCount,
    updateTableInContext,
    setTable
  );
  const handleBackPress = useCallback(() => {
    router.push('/');
    return true;
  }, [router]);

  const categorizeOrderItems = useCallback(
    (items: OrderItem[]) => {
      const result = { plats: [] as OrderItem[], boissons: [] as OrderItem[] };
      const menuItemMap = new Map(
        menuItems.map((item) => [`${item.name}-${item.price}`, item.type])
      );
      items.forEach((item) => {
        const type = menuItemMap.get(`${item.name}-${item.price}`) || 'resto';
        result[type === 'boisson' ? 'boissons' : 'plats'].push(item);
      });
      return result;
    },
    [menuItems]
  );

  // ✅ TOUS LES useEffect ET useCallback
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress
    );
    return () => backHandler.remove();
  }, [handleBackPress]);

  const categoriesByType = useMemo(() => {
    return {
      resto: categories.filter((cat) =>
        menuItems.some((item) => item.category === cat && item.type === 'resto')
      ),
      boisson: categories.filter((cat) =>
        menuItems.some(
          (item) => item.category === cat && item.type === 'boisson'
        )
      ),
    };
  }, [categories, menuItems]);

  useEffect(() => {
    if (!table) {
      setLoading(true);
      getTable(tableId).then((freshTable) => {
        if (freshTable) {
          setTable(freshTable);
          setGuestCount(freshTable.guests || 1);
        }
        setLoading(false);
      });
    }
  }, [tableId, table]);

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      events.emit(EVENT_TYPES.TABLE_UPDATED, tableId);
    };
  }, [tableId]);

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

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      await refreshSingleTable(tableId);
      const freshTable = await getTable(tableId);
      if (freshTable) {
        setTable(freshTable);
        setGuestCount(freshTable.guests || 1);
      }
    } catch (error) {
      console.error('Error loading table:', error);
    } finally {
      setLoading(false);
    }
  }, [tableId, refreshSingleTable]);

  useEffect(() => {
    const unsubscribe = events.on(
      EVENT_TYPES.TABLE_UPDATED,
      (updatedTableId: number) => {
        if (updatedTableId === tableId) {
          loadTable();
        }
      }
    );

    const unsubscribePayment = events.on(
      EVENT_TYPES.PAYMENT_ADDED,
      (updatedTableId: number) => {
        if (updatedTableId === tableId) {
          loadTable();
        }
      }
    );

    return () => {
      unsubscribe();
      unsubscribePayment();
    };
  }, [tableId, loadTable]);

  useFocusEffect(
    useCallback(() => {
      console.log(`Table ${tableId} en focus - rafraîchissement sélectif`);
      const timeoutId = setTimeout(() => {
        const tableInContext = getTableById(tableId);
        if (!tableInContext || !table || tableInContext.id !== table.id) {
          refreshSingleTable(tableId);
        }
      }, 100);
      return () => {
        clearTimeout(timeoutId);
      };
    }, [tableId, refreshSingleTable, getTableById, table])
  );

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        if (updateTimeoutRef.current !== null) {
          clearTimeout(updateTimeoutRef.current);
          updateTimeoutRef.current = null;
        }
      }
    };
  }, []);

  const handleClearOrder = useCallback(() => {
    if (!table || !table.order || table.order.items.length === 0) return;
    Alert.alert(
      'Supprimer la commande',
      'Êtes-vous sûr de vouloir supprimer tous les articles de la commande en cours ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setSaveInProgress(true);
            try {
              const updatedTable = {
                ...table,
                order: {
                  id: table.order!.id,
                  items: [],
                  total: 0,
                  guests: table.order!.guests,
                  status: 'active' as 'active',
                  timestamp: table.order!.timestamp,
                },
              };
              setTable(updatedTable);
              await updateTable(updatedTable);
              toast.showToast('Commande supprimée avec succès', 'success');
            } catch (error) {
              console.error(
                'Erreur lors de la suppression de la commande:',
                error
              );
              toast.showToast(
                'Impossible de supprimer la commande. Veuillez réessayer.',
                'error'
              );
            } finally {
              setSaveInProgress(false);
            }
          },
        },
      ]
    );
  }, [table, toast]);

  const offeredTotal = useMemo(() => {
    if (!table || !table.order) return 0;
    return table.order.items.reduce((sum, item) => {
      if (item.offered) {
        return sum + item.price * item.quantity;
      }
      return sum;
    }, 0);
  }, [table]);

  const toggleItemOffered = useCallback(
    (itemId: number) => {
      if (!table || !table.order) return;
      setTable((prevTable) => {
        if (!prevTable || !prevTable.order) return prevTable;
        const updatedItems = prevTable.order.items.map((item) => {
          if (item.id !== itemId) return item;
          return { ...item, offered: !item.offered };
        });
        const newTotal = updatedItems.reduce((sum, item) => {
          if (!item.offered) {
            return sum + item.price * item.quantity;
          }
          return sum;
        }, 0);
        const updatedTable = {
          ...prevTable,
          order: {
            ...prevTable.order,
            items: updatedItems,
            total: newTotal,
          },
        };
        updateTable(updatedTable).catch((error) => {
          toast.showToast('Erreur lors de la mise à jour', 'error');
          console.error('Error updating table:', error);
        });
        return updatedTable;
      });
    },
    [table, toast]
  );

  const calculateTotal = useCallback((items: OrderItem[]): number => {
    return items.reduce((sum, item) => {
      if (!item.offered) {
        return sum + item.price * item.quantity;
      }
      return sum;
    }, 0);
  }, []);

  const updateItemQuantity = useCallback(
    (itemId: number, increment: boolean) => {
      if (!table || !table.order) return;
      setTable((prevTable) => {
        if (!prevTable || !prevTable.order) return prevTable;
        const updatedItems = prevTable.order.items
          .map((item) => {
            if (item.id !== itemId) return item;
            const newQuantity = increment
              ? item.quantity + 1
              : Math.max(0, item.quantity - 1);
            return { ...item, quantity: newQuantity };
          })
          .filter((item) => item.quantity > 0);
        const newTotal = updatedItems.reduce((sum, item) => {
          if (!item.offered) {
            return sum + item.price * item.quantity;
          }
          return sum;
        }, 0);
        const updatedTable = {
          ...prevTable,
          order: {
            ...prevTable.order,
            items: updatedItems,
            total: newTotal,
          },
        };
        if (updateTimeoutRef.current !== null) {
          clearTimeout(updateTimeoutRef.current);
        }
        updateTimeoutRef.current = setTimeout(() => {
          updateTable(updatedTable).catch((error) => {
            toast.showToast('Erreur lors de la mise à jour', 'error');
            console.error('Error updating table:', error);
          });
        }, 150);
        return updatedTable;
      });
    },
    [table?.id, toast]
  );

  const handleCloseTable = useCallback(async () => {
    if (!table) return;

    Alert.alert(
      'Fermer la table',
      `Êtes-vous sûr de vouloir fermer la table "${table.name}" ? Toutes les commandes non payées seront perdues.`,
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Fermer',
          style: 'destructive',
          onPress: async () => {
            setSaveInProgress(true);
            try {
              // 1. D'abord naviguer
              router.push('/');

              // 2. Ensuite réinitialiser la table en arrière-plan
              setTimeout(async () => {
                try {
                  await resetTable(tableId);
                  toast.showToast(
                    `Table ${table.name} fermée avec succès`,
                    'success'
                  );
                } catch (error) {
                  console.error(
                    'Erreur lors de la fermeture de la table:',
                    error
                  );
                  toast.showToast('Impossible de fermer la table', 'error');
                }
              }, 100);
            } catch (error) {
              console.error('Erreur lors de la navigation:', error);
              toast.showToast('Erreur lors de la fermeture', 'error');
            } finally {
              // Réinitialiser le flag après un délai pour éviter les conflits
              setTimeout(() => {
                setSaveInProgress(false);
              }, 200);
            }
          },
        },
      ]
    );
  }, [table, tableId, router, toast]);

  // Plus de hooks et callbacks...
  const renderMenuGrid = useCallback(() => {
    const groupedByCategory = useMemo(() => {
      const groups = new Map<string, MenuItem[]>();
      filteredMenuItems.forEach((item) => {
        if (!groups.has(item.category)) {
          groups.set(item.category, []);
        }
        groups.get(item.category)!.push(item);
      });
      return groups;
    }, [filteredMenuItems]);

    const sections = useMemo(() => {
      const result: Array<{ category: string; items: MenuItem[] }> = [];
      categories
        .filter((cat) =>
          activeType
            ? menuItems.some(
                (item) => item.category === cat && item.type === activeType
              )
            : true
        )
        .forEach((category) => {
          const items = groupedByCategory.get(category);
          if (items && items.length > 0) {
            result.push({ category, items });
          }
        });
      return result;
    }, [groupedByCategory, categories, activeType, menuItems.length]);

    return (
      <ScrollView
        style={styles.menuItemsScroll}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section, index) => (
          <View key={section.category} style={styles.categorySection}>
            <Text style={styles.categoryHeaderText}>{section.category}</Text>
            <View style={styles.categoryItems}>
              {section.items.map((item) => (
                <MenuItemComponent
                  key={`menu-${item.id}`}
                  item={item}
                  onPress={() => addItemToOrder(item)}
                />
              ))}
            </View>
            {index < sections.length - 1 && (
              <View style={styles.categorySeparator} />
            )}
          </View>
        ))}
      </ScrollView>
    );
  }, [
    filteredMenuItems,
    categories,
    activeType,
    menuItems.length,
    addItemToOrder,
  ]);

  const truncateName = useCallback((name: string, maxLength: number = 18) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + '...';
  }, []);

  const renderUltraCompactItem = useCallback(
    (item: OrderItem) => (
      <View
        key={`order-${item.id}`}
        style={[styles.ultraCompactItem, item.offered && styles.offeredItem]}
      >
        <View style={styles.firstLineCompact}>
          <View style={styles.itemNameContainer}>
            {item.offered && <Gift size={14} color="#FF9800" />}
            <Text
              style={[
                styles.itemNameUltraCompact,
                item.offered && styles.offeredItemText,
              ]}
              numberOfLines={1}
            >
              {truncateName(item.name)} {item.offered ? '(Offert)' : ''}
            </Text>
          </View>
          <View style={styles.quantityControlCompact}>
            <Pressable
              style={styles.quantityButton}
              onPress={() => updateItemQuantity(item.id, false)}
            >
              <Minus size={16} color="#666" />
            </Pressable>
            <Text style={styles.quantityUltraCompact}>{item.quantity}</Text>
            <Pressable
              style={styles.quantityButton}
              onPress={() => updateItemQuantity(item.id, true)}
            >
              <Plus size={16} color="#666" />
            </Pressable>
          </View>
        </View>
        <View style={styles.secondLineCompact}>
          <Text
            style={[
              styles.priceUltraCompact,
              item.offered && styles.offeredItemPrice,
            ]}
          >
            {(item.price * item.quantity).toFixed(2)} €
          </Text>
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
    ),
    [updateItemQuantity, toggleItemOffered, truncateName]
  );

  useEffect(() => {
    const loadUnavailableItems = async () => {
      const menuAvailability = await getMenuAvailability();
      const unavailable = menuAvailability
        .filter((item) => !item.available)
        .map((item) => item.id);
      setUnavailableItems(unavailable);
    };
    loadUnavailableItems();
  }, []);

  const getVisibleCategories = useCallback(() => {
    if (!activeType) return categories;
    return categoriesByType[activeType];
  }, [activeType, categories, categoriesByType]);

  const handlePreviewNote = useCallback(() => {
    if (!table || !table.order || table.order.items.length === 0) {
      toast.showToast("Il n'y a pas d'articles à afficher", 'warning');
      return;
    }
    const serializedItems = getCachedSerialization(table.order.items);
    router.push({
      pathname: '/print-preview',
      params: {
        tableId: tableId.toString(),
        total: table.order.total.toString(),
        items: serializedItems,
        isPreview: 'true',
        tableName: table.name,
      },
    });
  }, [
    table?.order?.total,
    table?.order?.items?.length,
    table?.name,
    tableId,
    router,
    toast,
  ]);

  const handlePayment = useCallback(
    (type: 'full' | 'split' | 'custom' | 'items') => {
      if (!table || !table.order) return;
      const total = table.order.total;
      if (total <= 0) {
        toast.showToast("Il n'y a pas d'articles à payer", 'warning');
        return;
      }
      const serializedItems = getCachedSerialization(table.order.items);
      if (type === 'full') {
        router.push({
          pathname: '/payment/full',
          params: {
            tableId: tableId.toString(),
            total: total.toString(),
            items: serializedItems,
          },
        });
      } else if (type === 'split') {
        if (guestCount <= 1) {
          toast.showToast(
            "Il faut au moins 2 convives pour partager l'addition",
            'warning'
          );
          return;
        }
        setSplitModalVisible(true);
      } else if (type === 'custom') {
        router.push({
          pathname: '/payment/custom',
          params: {
            tableId: tableId.toString(),
            total: total.toString(),
            items: serializedItems,
          },
        });
      } else if (type === 'items') {
        router.push({
          pathname: '/payment/items',
          params: {
            tableId: tableId.toString(),
          },
        });
      }
    },
    [
      table?.order?.total,
      table?.order?.items?.length,
      guestCount,
      tableId,
      router,
      toast,
    ]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement des données...</Text>
      </View>
    );
  }

  if (!table) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Table not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
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
        <Pressable
          onPress={handleBackPress}
          style={({ pressed }) => [
            styles.backLink,
            {
              backgroundColor: pressed
                ? '#8a8888'
                : styles.backLink.backgroundColor,
            },
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
          <Pressable
            onPress={async () => {
              const newCount = Math.max(1, guestCount - 1);
              setGuestCount(newCount);

              if (table) {
                const updatedTable = {
                  ...table,
                  guests: newCount,
                  order: table.order
                    ? { ...table.order, guests: newCount }
                    : undefined,
                };

                setTable(updatedTable);

                try {
                  await updateTable(updatedTable);
                } catch (error) {
                  console.error(
                    'Erreur lors de la mise à jour du nombre de couverts:',
                    error
                  );
                }
              }
            }}
          >
            <Minus size={24} color="#666" />
          </Pressable>
          <Text style={styles.guestCount}>{guestCount}</Text>
          <Pressable
            onPress={async () => {
              const newCount = guestCount + 1;
              setGuestCount(newCount);

              if (table) {
                const updatedTable = {
                  ...table,
                  guests: newCount,
                  order: table.order
                    ? { ...table.order, guests: newCount }
                    : undefined,
                };

                setTable(updatedTable);

                try {
                  await updateTable(updatedTable);
                } catch (error) {
                  console.error(
                    'Erreur lors de la mise à jour du nombre de couverts:',
                    error
                  );
                }
              }
            }}
          >
            <Plus size={24} color="#666" />
          </Pressable>
        </View>
        <Pressable
          style={[styles.paymentButton, { backgroundColor: '#9C27B0' }]}
          onPress={handlePreviewNote}
        >
          <Receipt size={24} color="white" />
          <Text style={styles.paymentButtonText}>Prévisualiser Note</Text>
        </Pressable>

        <Pressable
          style={[
            styles.paymentButton,
            {
              backgroundColor:
                (table?.order?.items?.length ?? 0) > 0 ? '#FF6600' : '#BDBDBD',
              marginLeft: 8,
            },
          ]}
          onPress={handleClearOrder}
          disabled={!table?.order?.items?.length}
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
          <Text style={styles.paymentButtonText}>Fermer table</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.orderSection}>
          <Text style={styles.sectionTitle}>Commande actuelle</Text>
          {orderItems.length === 0 ? (
            <Text style={styles.emptyOrder}>
              Aucun article dans la commande. Ajoutez-en depuis le menu.
            </Text>
          ) : (
            <View style={styles.orderColumns}>
              {(() => {
                const { plats, boissons } = categorizeOrderItems(orderItems);
                return (
                  <>
                    <View style={styles.orderColumn}>
                      <Text style={styles.columnTitle}>Plats</Text>
                      <ScrollView style={styles.orderColumnScroll}>
                        {plats.map(renderUltraCompactItem)}
                      </ScrollView>
                    </View>
                    <View style={styles.orderColumn}>
                      <Text style={styles.columnTitle}>Boissons</Text>
                      <ScrollView style={styles.orderColumnScroll}>
                        {boissons.map(renderUltraCompactItem)}
                      </ScrollView>
                    </View>
                  </>
                );
              })()}
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
                <Text style={styles.paymentButtonText}>
                  Paiement par article
                </Text>
              </Pressable>
            </View>
            <View style={styles.paymentActionsRow}>
              <Pressable
                style={[styles.paymentButton, { backgroundColor: '#FF9800' }]}
                onPress={() => handlePayment('custom')}
              >
                <Receipt size={24} color="white" />
                <Text style={styles.paymentButtonText}>
                  Partage personnalisé
                </Text>
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

        <View style={styles.menuSection}>
          <View style={styles.menuHeader}>
            <Text style={styles.sectionTitle}>Menu</Text>
            <View style={styles.typeFilters}>
              <Pressable
                style={[
                  styles.typeFilterButton,
                  activeType === 'resto' && styles.activeTypeButton,
                ]}
                onPress={() => setActiveType('resto')}
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
                onPress={() => setActiveType('boisson')}
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
                onPress={() => setActiveType(null)}
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
                activeCategory === null && { borderBottomColor: '#2196F3' },
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
            {getVisibleCategories().map((category) => (
              <Pressable
                key={category}
                style={[
                  styles.categoryTab,
                  activeCategory === category && styles.activeCategoryTab,
                  activeCategory === category && {
                    borderBottomColor: CATEGORY_COLORS[category] || '#2196F3',
                  },
                ]}
                onPress={() => setActiveCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    activeCategory === category && styles.activeCategoryTabText,
                    activeCategory === category && {
                      color: CATEGORY_COLORS[category] || '#2196F3',
                    },
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.menuItems}>{renderMenuGrid()}</View>
        </View>
      </View>

      <SplitSelectionModal
        visible={splitModalVisible}
        onClose={() => setSplitModalVisible(false)}
        onConfirm={(partsCount) => {
          if (!table || !table.order) return;

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
  headerTitleContainer: {
    flex: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 8,
  },
  sectionBadge: {
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 16,
  },
  sectionText: {
    color: '#0288D1',
    fontWeight: '600',
    fontSize: 11,
  },
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
  typeFilters: {
    flexDirection: 'row',
    gap: 6,
  },
  typeFilterButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  activeTypeButton: {
    backgroundColor: '#2196F3',
  },
  typeFilterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  activeTypeText: {
    color: 'white',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  orderList: {
    maxHeight: '55%',
  },
  emptyOrder: {
    flex: 1,
    textAlign: 'center',
    color: '#666',
    paddingTop: 40,
  },
  orderColumns: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
    minHeight: 0,
  },
  orderColumn: {
    flex: 1,
    minHeight: 0,
  },
  columnTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  ultraCompactItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 2,
  },
  firstLineCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemNameUltraCompact: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    marginRight: 6,
  },
  quantityControlCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f5f5f5',
    padding: 4,
    borderRadius: 6,
  },
  priceUltraCompact: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
    textAlign: 'right',
    marginTop: 1,
  },
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
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    alignItems: 'center',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  paymentActions: {
    flexDirection: 'column',
    gap: 1,
    marginTop: 4,
    flex: 0.4,
    flexShrink: 0,
  },
  paymentButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    paddingLeft: 6,
  },
  categoryTabs: {
    marginBottom: 8,
    flexGrow: 0,
  },
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
  activeCategoryTab: {
    borderBottomWidth: 2,
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  activeCategoryTabText: {
    fontWeight: '600',
  },
  menuItems: {
    flex: 1,
  },
  menuItemsScroll: {
    flex: 1,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
    paddingLeft: 8,
    color: '#333',
  },
  categoryItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categorySeparator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginTop: 16,
    marginBottom: 8,
  },
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
  menuItemName: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  menuItemPrice: {
    fontSize: 11,
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
    gap: 30,
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
  orderColumnScroll: {
    maxHeight: '93%',
    marginTop: 8,
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
  quantityUltraCompact: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 20,
    textAlign: 'center',
  },
  flatListContainer: {
    padding: 8,
  },
  columnWrapper: {
    gap: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#333',
  },
  offeredItem: {
    backgroundColor: '#FFF8E1',
    borderLeftWidth: 2,
    borderLeftColor: '#FF9800',
  },
  offeredItemText: {
    fontStyle: 'italic',
    color: '#FF9800',
  },
  offeredItemPrice: {
    textDecorationLine: 'line-through',
    color: '#FF9800',
  },
  offerButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#FF9800',
    borderRadius: 4,
  },
  offerButtonText: {
    fontSize: 10,
    color: '#FF9800',
  },
  itemNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 6,
  },
  secondLineCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  offeredTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
});
