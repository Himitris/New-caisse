// app/(tabs)/menu.tsx - Pleinement fonctionnel avec tous les boutons actifs

import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput, Modal } from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { CirclePlus as PlusCircle, CircleMinus as MinusCircle, CreditCard as Edit, X, Save, Plus } from 'lucide-react-native';
import priceData from '../../helpers/ManjosPrice';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MENU_STORAGE_KEY = 'restaurant_menu_status';

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
  item: MenuItem | null;
  onClose: () => void;
  onSave: (item: MenuItem) => void;
}

// Définition des couleurs pour les catégories
const CATEGORY_COLORS: { [key: string]: string } = {
  // Resto
  'Plats Principaux': '#FF9800',
  'Plats Maxi': '#F44336',
  'Salades': '#4CAF50',
  'Accompagnements': '#CDDC39',
  'Desserts': '#E91E63',
  'Menu Enfant': '#8BC34A',
  // Boissons
  'Softs': '#03A9F4',
  'Boissons Chaudes': '#795548',
  'Bières': '#FFC107',
  'Vins': '#9C27B0',
  'Alcools': '#673AB7',
  'Glaces': '#00BCD4',
};

// Composant pour éditer un article
const EditItemModal: React.FC<EditModalProps> = ({ visible, item, onClose, onSave }) => {
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

  const handleSave = () => {
    if (!item) return;
    
    const updatedItem = {
      ...item,
      name,
      price: parseFloat(price) || item.price,
      available
    };
    
    onSave(updatedItem);
    onClose();
  };

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
                  available && styles.availabilitySelected
                ]}
                onPress={() => setAvailable(true)}
              >
                <Text style={[
                  styles.availabilityText,
                  available && styles.availabilityTextSelected
                ]}>Disponible</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.availabilityOption,
                  !available && styles.availabilitySelected
                ]}
                onPress={() => setAvailable(false)}
              >
                <Text style={[
                  styles.availabilityText,
                  !available && styles.availabilityTextSelected
                ]}>Indisponible</Text>
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
};

