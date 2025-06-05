// app/(tabs)/menu.tsx - VERSION ULTRA-SIMPLE
import { useToast } from '@/utils/ToastContext';
import { useSettings } from '@/utils/useSettings';
import { Plus, Minus, Edit3, Trash2 } from 'lucide-react-native';
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
} from 'react-native';
import { useMenu } from '../../utils/MenuManager';
import {
  CustomMenuItem,
  addCustomMenuItem,
  deleteCustomMenuItem,
  updateCustomMenuItem,
} from '../../utils/storage';

// ✅ Types simples
interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  type: 'resto' | 'boisson';
  available: boolean;
}

export default function MenuScreen() {
  // ✅ ÉTAT LOCAL SIMPLE
  const [activeType, setActiveType] = useState<'resto' | 'boisson' | null>(
    null
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  const toast = useToast();
  const { paymentMethods } = useSettings();

  // ✅ Menu simple
  const { isLoaded, getAllItems, getCategories, toggleItemAvailability } =
    useMenu();

  // ✅ FILTRAGE SIMPLE
  const filteredItems = getAllItems().filter((item) => {
    if (activeType && item.type !== activeType) return false;
    if (selectedCategory && item.category !== selectedCategory) return false;
    return true;
  });

  const categories = getCategories(activeType || undefined);

  // ✅ TOGGLE DISPONIBILITÉ SIMPLE
  const handleToggleAvailability = useCallback(
    async (itemId: number) => {
      try {
        const success = await toggleItemAvailability(itemId);
        if (success) {
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

  // ✅ ÉDITION SIMPLE
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
      setNewItemName(item.name);
      setNewItemPrice(item.price.toString());
      setEditModalVisible(true);
    },
    [toast]
  );

  // ✅ SAUVEGARDE SIMPLE
  const handleSaveEdit = useCallback(async () => {
    if (!editingItem) return;

    const price = parseFloat(newItemPrice);
    if (!newItemName.trim() || isNaN(price) || price <= 0) {
      toast.showToast('Veuillez entrer des valeurs valides', 'warning');
      return;
    }

    try {
      const updatedItem: CustomMenuItem = {
        id: editingItem.id,
        name: newItemName.trim(),
        price: price,
        category: editingItem.category,
        type: editingItem.type,
        available: editingItem.available,
      };

      await updateCustomMenuItem(updatedItem);

      setEditModalVisible(false);
      setEditingItem(null);
      setNewItemName('');
      setNewItemPrice('');

      toast.showToast('Article mis à jour', 'success');
    } catch (error) {
      console.error('Error updating item:', error);
      toast.showToast('Erreur lors de la mise à jour', 'error');
    }
  }, [editingItem, newItemName, newItemPrice, toast]);

  // ✅ SUPPRESSION SIMPLE
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
    [toast]
  );

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Chargement du menu...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header simple */}
      <View style={styles.header}>
        <Text style={styles.title}>Gestion du Menu</Text>

        {/* Filtres types */}
        <View style={styles.typeFilters}>
          <Pressable
            style={[
              styles.filterButton,
              activeType === null && styles.activeFilter,
            ]}
            onPress={() => setActiveType(null)}
          >
            <Text style={styles.filterText}>Tout</Text>
          </Pressable>
          <Pressable
            style={[
              styles.filterButton,
              activeType === 'resto' && styles.activeFilter,
            ]}
            onPress={() => setActiveType('resto')}
          >
            <Text style={styles.filterText}>Plats</Text>
          </Pressable>
          <Pressable
            style={[
              styles.filterButton,
              activeType === 'boisson' && styles.activeFilter,
            ]}
            onPress={() => setActiveType('boisson')}
          >
            <Text style={styles.filterText}>Boissons</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>
        {/* Sidebar catégories */}
        <View style={styles.sidebar}>
          <ScrollView>
            <Pressable
              style={[
                styles.categoryItem,
                selectedCategory === null && styles.activeCategory,
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={styles.categoryText}>Toutes</Text>
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
                <Text style={styles.categoryText}>{category}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Liste items */}
        <View style={styles.itemsContainer}>
          <ScrollView>
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
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>
                      {item.price.toFixed(2)} €
                    </Text>
                  </View>

                  <View style={styles.itemActions}>
                    {/* Toggle disponibilité */}
                    <Pressable
                      style={[
                        styles.actionButton,
                        {
                          backgroundColor: item.available
                            ? '#f44336'
                            : '#4CAF50',
                        },
                      ]}
                      onPress={() => handleToggleAvailability(item.id)}
                    >
                      <Text style={styles.actionText}>
                        {item.available ? 'Indisponible' : 'Disponible'}
                      </Text>
                    </Pressable>

                    {/* Éditer (seulement items personnalisés) */}
                    {item.id > 10000 && (
                      <Pressable
                        style={[
                          styles.actionButton,
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
                          styles.actionButton,
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

      {/* Modal d'édition simple */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifier l'article</Text>

            <TextInput
              style={styles.input}
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder="Nom de l'article"
            />

            <TextInput
              style={styles.input}
              value={newItemPrice}
              onChangeText={setNewItemPrice}
              placeholder="Prix"
              keyboardType="decimal-pad"
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: '#f44336' }]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Annuler</Text>
              </Pressable>

              <Pressable
                style={[styles.modalButton, { backgroundColor: '#4CAF50' }]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.modalButtonText}>Sauvegarder</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ✅ Styles simplifiés
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingText: { textAlign: 'center', marginTop: 50, fontSize: 16 },
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  typeFilters: { flexDirection: 'row', gap: 8 },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
  },
  activeFilter: { backgroundColor: '#2196F3' },
  filterText: { fontWeight: '500', color: '#666' },
  content: { flex: 1, flexDirection: 'row' },
  sidebar: {
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
  activeCategory: { backgroundColor: '#e3f2fd' },
  categoryText: { fontSize: 14, fontWeight: '500' },
  itemsContainer: { flex: 1, padding: 16 },
  itemsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  itemCard: {
    width: '32%',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  unavailableItem: { opacity: 0.6, backgroundColor: '#f0f0f0' },
  itemHeader: { marginBottom: 8 },
  itemName: { fontSize: 14, fontWeight: '500' },
  itemPrice: { fontSize: 12, color: '#4CAF50', fontWeight: '600' },
  itemActions: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  actionButton: {
    flex: 1,
    padding: 6,
    borderRadius: 4,
    alignItems: 'center',
    minWidth: 60,
  },
  actionText: { color: 'white', fontSize: 10, fontWeight: '500' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    width: '80%',
    padding: 20,
    borderRadius: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 10,
    marginBottom: 12,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  modalButtonText: { color: 'white', fontWeight: '500' },
});
