// app/(tabs)/menu.tsx

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import {
  CirclePlus as PlusCircle,
  CircleMinus as MinusCircle,
  CreditCard as Edit,
  X,
  Save,
  Plus,
  Trash2,
} from 'lucide-react-native';
import priceData from '../../helpers/ManjosPrice';
import {
  getMenuAvailability,
  saveMenuAvailability,
  MenuItemAvailability,
  getCustomMenuItems,
  addCustomMenuItem,
  updateCustomMenuItem,
  deleteCustomMenuItem,
  CustomMenuItem,
  saveCustomMenuItems,
} from '../../utils/storage';
import { useToast } from '@/utils/ToastContext';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  available: boolean;
  type: 'resto' | 'boisson';
  color: string;
}

interface EditModalProps {
  visible: boolean;
  item?: MenuItem | null;
  onClose: () => void;
  onSave: (item: MenuItem) => void;
}

// ✅ Constantes en dehors du composant (évite les re-créations)
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

// ✅ Cache global pour éviter les recharges (comme dans TableScreen)
let menuDataCache: MenuItem[] = [];
let menuCacheLoaded = false;
let unavailableItemsCache: number[] = [];
let customItemsCache: CustomMenuItem[] = [];

// ✅ Fonction de catégorisation simple (pas de useCallback)
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
      lowerName.includes('ambree') ||
      lowerName.includes('pinte')
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
      lowerName.includes('cocktail') ||
      lowerName.includes('baby')
    )
      return 'Alcools';
    return 'Softs';
  }
};

// ✅ Fonction pour charger les données UNE SEULE FOIS
const loadMenuDataOnce = async () => {
  if (menuCacheLoaded) return;

  try {
    const [customItems, menuAvailability] = await Promise.all([
      getCustomMenuItems(),
      getMenuAvailability(),
    ]);

    // Items standards
    const standardItems = priceData.map((item) => {
      const category = getCategoryFromName(
        item.name,
        item.type as 'resto' | 'boisson'
      );
      const savedStatus = menuAvailability.find(
        (status) => status.id === item.id
      );

      return {
        id: item.id,
        name: savedStatus?.name || item.name,
        price: savedStatus?.price || item.price,
        category,
        available: savedStatus ? savedStatus.available : true,
        type: item.type as 'resto' | 'boisson',
        color: CATEGORY_COLORS[category] || '#757575',
      };
    });

    // Items personnalisés
    const customMenuItems = customItems.map((item) => {
      const savedStatus = menuAvailability.find(
        (status) => status.id === item.id
      );

      return {
        id: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        available: savedStatus ? savedStatus.available : item.available,
        type: item.type,
        color:
          CATEGORY_COLORS[item.category as keyof typeof CATEGORY_COLORS] ||
          '#757575',
      };
    });

    menuDataCache = [...standardItems, ...customMenuItems];
    customItemsCache = customItems;
    unavailableItemsCache = menuAvailability
      .filter((item) => !item.available)
      .map((item) => item.id);

    menuCacheLoaded = true;
    console.log(`📦 Menu data loaded in cache: ${menuDataCache.length} items`);
  } catch (error) {
    console.error('Error loading menu data:', error);
  }
};