export default function MenuScreen() {
  // État pour filtrer par type
  const [activeType, setActiveType] = useState<'resto' | 'boisson' | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [originalItems, setOriginalItems] = useState<MenuItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  
  // Chargement initial des données
  useEffect(() => {
    loadMenuItemsStatus();
  }, []);
  
  // Sauvegarde des statuts de disponibilité
  const saveMenuItemsStatus = async () => {
    try {
      const itemStatus = menuItems.map(item => ({
        id: item.id,
        available: item.available,
        name: item.name,
        price: item.price
      }));
      
      await AsyncStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(itemStatus));
    } catch (error) {
      console.error('Error saving menu items status:', error);
    }
  };
  
  // Chargement des statuts de disponibilité
  const loadMenuItemsStatus = async () => {
    try {
      const storedStatus = await AsyncStorage.getItem(MENU_STORAGE_KEY);
      const itemsStatus = storedStatus ? JSON.parse(storedStatus) : [];
      
      // Convertir les données de ManjosPrice en items de menu
      const initialItems = priceData.map(item => {
        // Déterminer la catégorie en fonction du type et du nom
        let category = item.type === 'resto' ? 'Plats Principaux' : 'Softs';
        
        // Pour les plats (resto)
        if (item.type === 'resto') {
          if (item.name.toLowerCase().includes('salade')) {
            category = 'Salades';
          } else if (item.name.toLowerCase().includes('dessert')) {
            category = 'Desserts';
          } else if (item.name.toLowerCase().includes('frites')) {
            category = 'Accompagnements';
          } else if (item.name.toLowerCase().includes('menu enfant')) {
            category = 'Menu Enfant';
          } else if (item.name.toLowerCase().includes('maxi')) {
            category = 'Plats Maxi';
          }
        }
        // Pour les boissons
        else {
          if (item.name.toLowerCase().includes('glace')) {
            category = 'Glaces';
          } else if (item.name.toLowerCase().includes('thé') || item.name.toLowerCase().includes('café')) {
            category = 'Boissons Chaudes';
          } else if (item.name.toLowerCase().includes('bière') || item.name.toLowerCase().includes('blonde') || item.name.toLowerCase().includes('ambree')) {
            category = 'Bières';
          } else if (item.name.toLowerCase().includes('vin') || item.name.toLowerCase().includes('pichet') || item.name.toLowerCase().includes('btl')) {
            category = 'Vins';
          } else if (item.name.toLowerCase().includes('apero') || item.name.toLowerCase().includes('digestif') || item.name.toLowerCase().includes('ricard') || item.name.toLowerCase().includes('alcool') || item.name.toLowerCase().includes('punch') || item.name.toLowerCase().includes('cocktail')) {
            category = 'Alcools';
          }
        }
        
        // Vérifier si on a un statut sauvegardé pour cet item
        const savedStatus: { id: number; available: boolean; name: string; price: number } | undefined = itemsStatus.find((status: { id: number }) => status.id === item.id);
        
        return {
          id: item.id,
          name: savedStatus?.name || item.name,
          price: savedStatus?.price || item.price,
          category,
          available: savedStatus ? savedStatus.available : true, // Par défaut disponible
          type: item.type as 'resto' | 'boisson',
          color: CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || '#757575'
        };
      });
      
      setOriginalItems(initialItems);
      setMenuItems(initialItems);
    } catch (error) {
      console.error('Error loading menu items status:', error);
      // En cas d'erreur, initialiser avec tous les items disponibles
      initializeMenuItems();
    }
  };
  
  // Initialiser les items de menu si pas de données sauvegardées
  const initializeMenuItems = () => {
    const initialItems = priceData.map(item => {
      let category = item.type === 'resto' ? 'Plats Principaux' : 'Softs';
      
      if (item.type === 'resto') {
        if (item.name.toLowerCase().includes('salade')) {
          category = 'Salades';
        } else if (item.name.toLowerCase().includes('dessert')) {
          category = 'Desserts';
        } else if (item.name.toLowerCase().includes('frites')) {
          category = 'Accompagnements';
        } else if (item.name.toLowerCase().includes('menu enfant')) {
          category = 'Menu Enfant';
        } else if (item.name.toLowerCase().includes('maxi')) {
          category = 'Plats Maxi';
        }
      } else {
        if (item.name.toLowerCase().includes('glace')) {
          category = 'Glaces';
        } else if (item.name.toLowerCase().includes('thé') || item.name.toLowerCase().includes('café')) {
          category = 'Boissons Chaudes';
        } else if (item.name.toLowerCase().includes('bière') || item.name.toLowerCase().includes('blonde') || item.name.toLowerCase().includes('ambree')) {
          category = 'Bières';
        } else if (item.name.toLowerCase().includes('vin') || item.name.toLowerCase().includes('pichet') || item.name.toLowerCase().includes('btl')) {
          category = 'Vins';
        } else if (item.name.toLowerCase().includes('apero') || item.name.toLowerCase().includes('digestif') || item.name.toLowerCase().includes('ricard') || item.name.toLowerCase().includes('alcool') || item.name.toLowerCase().includes('punch') || item.name.toLowerCase().includes('cocktail')) {
          category = 'Alcools';
        }
      }
      
      return {
        id: item.id,
        name: item.name,
        price: item.price,
        category,
        available: true, // Tous les articles disponibles par défaut
        type: item.type as 'resto' | 'boisson',
        color: CATEGORY_COLORS[category] || '#757575'
      };
    });
    
    setOriginalItems(initialItems);
    setMenuItems(initialItems);
  };

  // Obtenir toutes les catégories uniques
  const categories = useMemo(() => {
    const allCategories = [...new Set(menuItems.map(item => item.category))];
    
    // Filtre par type si nécessaire
    if (activeType) {
      return allCategories.filter(category => 
        menuItems.some(item => item.category === category && item.type === activeType)
      );
    }
    
    return allCategories.sort();
  }, [menuItems, activeType]);

  // Fonction pour marquer un item disponible/indisponible
  const toggleItemAvailability = (itemId: number) => {
    setMenuItems(prev => {
      const updated = prev.map(item => 
        item.id === itemId ? { ...item, available: !item.available } : item
      );
      
      // Sauvegarder le changement dans AsyncStorage
      setTimeout(() => saveMenuItemsStatus(), 100);
      
      return updated;
    });
  };
  
  // Ouvrir la modal d'édition
  const handleEdit = (item: MenuItem) => {
    setEditItem(item);
    setEditModalVisible(true);
  };
  
  // Sauvegarder les modifications
  const handleSaveEdit = (updatedItem: MenuItem) => {
    setMenuItems(prev => {
      const updated = prev.map(item => 
        item.id === updatedItem.id ? updatedItem : item
      );
      
      // Sauvegarder le changement dans AsyncStorage
      setTimeout(() => saveMenuItemsStatus(), 100);
      
      return updated;
    });
  };
  
  // Filtrer par catégorie
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(selectedCategory === category ? null : category);
  };
  
  // Obtenir les items à afficher (filtrés par type et catégorie)
  const getFilteredItems = () => {
    let filtered = menuItems;
    
    if (activeType) {
      filtered = filtered.filter(item => item.type === activeType);
    }
    
    if (selectedCategory) {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }
    
    return filtered;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestion du Menu</Text>
        <View style={styles.typeFilters}>
          <Pressable 
            style={[
              styles.typeFilterButton,
              activeType === 'resto' && styles.activeTypeButton
            ]}
            onPress={() => setActiveType(activeType === 'resto' ? null : 'resto')}>
            <Text style={[
              styles.typeFilterText,
              activeType === 'resto' && styles.activeTypeText
            ]}>Plats</Text>
          </Pressable>
          <Pressable 
            style={[
              styles.typeFilterButton,
              activeType === 'boisson' && styles.activeTypeButton
            ]}
            onPress={() => setActiveType(activeType === 'boisson' ? null : 'boisson')}>
            <Text style={[
              styles.typeFilterText,
              activeType === 'boisson' && styles.activeTypeText
            ]}>Boissons</Text>
          </Pressable>
        </View>
        <Pressable 
          style={styles.addButton}
          onPress={() => Alert.alert("Fonctionnalité", "Ajouter un nouvel article sera disponible dans une future mise à jour.")}
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
                !selectedCategory && styles.activeCategoryItem
              ]}
              onPress={() => setSelectedCategory(null)}>
              <Text style={[
                styles.categoryItemText,
                !selectedCategory && styles.activeCategoryItemText
              ]}>Toutes les catégories</Text>
            </Pressable>
            
            {categories.map(category => (
              <Pressable
                key={category}
                style={[
                  styles.categoryItem,
                  selectedCategory === category && styles.activeCategoryItem,
                  { borderLeftColor: CATEGORY_COLORS[category] || '#757575' }
                ]}
                onPress={() => handleCategorySelect(category)}>
                <Text style={[
                  styles.categoryItemText,
                  selectedCategory === category && styles.activeCategoryItemText
                ]}>{category}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        
        <View style={styles.menuItemsContainer}>
          <ScrollView>
            <View style={styles.menuItemsGrid}>
              {getFilteredItems().map(item => (
                <View key={item.id} style={[
                  styles.menuItem,
                  { borderLeftColor: item.color }
                ]}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                  </View>
                  <View style={styles.itemActions}>
                    <Pressable
                      style={[
                        styles.actionButton,
                        { backgroundColor: item.available ? '#f44336' : '#4CAF50' },
                      ]}
                      onPress={() => toggleItemAvailability(item.id)}>
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
                      onPress={() => handleEdit(item)}
                    >
                      <Edit size={16} color="#fff" />
                      <Text style={styles.actionButtonText}>Modifier</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
      
      {/* Modal d'édition */}
      <EditItemModal 
        visible={editModalVisible}
        item={editItem}
        onClose={() => setEditModalVisible(false)}
        onSave={handleSaveEdit}
      />
    </View>
  );
}

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
  categorySection: {
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
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