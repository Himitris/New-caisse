// app/table/[id].tsx - Version COMPLÈTE optimisée anti-fuite mémoire

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
import { memo, useCallback, useEffect, useMemo, useState, useRef } from 'react';
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

// Hook de nettoyage mémoire - À ajouter dans utils/useMemoryCleanup.ts
const useMemoryCleanup = () => {
  const cleanupFuncs = useRef<(() => void)[]>([]);
  const isMountedRef = useRef(true);

  const addCleanup = useCallback((cleanupFunc: () => void) => {
    cleanupFuncs.current.push(cleanupFunc);
  }, []);

  const isStillMounted = useCallback(() => isMountedRef.current, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanupFuncs.current.forEach((cleanup) => {
        try {
          cleanup();
        } catch (error) {
          console.warn('Cleanup error:', error);
        }
      });
      cleanupFuncs.current = [];
    };
  }, []);

  return { addCleanup, isStillMounted };
};

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  type: 'resto' | 'boisson';
  color: string;
}

// Couleurs des catégories
const CATEGORY_COLORS: { [key: string]: string } = {
  'Plats Principaux': '#FF9800',
  'Plats Maxi': '#F44336',
  Salades: '#4CAF50',
  Accompagnements: '#CDDC39',
  Desserts: '#E91E63',
  'Menu Enfant': '#8BC34A',
  Softs: '#03A9F4',
  'Boissons Chaudes': '#795548',
  Bières: '#FFC107',
  Vins: '#9C27B0',
  Alcools: '#673AB7',
  Glaces: '#00BCD4',
};

// Fonction de catégorisation simplifiée
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