// ✅ Hook de debounce simple
const useDebounce = (value: any, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// ✅ Composant MenuItem ultra-optimisé avec React.memo et comparaison stricte
const MenuItemCard = memo(
  ({
    item,
    isCustom,
    onToggleAvailability,
    onEdit,
    onDelete,
  }: {
    item: MenuItem;
    isCustom: boolean;
    onToggleAvailability: () => void;
    onEdit: () => void;
    onDelete: () => void;
  }) => {
    // État local pour éviter les clics multiples
    const [isToggling, setIsToggling] = useState(false);

    const handleToggleAvailability = useCallback(() => {
      if (isToggling) return;
      setIsToggling(true);
      onToggleAvailability();
      // Reset après un délai court
      setTimeout(() => setIsToggling(false), 500);
    }, [isToggling, onToggleAvailability]);

    return (
      <View style={[styles.menuItem, { borderLeftColor: item.color }]}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.itemPrice}>{item.price.toFixed(2)} €</Text>
        </View>
        <View style={styles.itemActions}>
          <Pressable
            style={[
              styles.actionButton,
              { backgroundColor: item.available ? '#f44336' : '#4CAF50' },
            ]}
            onPress={handleToggleAvailability}
            disabled={isToggling}
          >
            {item.available ? (
              <MinusCircle size={16} color="#fff" />
            ) : (
              <PlusCircle size={16} color="#fff" />
            )}
            <Text style={styles.actionButtonText}>
              {item.available ? 'Indisponible' : 'Disponible'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
            onPress={onEdit}
          >
            <Edit size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Modifier</Text>
          </Pressable>

          {isCustom && (
            <Pressable
              style={[styles.actionButton, { backgroundColor: '#F44336' }]}
              onPress={onDelete}
            >
              <Trash2 size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Supprimer</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  },
  // ✅ Comparaison personnalisée ultra-stricte pour éviter les re-renders
  (prevProps, nextProps) => {
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.available === nextProps.item.available &&
      prevProps.item.name === nextProps.item.name &&
      prevProps.item.price === nextProps.item.price &&
      prevProps.isCustom === nextProps.isCustom
    );
  }
);

// ✅ Modal d'édition optimisée
const EditItemModal: React.FC<EditModalProps> = memo(
  ({ visible, item, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [available, setAvailable] = useState(true);

    // Debounce pour éviter les updates excessifs
    const debouncedName = useDebounce(name, 300);
    const debouncedPrice = useDebounce(price, 300);

    useEffect(() => {
      if (item) {
        setName(item.name);
        setPrice(item.price.toString());
        setAvailable(item.available);
      }
    }, [item]);

    const handleSave = useCallback(() => {
      if (!item) return;

      const updatedItem = {
        ...item,
        name: debouncedName,
        price: parseFloat(debouncedPrice) || item.price,
        available,
      };

      onSave(updatedItem);
      onClose();
    }, [item, debouncedName, debouncedPrice, available, onSave, onClose]);

    if (!item) return null;

    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier l'article</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <X size={24} color="#666" />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nom:</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Nom de l'article"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Prix (€):</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Disponibilité:</Text>
              <View style={styles.availabilitySwitch}>
                <Pressable
                  style={[
                    styles.availabilityOption,
                    available && styles.availabilitySelected,
                  ]}
                  onPress={() => setAvailable(true)}
                >
                  <Text
                    style={[
                      styles.availabilityText,
                      available && styles.availabilityTextSelected,
                    ]}
                  >
                    Disponible
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.availabilityOption,
                    !available && styles.availabilitySelected,
                  ]}
                  onPress={() => setAvailable(false)}
                >
                  <Text
                    style={[
                      styles.availabilityText,
                      !available && styles.availabilityTextSelected,
                    ]}
                  >
                    Indisponible
                  </Text>
                </Pressable>
              </View>
            </View>

            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Save size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }
);

// ✅ États séparés pour éviter les re-renders inutiles
interface MenuState {
  activeType: 'resto' | 'boisson' | null;
  selectedCategory: string | null;
}

export default function MenuScreen() {
  // ✅ États MINIMAUX et séparés
  const [menuState, setMenuState] = useState<MenuState>({
    activeType: null,
    selectedCategory: null,
  });
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

  // ✅ Refs pour éviter les fuites
  const mountedRef = useRef(true);
  const updateTimeoutRef = useRef<number | NodeJS.Timeout | null>(null);

  const toast = useToast();

  // ✅ Nettoyage automatique
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // ✅ Chargement initial depuis le cache
  useEffect(() => {
    const initializeData = async () => {
      await loadMenuDataOnce();
      if (mountedRef.current) {
        setMenuItems(menuDataCache);
      }
    };

    initializeData();
  }, []);

  // ✅ Catégories mémoïsées SIMPLEMENT
  const categories = useMemo(() => {
    const allCategories = [...new Set(menuItems.map((item) => item.category))];

    if (menuState.activeType) {
      return allCategories.filter((category) =>
        menuItems.some(
          (item) =>
            item.category === category && item.type === menuState.activeType
        )
      );
    }

    return allCategories.sort();
  }, [menuItems, menuState.activeType]);

  // ✅ Items filtrés SIMPLEMENT
  const filteredItems = useMemo(() => {
    let filtered = menuItems;

    if (menuState.activeType) {
      filtered = filtered.filter((item) => item.type === menuState.activeType);
    }

    if (menuState.selectedCategory) {
      filtered = filtered.filter(
        (item) => item.category === menuState.selectedCategory
      );
    }

    return filtered;
  }, [menuItems, menuState.activeType, menuState.selectedCategory]);

  // ✅ Handler de toggle optimisé avec debounce
  const toggleItemAvailability = useCallback(
    async (itemId: number) => {
      try {
        const itemToToggle = menuItems.find((item) => item.id === itemId);
        if (!itemToToggle) return;

        const newAvailability = !itemToToggle.available;

        // Mise à jour optimiste immédiate
        setMenuItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, available: newAvailability } : item
          )
        );

        // Debounce pour éviter trop de sauvegardes
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }

        updateTimeoutRef.current = setTimeout(async () => {
          if (!mountedRef.current) return;

          try {
            // Mettre à jour le cache global
            const itemIndex = menuDataCache.findIndex(
              (item) => item.id === itemId
            );
            if (itemIndex >= 0) {
              menuDataCache[itemIndex].available = newAvailability;
            }

            // Sauvegarder dans le storage
            const isCustomItem = customItemsCache.some(
              (item) => item.id === itemId
            );
            if (isCustomItem) {
              const updatedCustomItems = customItemsCache.map((item) =>
                item.id === itemId
                  ? { ...item, available: newAvailability }
                  : item
              );
              await saveCustomMenuItems(updatedCustomItems);
              customItemsCache = updatedCustomItems;
            }

            const availability = await getMenuAvailability();
            const updatedAvailability = availability.some(
              (item) => item.id === itemId
            )
              ? availability.map((item) =>
                  item.id === itemId
                    ? { ...item, available: newAvailability }
                    : item
                )
              : [
                  ...availability,
                  {
                    id: itemId,
                    available: newAvailability,
                    name: itemToToggle.name,
                    price: itemToToggle.price,
                  },
                ];

            await saveMenuAvailability(updatedAvailability);
          } catch (error) {
            console.error('Erreur lors de la mise à jour:', error);
            toast.showToast(
              'Impossible de mettre à jour la disponibilité.',
              'error'
            );

            // Revenir à l'état précédent en cas d'erreur
            if (mountedRef.current) {
              setMenuItems((prev) =>
                prev.map((item) =>
                  item.id === itemId
                    ? { ...item, available: !newAvailability }
                    : item
                )
              );
            }
          }
        }, 500);
      } catch (error) {
        console.error('Erreur lors du toggle:', error);
        toast.showToast(
          'Impossible de mettre à jour la disponibilité.',
          'error'
        );
      }
    },
    [menuItems, toast]
  );

  // ✅ Autres handlers optimisés
  const handleEdit = useCallback((item: MenuItem) => {
    setEditItem(item);
    setEditModalVisible(true);
  }, []);

  const handleSaveEdit = useCallback(
    async (updatedItem: MenuItem) => {
      try {
        // Mise à jour optimiste
        setMenuItems((prev) =>
          prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
        );

        // Mettre à jour le cache global
        const itemIndex = menuDataCache.findIndex(
          (item) => item.id === updatedItem.id
        );
        if (itemIndex >= 0) {
          menuDataCache[itemIndex] = updatedItem;
        }

        const isCustomItem = customItemsCache.some(
          (item) => item.id === updatedItem.id
        );

        if (isCustomItem) {
          const customMenuItem: CustomMenuItem = {
            id: updatedItem.id,
            name: updatedItem.name,
            price: updatedItem.price,
            category: updatedItem.category,
            type: updatedItem.type,
            available: updatedItem.available,
          };

          await updateCustomMenuItem(customMenuItem);

          // Mettre à jour le cache des items personnalisés
          customItemsCache = customItemsCache.map((item) =>
            item.id === updatedItem.id ? customMenuItem : item
          );
        }

        const availability = await getMenuAvailability();
        const updatedAvailability = availability.some(
          (item) => item.id === updatedItem.id
        )
          ? availability.map((item) =>
              item.id === updatedItem.id
                ? {
                    id: updatedItem.id,
                    available: updatedItem.available,
                    name: updatedItem.name,
                    price: updatedItem.price,
                  }
                : item
            )
          : [
              ...availability,
              {
                id: updatedItem.id,
                available: updatedItem.available,
                name: updatedItem.name,
                price: updatedItem.price,
              },
            ];

        await saveMenuAvailability(updatedAvailability);
      } catch (error) {
        console.error('Error updating menu item:', error);
        toast.showToast("Impossible de mettre à jour l'article.", 'error');
      }
    },
    [toast]
  );

  const handleDeleteMenuItem = useCallback(
    (itemId: number) => {
      const isCustomItem = customItemsCache.some((item) => item.id === itemId);

      if (!isCustomItem) {
        toast.showToast(
          'Seuls les articles personnalisés peuvent être supprimés.',
          'info'
        );
        return;
      }

      Alert.alert(
        "Supprimer l'article",
        'Êtes-vous sûr de vouloir supprimer cet article du menu ? Cette action est irréversible.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteCustomMenuItem(itemId);

                // Mettre à jour tous les caches
                setMenuItems((prev) =>
                  prev.filter((item) => item.id !== itemId)
                );
                menuDataCache = menuDataCache.filter(
                  (item) => item.id !== itemId
                );
                customItemsCache = customItemsCache.filter(
                  (item) => item.id !== itemId
                );

                const availability = await getMenuAvailability();
                const updatedAvailability = availability.filter(
                  (item) => item.id !== itemId
                );
                await saveMenuAvailability(updatedAvailability);

                toast.showToast(
                  "L'article a été supprimé avec succès.",
                  'success'
                );
              } catch (error) {
                console.error('Erreur lors de la suppression:', error);
                toast.showToast("Impossible de supprimer l'article.", 'error');
              }
            },
          },
        ]
      );
    },
    [toast]
  );

  const handleCategorySelect = useCallback((category: string) => {
    setMenuState((prev) => ({
      ...prev,
      selectedCategory: prev.selectedCategory === category ? null : category,
    }));
  }, []);

  const setActiveType = useCallback((type: 'resto' | 'boisson' | null) => {
    setMenuState((prev) => ({
      ...prev,
      activeType: type,
    }));
  }, []);

  const handleSaveNewItem = useCallback(
    async (newItem: MenuItem) => {
      try {
        const customMenuItem: CustomMenuItem = {
          id: newItem.id,
          name: newItem.name,
          price: newItem.price,
          category: newItem.category,
          type: newItem.type,
          available: newItem.available,
        };

        await addCustomMenuItem(customMenuItem);

        // Mettre à jour tous les caches
        setMenuItems((prev) => [...prev, newItem]);
        menuDataCache.push(newItem);
        customItemsCache.push(customMenuItem);

        const itemStatus: MenuItemAvailability = {
          id: newItem.id,
          available: newItem.available,
          name: newItem.name,
          price: newItem.price,
        };

        const currentAvailability = await getMenuAvailability();
        await saveMenuAvailability([...currentAvailability, itemStatus]);
      } catch (error) {
        console.error('Error saving new menu item:', error);
        toast.showToast(
          'Impossible de sauvegarder le nouvel article.',
          'error'
        );
      }
    },
    [toast]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestion du Menu</Text>
        <View style={styles.typeFilters}>
          <Pressable
            style={[
              styles.typeFilterButton,
              menuState.activeType === 'resto' && styles.activeTypeButton,
            ]}
            onPress={() =>
              setActiveType(menuState.activeType === 'resto' ? null : 'resto')
            }
          >
            <Text
              style={[
                styles.typeFilterText,
                menuState.activeType === 'resto' && styles.activeTypeText,
              ]}
            >
              Plats
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.typeFilterButton,
              menuState.activeType === 'boisson' && styles.activeTypeButton,
            ]}
            onPress={() =>
              setActiveType(
                menuState.activeType === 'boisson' ? null : 'boisson'
              )
            }
          >
            <Text
              style={[
                styles.typeFilterText,
                menuState.activeType === 'boisson' && styles.activeTypeText,
              ]}
            >
              Boissons
            </Text>
          </Pressable>
        </View>
        <Pressable
          style={styles.addButton}
          onPress={() => setAddModalVisible(true)}
        >
          <PlusCircle size={24} color="#fff" />
          <Text style={styles.addButtonText}>Ajouter un item</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.categoriesSidebar}>
          <ScrollView>
            <Pressable
              style={[
                styles.categoryItem,
                !menuState.selectedCategory && styles.activeCategoryItem,
              ]}
              onPress={() =>
                setMenuState((prev) => ({ ...prev, selectedCategory: null }))
              }
            >
              <Text
                style={[
                  styles.categoryItemText,
                  !menuState.selectedCategory && styles.activeCategoryItemText,
                ]}
              >
                Toutes les catégories
              </Text>
            </Pressable>

            {categories.map((category) => (
              <Pressable
                key={category}
                style={[
                  styles.categoryItem,
                  menuState.selectedCategory === category &&
                    styles.activeCategoryItem,
                  { borderLeftColor: CATEGORY_COLORS[category] || '#757575' },
                ]}
                onPress={() => handleCategorySelect(category)}
              >
                <Text
                  style={[
                    styles.categoryItemText,
                    menuState.selectedCategory === category &&
                      styles.activeCategoryItemText,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.menuItemsContainer}>
          <ScrollView>
            <View style={styles.menuItemsGrid}>
              {filteredItems.map((item) => {
                const isCustomItem = customItemsCache.some(
                  (customItem) => customItem.id === item.id
                );

                return (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    isCustom={isCustomItem}
                    onToggleAvailability={() => toggleItemAvailability(item.id)}
                    onEdit={() => handleEdit(item)}
                    onDelete={() => handleDeleteMenuItem(item.id)}
                  />
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>

      <EditItemModal
        visible={editModalVisible}
        item={editItem}
        onClose={() => setEditModalVisible(false)}
        onSave={handleSaveEdit}
      />

      {/* AddItemModal va ici - simplifié de la même manière */}
    </View>
  );
}

// Styles conservés identiques pour préserver l'apparence
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  typeFilters: {
    flexDirection: 'row',
    gap: 10,
  },
  typeFilterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
  },
  activeTypeButton: {
    backgroundColor: '#2196F3',
  },
  typeFilterText: {
    fontWeight: '500',
    color: '#666',
  },
  activeTypeText: {
    color: 'white',
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
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  categoriesSidebar: {
    width: 200,
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    padding: 12,
  },
  categoryItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderLeftWidth: 4,
    borderLeftColor: '#ccc',
  },
  activeCategoryItem: {
    backgroundColor: '#e3f2fd',
    borderLeftColor: '#2196F3',
  },
  categoryItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeCategoryItemText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  menuItemsContainer: {
    flex: 1,
    padding: 16,
  },
  menuItemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  menuItem: {
    width: '32%',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 4,
  },
  itemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    marginRight: 4,
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderRadius: 4,
    gap: 4,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    width: '50%',
    padding: 20,
    borderRadius: 8,
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 10,
    fontSize: 16,
  },
  availabilitySwitch: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    overflow: 'hidden',
  },
  availabilityOption: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
  },
  availabilitySelected: {
    backgroundColor: '#2196F3',
  },
  availabilityText: {
    fontWeight: '500',
  },
  availabilityTextSelected: {
    color: 'white',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
