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
import { useTableContext } from '../../utils/TableContext';
import {
  ActivityIndicator,
  Alert,
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
  addBill,
  getCustomMenuItems,
  getMenuAvailability,
  getTable,
  resetTable,
  updateTable,
} from '../../utils/storage';
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
  const { getTableById, updateTableInContext } = useTableContext();

  const [unavailableItems, setUnavailableItems] = useState<number[]>([]);
  const [guestCount, setGuestCount] = useState(1);
  const [table, setTable] = useState<Table | null>(
    getTableById(tableId) || null
  );
  const [loading, setLoading] = useState(!table);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'resto' | 'boisson' | null>(
    'resto'
  );
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [customMenuItems, setCustomMenuItems] = useState<CustomMenuItem[]>([]);
  const [splitModalVisible, setSplitModalVisible] = useState(false);

  // Refs pour le debouncing et le batching
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchedUpdates = useRef<Table | null>(null);

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

  // Nettoyage des listeners et timeouts
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

  // Convertir les données de ManjosPrice en items de menu avec couleurs (mémoïzé)
  const menuItems: MenuItem[] = useMemo(() => {
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

    return [...standardItems, ...customItems];
  }, [customMenuItems]);

  // Mémoïser les catégories
  const categories = useMemo(() => {
    return [...new Set(menuItems.map((item) => item.category))].sort();
  }, [menuItems]);

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

  // Mémoïser les items filtrés (et exclure les items non disponibles)
  const filteredMenuItems = useMemo(() => {
    let items = menuItems;

    // Filtrer par type
    if (activeType) {
      items = items.filter((item) => item.type === activeType);
    }

    // Filtrer par catégorie
    if (activeCategory) {
      items = items.filter((item) => item.category === activeCategory);
    }

    // Exclure les items non disponibles
    items = items.filter((item) => !unavailableItems.includes(item.id));

    return items;
  }, [menuItems, activeType, activeCategory, unavailableItems]);

  useEffect(() => {
    loadTable();
  }, [tableId]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      // Forcer le rechargement complet depuis le stockage
      const freshTable = await getTable(tableId);
      if (freshTable) {
        // Mettre à jour l'état avec les données fraîches
        setTable(freshTable);
        setGuestCount(freshTable.guests || 1);

        // Si la table a un ordre, assurez-vous qu'il est à jour
        if (freshTable.order) {
          batchedUpdates.current = null; // Réinitialiser les mises à jour en attente
        }
      }
    } catch (error) {
      console.error('Error loading table:', error);
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    // Écouter les événements de mise à jour de la table
    const unsubscribe = events.on(
      EVENT_TYPES.TABLE_UPDATED,
      (updatedTableId: number) => {
        if (updatedTableId === tableId) {
          loadTable();
        }
      }
    );

    // Écouter les événements de paiement ajouté
    const unsubscribePayment = events.on(
      EVENT_TYPES.PAYMENT_ADDED,
      (updatedTableId: number) => {
        if (updatedTableId === tableId) {
          loadTable();
        }
      }
    );

    return () => {
      // Se désabonner des événements lors du nettoyage
      unsubscribe();
      unsubscribePayment();
    };
  }, [tableId, loadTable]);

  useFocusEffect(
    useCallback(() => {
      console.log('Plan du restaurant en focus - rafraîchissement des données');
      setTable(null); // Réinitialiser d'abord l'état local
      loadTable(); // Puis charger les données fraîches

      return () => {
        // Annuler tout timeout en cours lors du déplacement
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
          updateTimeoutRef.current = null;
        }
      };
    }, [loadTable])
  );

  useEffect(() => {
    // S'abonner à l'événement TABLE_UPDATED
    const unsubscribe = events.on(
      EVENT_TYPES.TABLE_UPDATED,
      (updatedTableId: number) => {
        if (updatedTableId === tableId) {
          // Force un rechargement complet des données de la table
          console.log(`Table ${tableId} was updated, reloading data...`);
          setTable(null); // Réinitialiser d'abord
          loadTable(); // Puis recharger
        }
      }
    );

    return () => {
      // Se désabonner de l'événement lors du nettoyage
      unsubscribe();
    };
  }, [tableId, loadTable]);

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
      batchedUpdates.current = null;
    };
  }, []);

  // Fonction pour séparer les items en plats et boissons :
  const categorizeOrderItems = useCallback(
    (items: OrderItem[]) => {
      const result = { plats: [] as OrderItem[], boissons: [] as OrderItem[] };

      // Créer un Map pour la recherche rapide
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

  const handleClearOrder = () => {
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
              setSaveSuccess(true);
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
  };
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

          // Inverser l'état "offered"
          return { ...item, offered: !item.offered };
        });

        // Recalculer le total en excluant les articles offerts
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

        // Mise à jour asynchrone de la base de données
        updateTable(updatedTable).catch((error) => {
          toast.showToast('Erreur lors de la mise à jour', 'error');
          console.error('Error updating table:', error);
        });

        return updatedTable;
      });
    },
    [table, toast]
  );

  // Calculer le total de la commande
  const calculateTotal = (items: OrderItem[]): number => {
    return items.reduce((sum, item) => {
      // N'ajoute le prix au total que si l'article n'est pas marqué comme offert
      if (!item.offered) {
        return sum + item.price * item.quantity;
      }
      return sum;
    }, 0);
  };

  // Handler pour ajouter un item à la commande (useCallback)
  const addItemToOrder = useCallback(
    async (item: MenuItem) => {
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

      const existingItem = updatedTable.order.items.find(
        (orderItem) =>
          orderItem.name === item.name && orderItem.price === item.price
      );

      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        updatedTable.order.items.push({
          id: Date.now(),
          name: item.name,
          price: item.price,
          quantity: 1,
        });
      }

      updatedTable.order.total = calculateTotal(updatedTable.order.items);

      // Utiliser les deux:
      setTable(updatedTable); // Mise à jour instantanée de l'UI
      await updateTableInContext(updatedTable); // Mise à jour dans le context et le stockage
    },
    [table, guestCount, calculateTotal, updateTableInContext]
  );

  // Mise à jour de la quantité avec batching
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

        const newTotal = calculateTotal(updatedItems);

        const updatedTable = {
          ...prevTable,
          order: {
            ...prevTable.order,
            items: updatedItems,
            total: newTotal,
          },
        };

        // Mise à jour asynchrone de la base de données
        updateTable(updatedTable).catch((error) => {
          toast.showToast('Erreur lors de la mise à jour', 'error');
          console.error('Error updating table:', error);
        });

        return updatedTable;
      });
    },
    [table, calculateTotal, toast]
  );

  // Reste des handlers (existants)...
  const handleCloseTable = async () => {
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
              // Si la table a une commande active avec des articles, offrir de sauvegarder en tant qu'addition
              if (
                table.order?.items &&
                table.order.items.length > 0 &&
                table.order.total > 0
              ) {
                await resetTable(tableId);
                router.push('/');
                toast.showToast(
                  `Table ${table.name} fermée avec succès`,
                  'success'
                );
              } else {
                // Si pas de commande active, réinitialiser simplement
                await resetTable(tableId);
                router.push('/');
                toast.showToast(
                  `Table ${table.name} fermée avec succès`,
                  'success'
                );
              }
            } catch (error) {
              console.error('Erreur lors de la fermeture de la table:', error);
              toast.showToast('Impossible de fermer la table', 'error');
            } finally {
              setSaveInProgress(false);
            }
          },
        },
      ]
    );
  };

  // Rendu du menu grid avec FlatList et restructuration
  const renderMenuGrid = () => {
    const groupedByCategory = new Map<string, MenuItem[]>();

    // Grouper les articles par catégorie
    filteredMenuItems.forEach((item) => {
      if (!groupedByCategory.has(item.category)) {
        groupedByCategory.set(item.category, []);
      }
      groupedByCategory.get(item.category)!.push(item);
    });

    const sections: Array<{ category: string; items: MenuItem[] }> = [];

    // Convertir en tableau ordonné
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
          sections.push({ category, items });
        }
      });

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
            {/* Ligne de séparation entre catégories */}
            {index < sections.length - 1 && (
              <View style={styles.categorySeparator} />
            )}
          </View>
        ))}
      </ScrollView>
    );
  };

  // Fonction pour tronquer le nom si trop long
  const truncateName = (name: string, maxLength: number = 18) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + '...';
  };

  // Rendu ultra-compact d'un item de commande
  const renderUltraCompactItem = (item: OrderItem) => (
    <View
      key={`order-${item.id}`}
      style={[
        styles.ultraCompactItem,
        item.offered && styles.offeredItem, // Ajouter un style spécial pour les articles offerts
      ]}
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
  );

  // Reste des useEffects et autres fonctions...
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

  const getVisibleCategories = () => {
    if (!activeType) return categories;
    return categoriesByType[activeType];
  };

  const handlePreviewNote = useCallback(() => {
    if (!table || !table.order || table.order.items.length === 0) {
      toast.showToast("Il n'y a pas d'articles à afficher", 'warning');
      return;
    }

    // Naviguer vers la prévisualisation de la note
    router.push({
      pathname: '/print-preview',
      params: {
        tableId: tableId.toString(),
        total: table.order.total.toString(),
        items: JSON.stringify(table.order.items),
        isPreview: 'true', // Marque comme prévisualisation (non payée)
        tableName: table.name,
      },
    });
  }, [table, tableId, router]);

  const handlePayment = (type: 'full' | 'split' | 'custom' | 'items') => {
    if (!table || !table.order) return;

    const total = table.order.total;

    if (total <= 0) {
      toast.showToast("Il n'y a pas d'articles à payer", 'warning');
      return;
    }

    if (type === 'full') {
      router.push({
        pathname: '/payment/full',
        params: {
          tableId: tableId.toString(),
          total: total.toString(),
          items: JSON.stringify(table.order.items),
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
          items: JSON.stringify(table.order.items),
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
  };

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
          <Pressable onPress={() => setGuestCount(Math.max(1, guestCount - 1))}>
            <Minus size={24} color="#666" />
          </Pressable>
          <Text style={styles.guestCount}>{guestCount}</Text>
          <Pressable onPress={() => setGuestCount(guestCount + 1)}>
            <Plus size={24} color="#666" />
          </Pressable>
        </View>
        <Pressable
          style={[styles.paymentButton, { backgroundColor: '#9C27B0' }]}
          onPress={() => handlePreviewNote()}
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
              marginRight: 8,
            },
          ]}
          onPress={handleClearOrder}
          disabled={!table?.order?.items?.length}
        >
          <ShoppingCart size={20} color="white" />
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
  // Nouveaux styles pour la restructuration du menu
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
    backgroundColor: '#F9F9F9', // facultatif, pour adoucir le fond
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#333',
  },
  offeredItem: {
    backgroundColor: '#FFF8E1', // Fond légèrement jaune pour les articles offerts
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