// Composant MenuItem mémoïzé
const MenuItemComponent = memo(
  ({ item, onPress }: { item: MenuItem; onPress: () => void }) => (
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

  // 🆕 Hook de nettoyage mémoire
  const { addCleanup, isStillMounted } = useMemoryCleanup();

  // États locaux MINIMISÉS - éviter l'accumulation
  const [table, setTable] = useState<Table | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestCount, setGuestCount] = useState(1);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [unavailableItems, setUnavailableItems] = useState<number[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'resto' | 'boisson' | null>(
    'resto'
  );
  const [splitModalVisible, setSplitModalVisible] = useState(false);

  // Refs pour éviter les re-créations et fuites
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUpdatingRef = useRef(false);
  const lastTableIdRef = useRef<number | null>(null);

  // Charger les données du menu UNE SEULE FOIS - pas de recharge
  const loadMenuData = async () => {
    try {
      const [customItems, menuAvailability] = await Promise.all([
        getCustomMenuItems(),
        getMenuAvailability(),
      ]);

      // Créer les items du menu standard
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

      // Ajouter les items personnalisés
      const customMenuItems = customItems.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        type: item.type,
        color: CATEGORY_COLORS[item.category] || '#757575',
      }));

      const allMenuItems = [...standardItems, ...customMenuItems];

      // Définir les items indisponibles
      const unavailable = menuAvailability
        .filter((item) => !item.available)
        .map((item) => item.id);

      if (isStillMounted()) {
        setMenuItems(allMenuItems);
        setUnavailableItems(unavailable);
      }
    } catch (error) {
      console.error('Error loading menu data:', error);
    }
  };

  // Charger SEULEMENT la table - optimisé avec cache du contexte
  const loadTable = async () => {
    if (!isStillMounted()) return;

    try {
      // D'abord essayer depuis le contexte (plus rapide)
      let tableData = getTableById(tableId);

      // Si pas trouvé dans le contexte, charger depuis storage
      if (!tableData) {
        const loadedTable = await getTable(tableId);
        tableData = loadedTable === null ? undefined : loadedTable;
      }

      if (tableData && isStillMounted()) {
        setTable(tableData);
        setGuestCount(tableData.guests || 1);
      }
    } catch (error) {
      console.error('Error loading table:', error);
    } finally {
      if (isStillMounted()) {
        setLoading(false);
      }
    }
  };

  // Charger les données au démarrage - OPTIMISÉ
  useEffect(() => {
    // Éviter de recharger si c'est la même table
    if (lastTableIdRef.current === tableId) {
      setLoading(false);
      return;
    }

    lastTableIdRef.current = tableId;

    const initializeData = async () => {
      setLoading(true);

      // Charger en parallèle seulement si nécessaire
      const promises = [loadTable()];

      // Charger le menu seulement si pas encore chargé
      if (menuItems.length === 0) {
        promises.push(loadMenuData());
      }

      await Promise.all(promises);

      if (isStillMounted()) {
        setLoading(false);
      }
    };

    initializeData();
  }, [tableId]); // SEULEMENT tableId en dépendance

  // Rafraîchir SEULEMENT la table quand on revient
  useFocusEffect(
    useCallback(() => {
      // Seulement si on revient sur la même table et qu'on n'est pas en train de charger
      if (lastTableIdRef.current === tableId && !loading) {
        loadTable();
      }
    }, [tableId, loading])
  );

  // Nettoyage des timeouts
  useEffect(() => {
    addCleanup(() => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
      isUpdatingRef.current = false;
    });
  }, [addCleanup]);

  // Gérer le bouton retour - OPTIMISÉ
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        // Nettoyer l'état si nécessaire
        lastTableIdRef.current = null;
        router.push('/');
        return true;
      }
    );

    return () => {
      backHandler.remove();
    };
  }, [router]);

  // Fonction de calcul de total SIMPLE - pas de useCallback
  const calculateTotal = (items: OrderItem[]): number => {
    return items.reduce((sum, item) => {
      if (!item.offered) {
        return sum + item.price * item.quantity;
      }
      return sum;
    }, 0);
  };

  // Ajouter un article à la commande - OPTIMISÉ sans useCallback complexe
  const addItemToOrder = async (item: MenuItem) => {
    if (!table || !isStillMounted() || isUpdatingRef.current) return;

    isUpdatingRef.current = true;

    try {
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

      const existingItemIndex = updatedTable.order.items.findIndex(
        (orderItem) =>
          orderItem.name === item.name && orderItem.price === item.price
      );

      if (existingItemIndex >= 0) {
        updatedTable.order.items[existingItemIndex].quantity += 1;
      } else {
        updatedTable.order.items.push({
          id: Date.now() + Math.random(),
          name: item.name,
          price: item.price,
          quantity: 1,
        });
      }

      updatedTable.order.total = calculateTotal(updatedTable.order.items);

      // Mise à jour optimiste IMMÉDIATE
      setTable(updatedTable);

      // Debounce pour éviter trop d'updates
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(async () => {
        if (isStillMounted()) {
          try {
            await updateTableData(tableId, updatedTable);
          } catch (error) {
            console.error('Error saving table:', error);
            // Recharger en cas d'erreur
            await loadTable();
            toast.showToast("Erreur lors de l'ajout de l'article", 'error');
          }
        }
        isUpdatingRef.current = false;
      }, 500); // Attendre 500ms avant de sauvegarder
    } catch (error) {
      console.error('Error adding item to order:', error);
      isUpdatingRef.current = false;
      toast.showToast("Erreur lors de l'ajout de l'article", 'error');
    }
  };

  // Mettre à jour la quantité d'un article - OPTIMISÉ
  const updateItemQuantity = async (itemId: number, increment: boolean) => {
    if (!table || !table.order || !isStillMounted() || isUpdatingRef.current)
      return;

    isUpdatingRef.current = true;

    try {
      const updatedTable = { ...table };
      if (!updatedTable.order) return;

      const updatedItems = updatedTable.order.items
        .map((item) => {
          if (item.id !== itemId) return item;
          const newQuantity = increment
            ? item.quantity + 1
            : Math.max(0, item.quantity - 1);
          return { ...item, quantity: newQuantity };
        })
        .filter((item) => item.quantity > 0);

      updatedTable.order.items = updatedItems;
      updatedTable.order.total = calculateTotal(updatedItems);

      // Mise à jour optimiste
      setTable(updatedTable);

      // Debounce update
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(async () => {
        if (isStillMounted()) {
          try {
            await updateTableData(tableId, updatedTable);
          } catch (error) {
            console.error('Error updating item quantity:', error);
            await loadTable();
            toast.showToast('Erreur lors de la mise à jour', 'error');
          }
        }
        isUpdatingRef.current = false;
      }, 500);
    } catch (error) {
      console.error('Error updating item quantity:', error);
      isUpdatingRef.current = false;
      toast.showToast('Erreur lors de la mise à jour', 'error');
    }
  };

  // Basculer l'état offert d'un article - OPTIMISÉ
  const toggleItemOffered = async (itemId: number) => {
    if (!table || !table.order || !isStillMounted() || isUpdatingRef.current)
      return;

    isUpdatingRef.current = true;

    try {
      const updatedTable = { ...table };
      if (!updatedTable.order) return;

      const updatedItems = updatedTable.order.items.map((item) => {
        if (item.id !== itemId) return item;
        return { ...item, offered: !item.offered };
      });

      updatedTable.order.items = updatedItems;
      updatedTable.order.total = calculateTotal(updatedItems);

      // Mise à jour optimiste
      setTable(updatedTable);

      // Debounce update
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(async () => {
        if (isStillMounted()) {
          try {
            await updateTableData(tableId, updatedTable);
          } catch (error) {
            console.error('Error toggling item offered:', error);
            await loadTable();
            toast.showToast('Erreur lors de la mise à jour', 'error');
          }
        }
        isUpdatingRef.current = false;
      }, 500);
    } catch (error) {
      console.error('Error toggling item offered:', error);
      isUpdatingRef.current = false;
      toast.showToast('Erreur lors de la mise à jour', 'error');
    }
  };

  // Vider la commande - SIMPLIFIÉ
  const handleClearOrder = () => {
    if (!table || !table.order || table.order.items.length === 0) return;

    Alert.alert(
      'Supprimer la commande',
      'Êtes-vous sûr de vouloir supprimer tous les articles de la commande en cours ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (!table.order) return;

            const updatedTable = {
              ...table,
              order: { ...table.order, items: [], total: 0 },
            };

            try {
              setTable(updatedTable);
              await updateTableData(tableId, updatedTable);
              toast.showToast('Commande supprimée avec succès', 'success');
            } catch (error) {
              console.error('Error clearing order:', error);
              await loadTable();
              toast.showToast('Impossible de supprimer la commande', 'error');
            }
          },
        },
      ]
    );
  };

  // Fermer la table - OPTIMISÉ
  const handleCloseTable = () => {
    if (!table) return;

    Alert.alert(
      'Fermer la table',
      `Êtes-vous sûr de vouloir fermer la table "${table.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Fermer',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetTable(tableId);

              // Nettoyer l'état local
              setTable(null);
              setGuestCount(1);
              lastTableIdRef.current = null;

              // Rafraîchir le contexte et naviguer
              refreshTables();
              router.push('/');
              toast.showToast(
                `Table ${table.name} fermée avec succès`,
                'success'
              );
            } catch (error) {
              console.error('Error closing table:', error);
              toast.showToast('Erreur lors de la fermeture', 'error');
            }
          },
        },
      ]
    );
  };

  // Prévisualiser la note
  const handlePreviewNote = () => {
    if (!table || !table.order || table.order.items.length === 0) {
      toast.showToast("Il n'y a pas d'articles à afficher", 'warning');
      return;
    }

    router.push({
      pathname: '/print-preview',
      params: {
        tableId: tableId.toString(),
        total: table.order.total.toString(),
        items: JSON.stringify(table.order.items),
        isPreview: 'true',
        tableName: table.name,
      },
    });
  };

  // Gérer les paiements - SIMPLIFIÉ
  const handlePayment = (type: 'full' | 'split' | 'custom' | 'items') => {
    if (!table || !table.order) return;

    const total = table.order.total;
    if (total <= 0) {
      toast.showToast("Il n'y a pas d'articles à payer", 'warning');
      return;
    }

    const serializedItems = JSON.stringify(table.order.items);

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
        params: { tableId: tableId.toString() },
      });
    }
  };

  // Mettre à jour le nombre de couverts - OPTIMISÉ
  const updateGuestCount = async (newCount: number) => {
    if (!table) return;

    const validCount = Math.max(1, newCount);
    setGuestCount(validCount);

    const updatedTable = {
      ...table,
      guests: validCount,
      order: table.order ? { ...table.order, guests: validCount } : undefined,
    };

    try {
      setTable(updatedTable);
      await updateTableData(tableId, updatedTable);
    } catch (error) {
      console.error('Error updating guest count:', error);
    }
  };

  // Filtrer les items du menu - SANS useMemo complexe
  const filteredMenuItems = menuItems.filter((item) => {
    if (unavailableItems.includes(item.id)) return false;
    if (activeType && item.type !== activeType) return false;
    if (activeCategory && item.category !== activeCategory) return false;
    return true;
  });

  // Catégories visibles selon le type actif - SANS useMemo complexe
  const categories = (() => {
    const allCategories = [...new Set(menuItems.map((item) => item.category))];
    if (activeType) {
      return allCategories.filter((category) =>
        menuItems.some(
          (item) => item.category === category && item.type === activeType
        )
      );
    }
    return allCategories.sort();
  })();

  // Catégoriser les articles de la commande - SANS useCallback complexe
  const categorizeOrderItems = (items: OrderItem[]) => {
    const result = { plats: [] as OrderItem[], boissons: [] as OrderItem[] };
    const menuItemMap = new Map(
      menuItems.map((item) => [`${item.name}-${item.price}`, item.type])
    );

    items.forEach((item) => {
      const type = menuItemMap.get(`${item.name}-${item.price}`) || 'resto';
      result[type === 'boisson' ? 'boissons' : 'plats'].push(item);
    });

    return result;
  };

  // Calculer le total des articles offerts - SANS useMemo complexe
  const offeredTotal = (() => {
    if (!table || !table.order) return 0;
    return table.order.items.reduce((sum, item) => {
      if (item.offered) {
        return sum + item.price * item.quantity;
      }
      return sum;
    }, 0);
  })();

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
          onPress={() => {
            lastTableIdRef.current = null;
            router.push('/');
          }}
          style={styles.backLink}
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
              backgroundColor: orderItems.length > 0 ? '#FF6600' : '#BDBDBD',
              marginLeft: 8,
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
          <Text style={styles.paymentButtonText}>Fermer table</Text>
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
              {(() => {
                const { plats, boissons } = categorizeOrderItems(orderItems);
                return (
                  <>
                    <View style={styles.orderColumn}>
                      <Text style={styles.columnTitle}>Plats</Text>
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
                                {item.offered && (
                                  <Gift size={14} color="#FF9800" />
                                )}
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
                                  onPress={() =>
                                    updateItemQuantity(item.id, false)
                                  }
                                >
                                  <Minus size={16} color="#666" />
                                </Pressable>
                                <Text style={styles.quantity}>
                                  {item.quantity}
                                </Text>
                                <Pressable
                                  style={styles.quantityButton}
                                  onPress={() =>
                                    updateItemQuantity(item.id, true)
                                  }
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
                                {item.offered && (
                                  <Gift size={14} color="#FF9800" />
                                )}
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
                                  onPress={() =>
                                    updateItemQuantity(item.id, false)
                                  }
                                >
                                  <Minus size={16} color="#666" />
                                </Pressable>
                                <Text style={styles.quantity}>
                                  {item.quantity}
                                </Text>
                                <Pressable
                                  style={styles.quantityButton}
                                  onPress={() =>
                                    updateItemQuantity(item.id, true)
                                  }
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

          <View style={styles.menuItems}>
            <ScrollView
              style={styles.menuItemsScroll}
              showsVerticalScrollIndicator={false}
            >
              {categories
                .filter((cat) =>
                  activeType
                    ? menuItems.some(
                        (item) =>
                          item.category === cat && item.type === activeType
                      )
                    : true
                )
                .map((category) => {
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

// Styles identiques à l'original - pas de changement nécessaire
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
});
