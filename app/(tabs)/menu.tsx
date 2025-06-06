// app/(tabs)/menu.tsx - VERSION AMÉLIORÉE COMPLÈTE
import { useToast } from '@/utils/ToastContext';
import { useSettings } from '@/utils/useSettings';
import { Plus, Minus, Edit3, Trash2, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Switch,
} from 'react-native';
import { useMenu } from '../../utils/MenuManager';
import {
  CustomMenuItem,
  addCustomMenuItem,
  deleteCustomMenuItem,
  updateCustomMenuItem,
} from '../../utils/storage';

// ✅ Types
interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  type: 'resto' | 'boisson';
  available: boolean;
}

// ✅ Catégories par type
const CATEGORIES_BY_TYPE = {
  resto: [
    'Plats Principaux',
    'Plats Maxi',
    'Salades',
    'Accompagnements',
    'Desserts',
    'Menu Enfant',
  ],
  boisson: ['Softs', 'Boissons Chaudes', 'Bières', 'Vins', 'Alcools', 'Glaces'],
};

export default function MenuScreen() {
  // ✅ ÉTAT LOCAL
  const [activeType, setActiveType] = useState<'resto' | 'boisson' | null>(
    null
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ✅ Modals
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

  // ✅ États d'édition
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');

  // ✅ États d'ajout
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemType, setNewItemType] = useState<'resto' | 'boisson'>('resto');
  const [newItemCategory, setNewItemCategory] = useState('Plats Principaux');
  const [newItemAvailable, setNewItemAvailable] = useState(true);

  // ✅ State pour forcer le re-render après toggle
  const [, forceUpdate] = useState({});

  const toast = useToast();
  const {
    isLoaded,
    getAllItems,
    getCategories,
    toggleItemAvailability,
    refresh,
  } = useMenu();

  // ✅ FILTRAGE
  const filteredItems = getAllItems().filter((item) => {
    if (activeType && item.type !== activeType) return false;
    if (selectedCategory && item.category !== selectedCategory) return false;
    return true;
  });

  const categories = getCategories(activeType || undefined);

  // ✅ TOGGLE DISPONIBILITÉ
  const handleToggleAvailability = useCallback(
    async (itemId: number) => {
      try {
        const success = await toggleItemAvailability(itemId);
        if (success) {
          // ✅ Forcer le re-render pour afficher le changement immédiatement
          forceUpdate({});
          toast.showToast('Disponibilité mise à jour', 'success');
        } else {
          toast.showToast('Erreur lors de la mise à jour', 'error');
        }
      } catch (error) {
        console.error('Error toggling availability:', error);
        toast.showToast('Erreur lors de la mise à jour', 'error');
      }
    },
    [toggleItemAvailability, toast]
  );

  // ✅ ÉDITION (seulement items personnalisés ID > 10000)
  const handleEdit = useCallback(
    (item: MenuItem) => {
      if (item.id <= 10000) {
        toast.showToast(
          'Les articles par défaut ne peuvent pas être modifiés',
          'info'
        );
        return;
      }

      setEditingItem(item);
      setEditItemName(item.name);
      setEditItemPrice(item.price.toString());
      setEditModalVisible(true);
    },
    [toast]
  );

  // ✅ SAUVEGARDE ÉDITION
  const handleSaveEdit = useCallback(async () => {
    if (!editingItem) return;

    const price = parseFloat(editItemPrice);
    if (!editItemName.trim() || isNaN(price) || price <= 0) {
      toast.showToast('Veuillez entrer des valeurs valides', 'warning');
      return;
    }

    try {
      const updatedItem: CustomMenuItem = {
        id: editingItem.id,
        name: editItemName.trim(),
        price: price,
        category: editingItem.category,
        type: editingItem.type,
        available: editingItem.available,
      };

      await updateCustomMenuItem(updatedItem);
      await refresh(); // ✅ Rafraîchir le menu

      setEditModalVisible(false);
      setEditingItem(null);
      setEditItemName('');
      setEditItemPrice('');

      toast.showToast('Article mis à jour', 'success');
    } catch (error) {
      console.error('Error updating item:', error);
      toast.showToast('Erreur lors de la mise à jour', 'error');
    }
  }, [editingItem, editItemName, editItemPrice, toast, refresh]);

  // ✅ SUPPRESSION (seulement items personnalisés ID > 10000)
  const handleDelete = useCallback(
    async (item: MenuItem) => {
      if (item.id <= 10000) {
        toast.showToast(
          'Les articles par défaut ne peuvent pas être supprimés',
          'info'
        );
        return;
      }

      Alert.alert(
        "Supprimer l'article",
        `Êtes-vous sûr de vouloir supprimer "${item.name}" ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteCustomMenuItem(item.id);
                await refresh(); // ✅ Rafraîchir le menu
                toast.showToast('Article supprimé', 'success');
              } catch (error) {
                console.error('Error deleting item:', error);
                toast.showToast('Erreur lors de la suppression', 'error');
              }
            },
          },
        ]
      );
    },
    [toast, refresh]
  );

  // ✅ AJOUT NOUVEL ITEM
  const handleAddItem = useCallback(async () => {
    const price = parseFloat(newItemPrice);
    if (!newItemName.trim() || isNaN(price) || price <= 0 || !newItemCategory) {
      toast.showToast(
        'Veuillez remplir tous les champs avec des valeurs valides',
        'warning'
      );
      return;
    }

    try {
      const newItem: CustomMenuItem = {
        id: Date.now(), // ID > 10000 pour les items personnalisés
        name: newItemName.trim(),
        price: price,
        category: newItemCategory,
        type: newItemType,
        available: newItemAvailable,
      };

      await addCustomMenuItem(newItem);
      await refresh(); // ✅ Rafraîchir le menu

      // Reset formulaire
      setNewItemName('');
      setNewItemPrice('');
      setNewItemCategory(CATEGORIES_BY_TYPE[newItemType][0]);
      setNewItemAvailable(true);
      setAddModalVisible(false);

      toast.showToast('Article ajouté avec succès', 'success');
    } catch (error) {
      console.error('Error adding item:', error);
      toast.showToast("Erreur lors de l'ajout", 'error');
    }
  }, [
    newItemName,
    newItemPrice,
    newItemCategory,
    newItemType,
    newItemAvailable,
    toast,
    refresh,
  ]);

  // ✅ Mettre à jour les catégories disponibles quand le type change
  useEffect(() => {
    if (newItemType) {
      const availableCategories = CATEGORIES_BY_TYPE[newItemType];
      if (
        availableCategories.length > 0 &&
        !availableCategories.includes(newItemCategory)
      ) {
        setNewItemCategory(availableCategories[0]);
      }
    }
  }, [newItemType, newItemCategory]);

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement du menu...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header amélioré */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Gestion du Menu</Text>
          <Pressable
            style={styles.addButton}
            onPress={() => setAddModalVisible(true)}
          >
            <Plus size={20} color="white" />
            <Text style={styles.addButtonText}>Ajouter</Text>
          </Pressable>
        </View>

        {/* Filtres types */}
        <View style={styles.typeFilters}>
          <Pressable
            style={[
              styles.filterButton,
              activeType === null && styles.activeFilter,
            ]}
            onPress={() => setActiveType(null)}
          >
            <Text
              style={[
                styles.filterText,
                activeType === null && styles.activeFilterText,
              ]}
            >
              Tout
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.filterButton,
              activeType === 'resto' && styles.activeFilter,
            ]}
            onPress={() => setActiveType('resto')}
          >
            <Text
              style={[
                styles.filterText,
                activeType === 'resto' && styles.activeFilterText,
              ]}
            >
              Plats
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.filterButton,
              activeType === 'boisson' && styles.activeFilter,
            ]}
            onPress={() => setActiveType('boisson')}
          >
            <Text
              style={[
                styles.filterText,
                activeType === 'boisson' && styles.activeFilterText,
              ]}
            >
              Boissons
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>
        {/* Sidebar catégories */}
        <View style={styles.sidebar}>
          <Text style={styles.sidebarTitle}>Catégories</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Pressable
              style={[
                styles.categoryItem,
                selectedCategory === null && styles.activeCategory,
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === null && styles.activeCategoryText,
                ]}
              >
                Toutes
              </Text>
            </Pressable>

            {categories.map((category) => (
              <Pressable
                key={category}
                style={[
                  styles.categoryItem,
                  selectedCategory === category && styles.activeCategory,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === category && styles.activeCategoryText,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Liste des items */}
        <View style={styles.itemsContainer}>
          <View style={styles.itemsHeader}>
            <Text style={styles.itemsTitle}>
              Articles ({filteredItems.length})
            </Text>
          </View>

          <ScrollView
            style={styles.itemsScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.itemsGrid}>
              {filteredItems.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.itemCard,
                    !item.available && styles.unavailableItem,
                  ]}
                >
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemPrice}>
                      {item.price.toFixed(2)} €
                    </Text>
                  </View>

                  <View style={styles.itemCategory}>
                    <Text style={styles.itemCategoryText}>{item.category}</Text>
                    <View
                      style={[
                        styles.typeTag,
                        {
                          backgroundColor:
                            item.type === 'resto' ? '#FF9800' : '#2196F3',
                        },
                      ]}
                    >
                      <Text style={styles.typeTagText}>
                        {item.type === 'resto' ? 'Plat' : 'Boisson'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.itemActions}>
                    {/* Toggle disponibilité */}
                    <Pressable
                      style={[
                        styles.actionButton,
                        {
                          backgroundColor: item.available
                            ? '#4CAF50'
                            : '#FF5722',
                        },
                      ]}
                      onPress={() => handleToggleAvailability(item.id)}
                    >
                      <Text style={styles.actionText}>
                        {item.available ? 'Disponible' : 'Indisponible'}
                      </Text>
                    </Pressable>

                    {/* Éditer (seulement items personnalisés) */}
                    {item.id > 10000 && (
                      <Pressable
                        style={[
                          styles.iconActionButton,
                          { backgroundColor: '#2196F3' },
                        ]}
                        onPress={() => handleEdit(item)}
                      >
                        <Edit3 size={16} color="white" />
                      </Pressable>
                    )}

                    {/* Supprimer (seulement items personnalisés) */}
                    {item.id > 10000 && (
                      <Pressable
                        style={[
                          styles.iconActionButton,
                          { backgroundColor: '#F44336' },
                        ]}
                        onPress={() => handleDelete(item)}
                      >
                        <Trash2 size={16} color="white" />
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Modal d'édition */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier l'article</Text>
              <Pressable onPress={() => setEditModalVisible(false)}>
                <X size={24} color="#666" />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Nom de l'article</Text>
              <TextInput
                style={styles.input}
                value={editItemName}
                onChangeText={setEditItemName}
                placeholder="Nom de l'article"
              />

              <Text style={styles.inputLabel}>Prix (€)</Text>
              <TextInput
                style={styles.input}
                value={editItemPrice}
                onChangeText={setEditItemPrice}
                placeholder="Prix"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </Pressable>

              <Pressable
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.saveButtonText}>Sauvegarder</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal d'ajout */}
      <Modal
        visible={addModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter un article</Text>
              <Pressable onPress={() => setAddModalVisible(false)}>
                <X size={24} color="#666" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Nom de l'article</Text>
              <TextInput
                style={styles.input}
                value={newItemName}
                onChangeText={setNewItemName}
                placeholder="Nom de l'article"
              />

              <Text style={styles.inputLabel}>Prix (€)</Text>
              <TextInput
                style={styles.input}
                value={newItemPrice}
                onChangeText={setNewItemPrice}
                placeholder="Prix"
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Type</Text>
              <View style={styles.typeSelector}>
                <Pressable
                  style={[
                    styles.typeSelectorButton,
                    newItemType === 'resto' && styles.activeTypeSelector,
                  ]}
                  onPress={() => setNewItemType('resto')}
                >
                  <Text
                    style={[
                      styles.typeSelectorText,
                      newItemType === 'resto' && styles.activeTypeSelectorText,
                    ]}
                  >
                    Plat
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.typeSelectorButton,
                    newItemType === 'boisson' && styles.activeTypeSelector,
                  ]}
                  onPress={() => setNewItemType('boisson')}
                >
                  <Text
                    style={[
                      styles.typeSelectorText,
                      newItemType === 'boisson' &&
                        styles.activeTypeSelectorText,
                    ]}
                  >
                    Boisson
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.inputLabel}>Catégorie</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categorySelector}
              >
                {CATEGORIES_BY_TYPE[newItemType].map((category) => (
                  <Pressable
                    key={category}
                    style={[
                      styles.categorySelectorButton,
                      newItemCategory === category &&
                        styles.activeCategorySelector,
                    ]}
                    onPress={() => setNewItemCategory(category)}
                  >
                    <Text
                      style={[
                        styles.categorySelectorText,
                        newItemCategory === category &&
                          styles.activeCategorySelectorText,
                      ]}
                    >
                      {category}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.availabilityRow}>
                <Text style={styles.inputLabel}>Disponible</Text>
                <Switch
                  value={newItemAvailable}
                  onValueChange={setNewItemAvailable}
                  trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setAddModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </Pressable>

              <Pressable
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddItem}
              >
                <Text style={styles.saveButtonText}>Ajouter</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ✅ Styles améliorés
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666',
  },

  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: { color: 'white', fontWeight: '600' },

  typeFilters: { flexDirection: 'row', gap: 8 },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
  },
  activeFilter: { backgroundColor: '#2196F3' },
  filterText: { fontWeight: '500', color: '#666' },
  activeFilterText: { color: 'white' },

  content: { flex: 1, flexDirection: 'row' },

  sidebar: {
    width: 200,
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    padding: 16,
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  categoryItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  activeCategory: { backgroundColor: '#e3f2fd' },
  categoryText: { fontSize: 14, fontWeight: '500', color: '#666' },
  activeCategoryText: { color: '#2196F3', fontWeight: '600' },

  itemsContainer: { flex: 1, padding: 16 },
  itemsHeader: { marginBottom: 16 },
  itemsTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  itemsScroll: { flex: 1 },
  itemsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  itemCard: {
    width: '31%',
    minWidth: 280,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unavailableItem: { opacity: 0.6, backgroundColor: '#f0f0f0' },

  itemHeader: { marginBottom: 8 },
  itemName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  itemPrice: { fontSize: 18, color: '#4CAF50', fontWeight: '700' },

  itemCategory: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemCategoryText: { fontSize: 12, color: '#666' },
  typeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  typeTagText: { fontSize: 10, color: 'white', fontWeight: '600' },

  itemActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  actionButton: {
    flex: 1,
    minWidth: 80,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: 'white', fontSize: 12, fontWeight: '500' },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    width: '80%',
    maxWidth: 500,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  modalBody: { padding: 20, maxHeight: 400 },

  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },

  typeSelector: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeSelectorButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTypeSelector: { backgroundColor: '#2196F3' },
  typeSelectorText: { fontWeight: '500', color: '#666' },
  activeTypeSelectorText: { color: 'white' },

  categorySelector: { marginBottom: 16 },
  categorySelectorButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    marginRight: 8,
  },
  activeCategorySelector: { backgroundColor: '#4CAF50' },
  categorySelectorText: { fontSize: 12, fontWeight: '500', color: '#666' },
  activeCategorySelectorText: { color: 'white' },

  availabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: { backgroundColor: '#f5f5f5' },
  saveButton: { backgroundColor: '#4CAF50' },
  cancelButtonText: { color: '#666', fontWeight: '500' },
  saveButtonText: { color: 'white', fontWeight: '600' },
});
