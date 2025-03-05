// app/(tabs)/menu.tsx - Pleinement fonctionnel avec tous les boutons actifs
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput, Modal } from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { CirclePlus as PlusCircle, CircleMinus as MinusCircle, CreditCard as Edit, X, Save, Plus, Trash2 } from 'lucide-react-native';
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
  saveCustomMenuItems
} from '../../utils/storage';

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

const AddItemModal: React.FC<EditModalProps> = ({ visible, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [available, setAvailable] = useState(true);
  const [type, setType] = useState<'resto' | 'boisson'>('resto');
  const [category, setCategory] = useState('Plats Principaux');

  const handleSave = () => {
    const newItem: MenuItem = {
      id: Date.now(), // Utilisez un ID unique
      name,
      price: parseFloat(price) || 0,
      category,
      available,
      type,
      color: CATEGORY_COLORS[category] || '#757575'
    };

    onSave(newItem);
    onClose();
  };

  const categories = type === 'resto'
    ? ['Plats Principaux', 'Plats Maxi', 'Salades', 'Accompagnements', 'Desserts', 'Menu Enfant']
    : ['Softs', 'Boissons Chaudes', 'Bières', 'Vins', 'Alcools', 'Glaces'];

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
                  type === 'resto' && styles.typeSelected
                ]}
                onPress={() => {
                  setType('resto');
                  setCategory('Plats Principaux');
                }}
              >
                <Text style={[
                  styles.typeText,
                  type === 'resto' && styles.typeTextSelected
                ]}>Plat</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.typeOption,
                  type === 'boisson' && styles.typeSelected
                ]}
                onPress={() => {
                  setType('boisson');
                  setCategory('Softs');
                }}
              >
                <Text style={[
                  styles.typeText,
                  type === 'boisson' && styles.typeTextSelected
                ]}>Boisson</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Catégorie:</Text>
            <View style={styles.categorySwitch}>
              {categories.map(cat => (
                <Pressable
                  key={cat}
                  style={[
                    styles.categoryOption,
                    category === cat && styles.categorySelected
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[
                    styles.categoryText,
                    category === cat && styles.categoryTextSelected
                  ]}>{cat}</Text>
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
  const [customItems, setCustomItems] = useState<CustomMenuItem[]>([]);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

  // Chargement initial des données
  useEffect(() => {
    loadMenuItemsStatus();
  }, []);

  const handleSaveNewItem = async (newItem: MenuItem) => {
    try {
      // Créer un nouvel article personnalisé
      const customMenuItem: CustomMenuItem = {
        id: newItem.id,
        name: newItem.name,
        price: newItem.price,
        category: newItem.category,
        type: newItem.type,
        available: newItem.available
      };

      // Sauvegarder dans le stockage personnalisé
      await addCustomMenuItem(customMenuItem);

      // Ajouter à l'état local
      setCustomItems(prev => [...prev, customMenuItem]);

      // Mettre à jour les menuItems
      setMenuItems(prev => {
        const updated = [...prev, newItem];
        return updated;
      });

      // Sauvegarder dans la disponibilité du menu
      const itemStatus: MenuItemAvailability = {
        id: newItem.id,
        available: newItem.available,
        name: newItem.name,
        price: newItem.price
      };

      const currentAvailability = await getMenuAvailability();
      await saveMenuAvailability([...currentAvailability, itemStatus]);

    } catch (error) {
      console.error('Error saving new menu item:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder le nouvel article.');
    }
  };

  // Sauvegarde des statuts de disponibilité
  const saveMenuItemsStatus = async () => {
    try {
      const itemStatus: MenuItemAvailability[] = menuItems.map(item => ({
        id: item.id,
        available: item.available,
        name: item.name,
        price: item.price
      }));

      await saveMenuAvailability(itemStatus);
    } catch (error) {
      console.error('Error saving menu items status:', error);
    }
  };

  // Chargement des statuts de disponibilité
  const loadMenuItemsStatus = async () => {
    try {
      const itemsStatus = await getMenuAvailability();
      const customItems = await getCustomMenuItems(); // Charger les articles personnalisés

      // Convertir les données de ManjosPrice en items de menu
      let initialItems = priceData.map(item => {
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
        const savedStatus = itemsStatus.find((status) => status.id === item.id);

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

      // Ajouter les articles personnalisés à la liste
      const customMenuItems = customItems.map(item => {
        // Vérifier si on a un statut sauvegardé pour cet article personnalisé
        const savedStatus = itemsStatus.find((status) => status.id === item.id);

        return {
          id: item.id,
          name: item.name,
          price: item.price,
          category: item.category,
          available: savedStatus ? savedStatus.available : item.available,
          type: item.type,
          color: CATEGORY_COLORS[item.category as keyof typeof CATEGORY_COLORS] || '#757575'
        };
      });

      // Combiner les articles standard et personnalisés
      initialItems = [...initialItems, ...customMenuItems];

      setOriginalItems(initialItems);
      setMenuItems(initialItems);
      setCustomItems(customItems);
    } catch (error) {
      console.error('Error loading menu items status:', error);
      // En cas d'erreur, initialiser avec tous les items disponibles
      initializeMenuItems();
    }
  };

  // Initialiser les items de menu si pas de données sauvegardées
  const initializeMenuItems = async () => {
    try {
      // Charger les articles personnalisés même en cas d'initialisation
      const customItems = await getCustomMenuItems();

      let initialItems = priceData.map(item => {
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

      // Ajouter les articles personnalisés à la liste
      const customMenuItems = customItems.map(item => {
        return {
          id: item.id,
          name: item.name,
          price: item.price,
          category: item.category,
          available: item.available,
          type: item.type,
          color: CATEGORY_COLORS[item.category as keyof typeof CATEGORY_COLORS] || '#757575'
        };
      });

      // Combiner les articles standard et personnalisés
      initialItems = [...initialItems, ...customMenuItems];

      setOriginalItems(initialItems);
      setMenuItems(initialItems);
      setCustomItems(customItems);
    } catch (error) {
      console.error('Error initializing menu items:', error);

      // En dernier recours, charger seulement les articles standards
      const standardItems = priceData.map(item => {
        let category = item.type === 'resto' ? 'Plats Principaux' : 'Softs';
        // Déterminer la catégorie (même logique que précédemment)

        return {
          id: item.id,
          name: item.name,
          price: item.price,
          category,
          available: true,
          type: item.type as 'resto' | 'boisson',
          color: CATEGORY_COLORS[category] || '#757575'
        };
      });

      setOriginalItems(standardItems);
      setMenuItems(standardItems);
    }
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
  const toggleItemAvailability = async (itemId: number) => {
    try {
      // Trouver l'item à modifier
      const itemToToggle = menuItems.find(item => item.id === itemId);
      if (!itemToToggle) return;

      // Créer un nouveau tableau avec l'item modifié
      const updated = menuItems.map(item =>
        item.id === itemId ? { ...item, available: !item.available } : item
      );

      // Mettre à jour l'état local immédiatement
      setMenuItems(updated);

      // Si c'est un article personnalisé, mettre à jour aussi dans customItems
      const isCustomItem = customItems.some(item => item.id === itemId);
      if (isCustomItem) {
        const updatedCustomItems = customItems.map(item =>
          item.id === itemId ? { ...item, available: !item.available } : item
        );
        setCustomItems(updatedCustomItems);

        // Sauvegarder les modifications dans le stockage des articles personnalisés
        await saveCustomMenuItems(updatedCustomItems);
      }

      // Sauvegarder le changement dans AsyncStorage pour la disponibilité
      const availability = await getMenuAvailability();
      const existingItemIndex = availability.findIndex(item => item.id === itemId);

      let updatedAvailability;
      if (existingItemIndex >= 0) {
        // Mettre à jour l'article existant
        updatedAvailability = availability.map(item =>
          item.id === itemId ? {
            ...item,
            available: !item.available
          } : item
        );
      } else {
        // Ajouter l'article s'il n'existe pas
        const newAvailabilityItem = {
          id: itemId,
          available: !itemToToggle.available,
          name: itemToToggle.name,
          price: itemToToggle.price
        };
        updatedAvailability = [...availability, newAvailabilityItem];
      }

      await saveMenuAvailability(updatedAvailability);

      // Facultatif: Ajouter un feedback visuel
      const updatedItem = updated.find(item => item.id === itemId);
      const status = updatedItem?.available ? 'disponible' : 'indisponible';
      console.log(`Article ${updatedItem?.name} maintenant ${status}`);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la disponibilité:', error);
      // Réinitialiser l'état en cas d'erreur d'enregistrement
      Alert.alert('Erreur', 'Impossible de mettre à jour la disponibilité de l\'article.');
    }
  };

  // Ouvrir la modal d'édition
  const handleEdit = (item: MenuItem) => {
    setEditItem(item);
    setEditModalVisible(true);
  };

  // Sauvegarder les modifications
  const handleSaveEdit = async (updatedItem: MenuItem) => {
    try {
      // Vérifier si c'est un article personnalisé
      const isCustomItem = customItems.some(item => item.id === updatedItem.id);

      if (isCustomItem) {
        // Mettre à jour l'article personnalisé
        const customMenuItem: CustomMenuItem = {
          id: updatedItem.id,
          name: updatedItem.name,
          price: updatedItem.price,
          category: updatedItem.category,
          type: updatedItem.type,
          available: updatedItem.available
        };

        await updateCustomMenuItem(customMenuItem);

        // Mettre à jour l'état local des articles personnalisés
        setCustomItems(prev => prev.map(item =>
          item.id === updatedItem.id ? customMenuItem : item
        ));
      }

      // Continuer avec votre code existant pour l'état local et la disponibilité
      setMenuItems(prev => {
        const updated = prev.map(item =>
          item.id === updatedItem.id ? updatedItem : item
        );
        return updated;
      });

      // Mettre à jour la disponibilité
      const availability = await getMenuAvailability();
      const updatedAvailability = availability.map(item =>
        item.id === updatedItem.id
          ? {
            id: updatedItem.id,
            available: updatedItem.available,
            name: updatedItem.name,
            price: updatedItem.price
          }
          : item
      );

      // Si l'article n'existe pas encore dans la disponibilité, l'ajouter
      const itemExists = updatedAvailability.some(item => item.id === updatedItem.id);
      if (!itemExists) {
        updatedAvailability.push({
          id: updatedItem.id,
          available: updatedItem.available,
          name: updatedItem.name,
          price: updatedItem.price
        });
      }

      await saveMenuAvailability(updatedAvailability);

    } catch (error) {
      console.error('Error updating menu item:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour l\'article.');
    }
  };

  // Fonction pour supprimer un article personnalisé
  const handleDeleteMenuItem = (itemId: number) => {
    // Vérifier si c'est un article personnalisé
    const isCustomItem = customItems.some(item => item.id === itemId);

    if (!isCustomItem) {
      Alert.alert('Information', 'Seuls les articles personnalisés peuvent être supprimés.');
      return;
    }

    Alert.alert(
      'Supprimer l\'article',
      'Êtes-vous sûr de vouloir supprimer cet article du menu ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              // Supprimer l'article du stockage
              await deleteCustomMenuItem(itemId);

              // Mettre à jour la liste des articles personnalisés
              const updatedCustomItems = customItems.filter(item => item.id !== itemId);
              setCustomItems(updatedCustomItems);

              // Mettre à jour la liste complète des articles
              const updatedMenuItems = menuItems.filter(item => item.id !== itemId);
              setMenuItems(updatedMenuItems);

              // Supprimer également de la liste de disponibilité
              const availability = await getMenuAvailability();
              const updatedAvailability = availability.filter(item => item.id !== itemId);
              await saveMenuAvailability(updatedAvailability);

              Alert.alert('Succès', 'L\'article a été supprimé avec succès.');
            } catch (error) {
              console.error('Erreur lors de la suppression de l\'article:', error);
              Alert.alert('Erreur', 'Impossible de supprimer l\'article. Veuillez réessayer.');
            }
          }
        }
      ]
    );
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

  // Fonction de débugage pour afficher l'état actuel des articles (utile pour le débogage)
  const debugMenuItems = () => {
    console.log('Standard menu items:', priceData.length);
    console.log('Custom menu items:', customItems.length);
    console.log('Total menu items:', menuItems.length);

    // Afficher les détails des articles personnalisés
    if (customItems.length > 0) {
      console.log('Custom items details:');
      customItems.forEach(item => {
        console.log(`ID: ${item.id}, Name: ${item.name}, Type: ${item.type}, Category: ${item.category}, Available: ${item.available}`);
      });
    }
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
          onPress={() => setAddModalVisible(true)}
        >
          <PlusCircle size={24} color="#fff" />
          <Text style={styles.addButtonText}>Ajouter un item</Text>
        </Pressable>
      </View>

      {/* Modal d'ajout */}
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
              {getFilteredItems().map(item => {
                // Vérifier si c'est un article personnalisé
                const isCustomItem = customItems.some(customItem => customItem.id === item.id);

                return (
                  <View key={item.id} style={[
                    styles.menuItem,
                    { borderLeftColor: item.color }
                  ]}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.itemPrice}>{item.price.toFixed(2)} €</Text>
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

                      {/* Bouton Supprimer pour les articles personnalisés uniquement */}
                      {isCustomItem && (
                        <Pressable
                          style={[styles.actionButton, { backgroundColor: '#F44336' }]}
                          onPress={() => handleDeleteMenuItem(item.id)}
                        >
                          <Trash2 size={16} color="#fff" />
                          <Text style={styles.actionButtonText}>Supprimer</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
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