// app/(tabs)/menu.tsx - VERSION SIMPLIFIÉE AVEC NOUVEAUX HOOKS

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
import { useState, useMemo, useCallback, memo, useEffect } from 'react';
import {
  CirclePlus as PlusCircle,
  CircleMinus as MinusCircle,
  CreditCard as Edit,
  X,
  Save,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { useMenu, menuManager } from '../../utils/MenuManager'; // ✅ Import du nouveau hook
import { useInstanceManager } from '../../utils/useInstanceManager'; // ✅ Import du gestionnaire
import {
  getMenuAvailability,
  saveMenuAvailability,
  MenuItemAvailability,
  addCustomMenuItem,
  updateCustomMenuItem,
  deleteCustomMenuItem,
  CustomMenuItem,
  saveCustomMenuItems,
} from '../../utils/storage';
import { useToast } from '@/utils/ToastContext';

// ✅ Interface pour les types du menu
interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  type: 'resto' | 'boisson';
  color: string;
  available: boolean;
}

// ✅ États simplifiés pour le menu
interface MenuState {
  activeType: 'resto' | 'boisson' | null;
  selectedCategory: string | null;
}

// ✅ Modal d'édition optimisée et mémorisée
interface EditModalProps {
  visible: boolean;
  item: MenuItem | null;
  onClose: () => void;
  onSave: (item: MenuItem) => void;
}

const EditItemModal = memo<EditModalProps>(
  ({ visible, item, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [available, setAvailable] = useState(true);

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
        name,
        price: parseFloat(price) || item.price,
        available,
      };

      onSave(updatedItem);
      onClose();
    }, [item, name, price, available, onSave, onClose]);

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

// ✅ Composant MenuItemCard optimisé
const MenuItemCard = memo(
  ({
    item,
    onToggleAvailability,
    onEdit,
    onDelete,
  }: {
    item: MenuItem;
    onToggleAvailability: () => void;
    onEdit: () => void;
    onDelete: () => void;
  }) => {
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
            onPress={onToggleAvailability}
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
        </View>
      </View>
    );
  },
  // ✅ Comparaison stricte pour éviter les re-renders
  (prevProps, nextProps) => {
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.available === nextProps.item.available &&
      prevProps.item.name === nextProps.item.name &&
      prevProps.item.price === nextProps.item.price
    );
  }
);

export default function MenuScreen() {
  // ✅ Utilisation des nouveaux hooks
  const { isLoaded, getItems, getCategories } = useMenu();
  const { isMounted, setSafeTimeout, safeExecute } =
    useInstanceManager('MenuScreen');

  // ✅ États simplifiés
  const [menuState, setMenuState] = useState<MenuState>({
    activeType: null,
    selectedCategory: null,
  });
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [unavailableItems, setUnavailableItems] = useState<Set<number>>(
    new Set()
  );

  const toast = useToast();

  // ✅ Chargement des items indisponibles
  useEffect(() => {
    const loadUnavailableItems = async () => {
      try {
        const availability = await getMenuAvailability();
        const unavailable = new Set(
          availability.filter((item) => !item.available).map((item) => item.id)
        );
        if (isMounted()) {
          setUnavailableItems(unavailable);
        }
      } catch (error) {
        console.error('Error loading menu availability:', error);
      }
    };

    if (isLoaded) {
      loadUnavailableItems();
    }
  }, [isLoaded, isMounted]);

  // ✅ Items de menu avec disponibilité
  const menuItemsWithAvailability = useMemo((): MenuItem[] => {
    if (!isLoaded) return [];

    return getItems().map((item) => ({
      ...item,
      available: !unavailableItems.has(item.id),
    }));
  }, [isLoaded, getItems, unavailableItems]);

  // ✅ Catégories filtrées
  const categories = useMemo((): string[] => {
    if (!isLoaded) return [];

    return getCategories(menuState.activeType || undefined);
  }, [isLoaded, getCategories, menuState.activeType]);

  // ✅ Items filtrés
  const filteredItems = useMemo((): MenuItem[] => {
    let filtered = menuItemsWithAvailability;

    if (menuState.activeType) {
      filtered = filtered.filter((item) => item.type === menuState.activeType);
    }

    if (menuState.selectedCategory) {
      filtered = filtered.filter(
        (item) => item.category === menuState.selectedCategory
      );
    }

    return filtered;
  }, [
    menuItemsWithAvailability,
    menuState.activeType,
    menuState.selectedCategory,
  ]);

  // ✅ Handler pour changer la disponibilité
  const toggleItemAvailability = useCallback(
    async (itemId: number): Promise<void> => {
      if (!isMounted()) return;

      try {
        const isCurrentlyAvailable = !unavailableItems.has(itemId);
        const newAvailability = !isCurrentlyAvailable;

        // Mise à jour optimiste
        safeExecute(() => {
          setUnavailableItems((prev) => {
            const newSet = new Set(prev);
            if (newAvailability) {
              newSet.delete(itemId);
            } else {
              newSet.add(itemId);
            }
            return newSet;
          });
        });

        // Sauvegarde avec délai pour grouper les modifications
        setSafeTimeout(async () => {
          if (!isMounted()) return;

          try {
            const item = getItems().find((i) => i.id === itemId);
            if (!item) return;

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
                    name: item.name,
                    price: item.price,
                  },
                ];

            await saveMenuAvailability(updatedAvailability);

            // Forcer le rechargement du menu dans le manager
            menuManager.reset();
            await menuManager.ensureLoaded();
          } catch (error) {
            console.error('Erreur lors de la mise à jour:', error);
            toast.showToast(
              'Impossible de mettre à jour la disponibilité.',
              'error'
            );

            // Revenir à l'état précédent en cas d'erreur
            if (isMounted()) {
              safeExecute(() => {
                setUnavailableItems((prev) => {
                  const newSet = new Set(prev);
                  if (!newAvailability) {
                    newSet.delete(itemId);
                  } else {
                    newSet.add(itemId);
                  }
                  return newSet;
                });
              });
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
    [unavailableItems, isMounted, safeExecute, setSafeTimeout, getItems, toast]
  );

  // ✅ Handlers simplifiés
  const handleEdit = useCallback((item: MenuItem) => {
    setEditItem(item);
    setEditModalVisible(true);
  }, []);

  const handleSaveEdit = useCallback(
    async (updatedItem: MenuItem) => {
      try {
        // Mise à jour optimiste
        safeExecute(() => {
          setUnavailableItems((prev) => {
            const newSet = new Set(prev);
            if (updatedItem.available) {
              newSet.delete(updatedItem.id);
            } else {
              newSet.add(updatedItem.id);
            }
            return newSet;
          });
        });

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

        // Forcer le rechargement du menu
        menuManager.reset();
        await menuManager.ensureLoaded();

        toast.showToast('Article mis à jour avec succès.', 'success');
      } catch (error) {
        console.error('Error updating menu item:', error);
        toast.showToast("Impossible de mettre à jour l'article.", 'error');
      }
    },
    [safeExecute, toast]
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
      selectedCategory: null, // Reset category when changing type
    }));
  }, []);

  // ✅ Affichage conditionnel si le menu n'est pas chargé
  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Gestion du Menu</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Chargement du menu...</Text>
        </View>
      </View>
    );
  }

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
              {filteredItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onToggleAvailability={() => toggleItemAvailability(item.id)}
                  onEdit={() => handleEdit(item)}
                  onDelete={() => {}} // Placeholder pour delete
                />
              ))}
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

// ✅ Styles conservés identiques
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
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
  },
  activeCategoryItem: {
    backgroundColor: '#e3f2fd',
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
