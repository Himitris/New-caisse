// app/(tabs)/menu.tsx - Version optimisée avec corrections
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
import { useState, useMemo, useEffect, useCallback, memo } from 'react';
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

// Debounce utilitaire
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

// Composant MenuItem optimisé avec React.memo
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
    // Debounce pour les actions rapides
    const [isToggling, setIsToggling] = useState(false);

    const handleToggleAvailability = useCallback(() => {
      if (isToggling) return;
      setIsToggling(true);
      onToggleAvailability();
      setTimeout(() => setIsToggling(false), 300);
    }, [isToggling, onToggleAvailability]);

    return (
      <View
        key={item.id}
        style={[styles.menuItem, { borderLeftColor: item.color }]}
      >
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
  (prevProps, nextProps) => {
    // Custom comparaison pour éviter les re-renders inutiles
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.available === nextProps.item.available &&
      prevProps.item.name === nextProps.item.name &&
      prevProps.item.price === nextProps.item.price &&
      prevProps.isCustom === nextProps.isCustom
    );
  }
);

// Composant pour éditer un article
const EditItemModal: React.FC<EditModalProps> = memo(
  ({ visible, item, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [available, setAvailable] = useState(true);

    // Debounce pour les inputs
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

const AddItemModal: React.FC<EditModalProps> = memo(
  ({ visible, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [available, setAvailable] = useState(true);
    const [type, setType] = useState<'resto' | 'boisson'>('resto');
    const [category, setCategory] = useState('Plats Principaux');

    // Debounce pour les inputs
    const debouncedName = useDebounce(name, 300);
    const debouncedPrice = useDebounce(price, 300);

    const handleSave = useCallback(() => {
      const newItem: MenuItem = {
        id: Date.now(),
        name: debouncedName,
        price: parseFloat(debouncedPrice) || 0,
        category,
        available,
        type,
        color: CATEGORY_COLORS[category] || '#757575',
      };

      onSave(newItem);
      onClose();
    }, [
      debouncedName,
      debouncedPrice,
      category,
      available,
      type,
      onSave,
      onClose,
    ]);

    const categories = useMemo(
      () =>
        type === 'resto'
          ? [
              'Plats Principaux',
              'Plats Maxi',
              'Salades',
              'Accompagnements',
              'Desserts',
              'Menu Enfant',
            ]
          : [
              'Softs',
              'Boissons Chaudes',
              'Bières',
              'Vins',
              'Alcools',
              'Glaces',
            ],
      [type]
    );

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
              <Text style={styles.modalTitle}>Ajouter un nouvel article</Text>
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
              <Text style={styles.label}>Type:</Text>
              <View style={styles.typeSwitch}>
                <Pressable
                  style={[
                    styles.typeOption,
                    type === 'resto' && styles.typeSelected,
                  ]}
                  onPress={() => {
                    setType('resto');
                    setCategory('Plats Principaux');
                  }}
                >
                  <Text
                    style={[
                      styles.typeText,
                      type === 'resto' && styles.typeTextSelected,
                    ]}
                  >
                    Plat
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.typeOption,
                    type === 'boisson' && styles.typeSelected,
                  ]}
                  onPress={() => {
                    setType('boisson');
                    setCategory('Softs');
                  }}
                >
                  <Text
                    style={[
                      styles.typeText,
                      type === 'boisson' && styles.typeTextSelected,
                    ]}
                  >
                    Boisson
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Catégorie:</Text>
              <View style={styles.categorySwitch}>
                {categories.map((cat) => (
                  <Pressable
                    key={cat}
                    style={[
                      styles.categoryOption,
                      category === cat && styles.categorySelected,
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        category === cat && styles.categoryTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </View>
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

// Séparation des états pour éviter les re-renders inutiles
interface MenuState {
  activeType: 'resto' | 'boisson' | null;
  selectedCategory: string | null;
}

interface DataState {
  menuItems: MenuItem[];
  customItems: CustomMenuItem[];
}

export default function MenuScreen() {
  // État pour l'UI - optimisé
  const [menuState, setMenuState] = useState<MenuState>({
    activeType: null,
    selectedCategory: null,
  });
  const toast = useToast();

  // État pour les données - immuable
  const [dataState, setDataState] = useState<DataState>({
    menuItems: [],
    customItems: [],
  });

  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

  // Mémoïsation des catégories
  const categories = useMemo(() => {
    const allCategories = [
      ...new Set(dataState.menuItems.map((item) => item.category)),
    ];

    if (menuState.activeType) {
      return allCategories.filter((category) =>
        dataState.menuItems.some(
          (item) =>
            item.category === category && item.type === menuState.activeType
        )
      );
    }

    return allCategories.sort();
  }, [dataState.menuItems, menuState.activeType]);

  // Mémoïsation des items filtrés - Chargement paresseux
  const filteredItems = useMemo(() => {
    let filtered = dataState.menuItems;

    if (menuState.activeType) {
      filtered = filtered.filter((item) => item.type === menuState.activeType);
    }

    if (menuState.selectedCategory) {
      filtered = filtered.filter(
        (item) => item.category === menuState.selectedCategory
      );
    }

    return filtered;
  }, [dataState.menuItems, menuState.activeType, menuState.selectedCategory]);

  // Initialiser les items de menu si pas de données sauvegardées - Optimisé
  const initializeMenuItems = useCallback(async () => {
    try {
      const customItems = await getCustomMenuItems();

      // Chargement lazy des items standards
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
          available: true,
          type: item.type as 'resto' | 'boisson',
          color: CATEGORY_COLORS[category] || '#757575',
        };
      });

      const customMenuItems = customItems.map((item) => {
        return {
          id: item.id,
          name: item.name,
          price: item.price,
          category: item.category,
          available: item.available,
          type: item.type,
          color:
            CATEGORY_COLORS[item.category as keyof typeof CATEGORY_COLORS] ||
            '#757575',
        };
      });

      const allItems = [...standardItems, ...customMenuItems];

      // Mise à jour en batch
      setDataState({
        menuItems: allItems,
        customItems,
      });
    } catch (error) {
      console.error('Error initializing menu items:', error);

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
          available: true,
          type: item.type as 'resto' | 'boisson',
          color: CATEGORY_COLORS[category] || '#757575',
        };
      });

      setDataState({
        menuItems: standardItems,
        customItems: [],
      });
    }
  }, []);

  // Chargement initial optimisé
  const loadMenuItemsStatus = useCallback(async () => {
    try {
      const [itemsStatus, customItems] = await Promise.all([
        getMenuAvailability(),
        getCustomMenuItems(),
      ]);

      const standardItems = priceData.map((item) => {
        const category = getCategoryFromName(
          item.name,
          item.type as 'resto' | 'boisson'
        );
        const savedStatus = itemsStatus.find((status) => status.id === item.id);

        return {
          id: item.id,
          name: savedStatus?.name || item.name,
          price: savedStatus?.price || item.price,
          category,
          available: savedStatus ? savedStatus.available : true,
          type: item.type as 'resto' | 'boisson',
          color:
            CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] ||
            '#757575',
        };
      });

      const customMenuItems = customItems.map((item) => {
        const savedStatus = itemsStatus.find((status) => status.id === item.id);

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

      const allItems = [...standardItems, ...customMenuItems];

      setDataState({
        menuItems: allItems,
        customItems,
      });
    } catch (error) {
      console.error('Error loading menu items status:', error);
      initializeMenuItems();
    }
  }, []);

  useEffect(() => {
    loadMenuItemsStatus();
  }, [loadMenuItemsStatus]);

  // Handler optimisé pour sauvegarder un nouvel item
  const handleSaveNewItem = useCallback(async (newItem: MenuItem) => {
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

      setDataState((prev) => ({
        menuItems: [...prev.menuItems, newItem],
        customItems: [...prev.customItems, customMenuItem],
      }));

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
      toast.showToast('Impossible de sauvegarder le nouvel article.', 'error');
    }
  }, []);

  // Handler optimisé pour toggle availability - Avec debounce
  const toggleItemAvailability = useCallback(
    async (itemId: number) => {
      try {
        const itemToToggle = dataState.menuItems.find(
          (item) => item.id === itemId
        );
        if (!itemToToggle) return;

        const newAvailability = !itemToToggle.available;

        // Mise à jour avec structure immuable - optimisée
        setDataState((prev) => ({
          ...prev,
          menuItems: prev.menuItems.map((item) =>
            item.id === itemId ? { ...item, available: newAvailability } : item
          ),
          customItems: prev.customItems.map((item) =>
            item.id === itemId ? { ...item, available: newAvailability } : item
          ),
        }));

        const isCustomItem = dataState.customItems.some(
          (item) => item.id === itemId
        );
        if (isCustomItem) {
          const updatedCustomItems = dataState.customItems.map((item) =>
            item.id === itemId ? { ...item, available: newAvailability } : item
          );
          await saveCustomMenuItems(updatedCustomItems);
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
        console.error(
          'Erreur lors de la mise à jour de la disponibilité:',
          error
        );
        toast.showToast(
          "Impossible de mettre à jour la disponibilité de l'article.",
          'error'
        );
      }
    },
    [dataState.menuItems, dataState.customItems]
  );

  // Handler optimisé pour édition
  const handleEdit = useCallback((item: MenuItem) => {
    setEditItem(item);
    setEditModalVisible(true);
  }, []);

  // Handler optimisé pour sauvegarder l'édition
  const handleSaveEdit = useCallback(
    async (updatedItem: MenuItem) => {
      try {
        const isCustomItem = dataState.customItems.some(
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

          setDataState((prev) => ({
            ...prev,
            menuItems: prev.menuItems.map((item) =>
              item.id === updatedItem.id ? updatedItem : item
            ),
            customItems: prev.customItems.map((item) =>
              item.id === updatedItem.id ? customMenuItem : item
            ),
          }));
        } else {
          setDataState((prev) => ({
            ...prev,
            menuItems: prev.menuItems.map((item) =>
              item.id === updatedItem.id ? updatedItem : item
            ),
          }));
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
    [dataState.customItems]
  );

  // Handler optimisé pour suppression
  const handleDeleteMenuItem = useCallback(
    (itemId: number) => {
      const isCustomItem = dataState.customItems.some(
        (item) => item.id === itemId
      );

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

                setDataState((prev) => ({
                  menuItems: prev.menuItems.filter(
                    (item) => item.id !== itemId
                  ),
                  customItems: prev.customItems.filter(
                    (item) => item.id !== itemId
                  ),
                }));

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
                console.error(
                  "Erreur lors de la suppression de l'article:",
                  error
                );
                toast.showToast(
                  "Impossible de supprimer l'article. Veuillez réessayer.",
                  'error'
                );
              }
            },
          },
        ]
      );
    },
    [dataState.customItems]
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

      <AddItemModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSave={handleSaveNewItem}
      />

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
                const isCustomItem = dataState.customItems.some(
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
    </View>
  );
}

// Helper function pour la catégorisation
function getCategoryFromName(name: string, type: 'resto' | 'boisson'): string {
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
}

// Styles optimisés
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
  typeSwitch: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    overflow: 'hidden',
  },
  typeOption: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
  },
  typeSelected: {
    backgroundColor: '#2196F3',
  },
  typeText: {
    fontWeight: '500',
  },
  typeTextSelected: {
    color: 'white',
  },
  categorySwitch: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  categoryOption: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
  },
  categorySelected: {
    backgroundColor: '#2196F3',
  },
  categoryText: {
    fontWeight: '500',
  },
  categoryTextSelected: {
    color: 'white',
  },
});
