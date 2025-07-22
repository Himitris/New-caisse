// app/payment/items.tsx - Version avec division d'articles
import { useSettings } from '@/utils/useSettings';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTableContext } from '@/utils/TableContext';
import {
  ArrowLeft,
  CreditCard,
  Edit3,
  Gift,
  Minus,
  Plus,
  ShoppingCart,
  Wallet,
  Users, // Nouvelle icône pour le split
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  addBill,
  getTable,
  OrderItem,
  resetTable,
  updateTable,
} from '../../utils/storage';
import { useToast } from '../../utils/ToastContext';

interface MenuItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  total: number;
  notes?: string;
  offered?: boolean;
  // Nouvelles propriétés pour la division
  isSplit?: boolean;
  splitInfo?: {
    originalQuantity: number;
    splitParts: number;
    pricePerPart: number;
  };
}

interface SelectedMenuItem extends MenuItem {
  selectedQuantity: number;
  offered?: boolean;
  uniqueKey?: string;
}

// Modal pour configurer la division d'un article
const SplitItemModal = memo(
  ({
    visible,
    item,
    onClose,
    onConfirm,
  }: {
    visible: boolean;
    item: MenuItem | null;
    onClose: () => void;
    onConfirm: (quantityToSplit: number, splitParts: number) => void;
  }) => {
    const [quantityToSplit, setQuantityToSplit] = useState('1');
    const [splitParts, setSplitParts] = useState('2');
    const [error, setError] = useState('');

    // Réinitialiser les valeurs quand la modal s'ouvre
    useEffect(() => {
      if (visible && item) {
        setQuantityToSplit('1');
        setSplitParts('2');
        setError('');
      }
    }, [visible, item]);

    const handleConfirm = () => {
      const quantity = parseInt(quantityToSplit);
      const parts = parseInt(splitParts);

      if (!item) return;

      if (isNaN(quantity) || quantity < 1 || quantity > item.quantity) {
        setError(`La quantité doit être entre 1 et ${item.quantity}`);
        return;
      }

      if (isNaN(parts) || parts < 2 || parts > 10) {
        setError('Le nombre de parts doit être entre 2 et 10');
        return;
      }

      onConfirm(quantity, parts);
      onClose();
    };

    const pricePerPart =
      item && quantityToSplit
        ? (item.price / parseInt(splitParts || '2')).toFixed(2)
        : '0.00';

    const totalSplitItems =
      quantityToSplit && splitParts
        ? parseInt(quantityToSplit) * parseInt(splitParts)
        : 0;

    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Diviser l'article</Text>

            {item && (
              <View style={styles.itemPreview}>
                <Text style={styles.itemPreviewName}>{item.name}</Text>
                <Text style={styles.itemPreviewPrice}>
                  Prix unitaire: {item.price.toFixed(2)} €
                </Text>
                <Text style={styles.itemPreviewQuantity}>
                  Quantité disponible: {item.quantity}
                </Text>
              </View>
            )}

            {item && item.quantity > 1 && (
              <>
                <Text style={styles.modalLabel}>Quantité à diviser:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={quantityToSplit}
                  onChangeText={(text) => {
                    setQuantityToSplit(text);
                    setError('');
                  }}
                  keyboardType="numeric"
                  placeholder={`1-${item.quantity}`}
                  maxLength={2}
                />
              </>
            )}

            <Text style={styles.modalLabel}>
              Diviser chaque unité en combien de parts:
            </Text>
            <TextInput
              style={styles.modalInput}
              value={splitParts}
              onChangeText={(text) => {
                setSplitParts(text);
                setError('');
              }}
              keyboardType="numeric"
              placeholder="Nombre de parts (2-10)"
              maxLength={2}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {!error && quantityToSplit && splitParts && (
              <View style={styles.calculationContainer}>
                <Text style={styles.calculationText}>
                  Prix par part: {pricePerPart} €
                </Text>
                <Text style={styles.calculationSubText}>
                  Total: {totalSplitItems} parts créées ({quantityToSplit} ×{' '}
                  {splitParts})
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancelButton} onPress={onClose}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirmButton}
                onPress={handleConfirm}
              >
                <Text style={styles.modalConfirmText}>Diviser</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
);

// Fonction utilitaire pour obtenir l'icône en fonction du type de méthode
function getMethodIcon(methodId: string) {
  switch (methodId) {
    case 'card':
      return <CreditCard size={32} color="white" />;
    case 'cash':
      return <Wallet size={32} color="white" />;
    case 'check':
      return <Edit3 size={32} color="white" />;
    default:
      return <CreditCard size={32} color="white" />;
  }
}

// Fonction utilitaire pour les couleurs
function getMethodColor(methodId: string) {
  switch (methodId) {
    case 'card':
      return '#673AB7';
    case 'cash':
      return '#2196F3';
    case 'check':
      return '#9C27B0';
    default:
      return '#757575';
  }
}

// Fonction améliorée pour catégoriser les items
const getCategoryFromName = (name: string): 'plat' | 'boisson' => {
  const lowerName = name.toLowerCase();

  // Boissons alcoolisées - bières
  if (lowerName.includes('pinte') || lowerName.includes('demi'))
    return 'boisson';
  if (
    lowerName.includes('bière') ||
    lowerName.includes('blonde') ||
    lowerName.includes('ambree') ||
    lowerName.includes('brune')
  )
    return 'boisson';
  if (
    lowerName.includes('pression') ||
    lowerName.includes('hoegaarden') ||
    lowerName.includes('leffe') ||
    lowerName.includes('stella')
  )
    return 'boisson';

  // Boissons alcoolisées - vins et spiritueux
  if (
    lowerName.includes('vin') ||
    lowerName.includes('pichet') ||
    lowerName.includes('btl') ||
    lowerName.includes('bouteille')
  )
    return 'boisson';
  if (
    lowerName.includes('apero') ||
    lowerName.includes('digestif') ||
    lowerName.includes('ricard') ||
    lowerName.includes('pastis')
  )
    return 'boisson';
  if (
    lowerName.includes('alcool') ||
    lowerName.includes('punch') ||
    lowerName.includes('cocktail') ||
    lowerName.includes('mojito')
  )
    return 'boisson';
  if (
    lowerName.includes('whisky') ||
    lowerName.includes('vodka') ||
    lowerName.includes('rhum') ||
    lowerName.includes('gin')
  )
    return 'boisson';
  if (
    lowerName.includes('champagne') ||
    lowerName.includes('prosecco') ||
    lowerName.includes('kir')
  )
    return 'boisson';

  // Boissons chaudes
  if (
    lowerName.includes('thé') ||
    lowerName.includes('café') ||
    lowerName.includes('cappuccino') ||
    lowerName.includes('expresso')
  )
    return 'boisson';
  if (
    lowerName.includes('chocolat chaud') ||
    lowerName.includes('infusion') ||
    lowerName.includes('tisane')
  )
    return 'boisson';

  // Boissons froides non alcoolisées
  if (
    lowerName.includes('glace') &&
    (lowerName.includes('thé') || lowerName.includes('café'))
  )
    return 'boisson';
  if (
    lowerName.includes('boisson') ||
    lowerName.includes('soft') ||
    lowerName.includes('soda')
  )
    return 'boisson';
  if (
    lowerName.includes('coca') ||
    lowerName.includes('pepsi') ||
    lowerName.includes('sprite') ||
    lowerName.includes('fanta')
  )
    return 'boisson';
  if (
    lowerName.includes('jus') ||
    lowerName.includes('smoothie') ||
    lowerName.includes('milkshake')
  )
    return 'boisson';
  if (
    lowerName.includes('eau') ||
    lowerName.includes('perrier') ||
    lowerName.includes('san pellegrino')
  )
    return 'boisson';
  if (
    lowerName.includes('limonade') ||
    lowerName.includes('citronnade') ||
    lowerName.includes('orangeade')
  )
    return 'boisson';

  // Tout le reste est considéré comme un plat
  return 'plat';
};

// Fonction utilitaire pour catégoriser les items
const categorizeItems = (items: (MenuItem | SelectedMenuItem)[]) => {
  return items.reduce(
    (acc, item) => {
      const category = getCategoryFromName(item.name);
      acc[category].push(item);
      return acc;
    },
    { plat: [] as any[], boisson: [] as any[] }
  );
};

// Composant ItemCard optimisé avec React.memo - Version avec split
const ItemCard = memo(
  ({
    item,
    isSelected,
    onAdd,
    onQuantityChange,
    onRemoveCompletely,
    onToggleOffered,
    onSplitItem,
  }: {
    item: MenuItem | SelectedMenuItem;
    isSelected: boolean;
    onAdd?: (addAll?: boolean) => void;
    onQuantityChange?: (increment: boolean) => void;
    onRemoveCompletely?: () => void;
    onToggleOffered?: () => void;
    onSplitItem?: () => void;
  }) => {
    if (isSelected) {
      const selectedItem = item as SelectedMenuItem;
      const isOffered = selectedItem.offered;

      return (
        <View
          style={[
            styles.itemCard,
            styles.selectedItemCard,
            isOffered && styles.offeredItemCard,
          ]}
        >
          <View style={styles.selectedItemRow}>
            <View style={styles.leftContent}>
              <View style={styles.itemNameRow}>
                {isOffered && <Gift size={16} color="#FF9800" />}
                {selectedItem.isSplit && <Users size={16} color="#9C27B0" />}
                <Text
                  style={[styles.itemName, isOffered && styles.offeredItemText]}
                >
                  {selectedItem.name} {isOffered ? '(Offert)' : ''}
                  {selectedItem.isSplit &&
                    selectedItem.splitInfo &&
                    ` (${selectedItem.splitInfo.splitParts} parts)`}
                </Text>
              </View>
              <View style={styles.quantityControl}>
                <Pressable
                  style={styles.quantityButton}
                  onPress={() => onQuantityChange?.(false)}
                >
                  <Minus size={16} color="#666" />
                </Pressable>
                <Text style={styles.quantityValue}>
                  {selectedItem.selectedQuantity}
                </Text>
                <Pressable
                  style={styles.quantityButton}
                  onPress={() => onQuantityChange?.(true)}
                >
                  <Plus size={16} color="#666" />
                </Pressable>
              </View>
            </View>

            <View style={styles.rightContent}>
              <Text
                style={[styles.subtotalText, isOffered && styles.offeredPrice]}
              >
                {(selectedItem.price * selectedItem.selectedQuantity).toFixed(
                  2
                )}{' '}
                €
              </Text>
              <View style={styles.actionButtons}>
                <Pressable
                  style={styles.removeButton}
                  onPress={onRemoveCompletely}
                >
                  <Text style={styles.removeButtonText}>Retirer</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.offerButton,
                    isOffered && styles.cancelOfferButton,
                  ]}
                  onPress={onToggleOffered}
                >
                  <Text
                    style={[
                      styles.offerButtonText,
                      isOffered && styles.cancelOfferButtonText,
                    ]}
                  >
                    {isOffered ? 'Annuler offre' : 'Offrir'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      );
    }

    // Affichage pour article non sélectionné
    const isOffered = item.offered;

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <View style={styles.itemNameRow}>
            {isOffered && <Gift size={16} color="#FF9800" />}
            {item.isSplit && <Users size={16} color="#9C27B0" />}
            <Text
              style={[styles.itemName, isOffered && styles.offeredItemText]}
            >
              {item.name} {isOffered ? '(Offert)' : ''}
              {item.isSplit &&
                item.splitInfo &&
                ` (${item.splitInfo.splitParts} parts)`}
            </Text>
          </View>
          <Text style={[styles.itemPrice, isOffered && styles.offeredPrice]}>
            {item.price.toFixed(2)} €
            {item.isSplit && item.splitInfo && (
              <Text style={styles.originalPriceText}>
                {' '}
                (origine: {item.splitInfo.pricePerPart.toFixed(2)}€)
              </Text>
            )}
          </Text>
        </View>

        <View style={styles.itemActions}>
          <Text style={styles.quantityText}>Quantité: {item.quantity}</Text>

          <View style={styles.actionButtons}>
            {/* Bouton pour diviser l'article */}
            {!item.isSplit && (
              <Pressable style={styles.splitButton} onPress={onSplitItem}>
                <Users size={16} color="white" />
                <Text style={styles.splitButtonText}>Diviser</Text>
              </Pressable>
            )}

            {item.quantity > 1 && (
              <Pressable
                style={[styles.addButton, styles.addAllButton]}
                onPress={() => onAdd?.(true)}
              >
                <ShoppingCart size={18} color="white" />
                <Text style={styles.addButtonText}>Tout</Text>
              </Pressable>
            )}
            <Pressable style={styles.addButton} onPress={() => onAdd?.(false)}>
              <Plus size={18} color="white" />
              <Text style={styles.addButtonText}>Ajouter</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
);

export default function ItemsPaymentScreen() {
  const { tableId } = useLocalSearchParams();
  const router = useRouter();
  const tableIdNum = parseInt(tableId as string, 10);
  const toast = useToast();
  const { refreshTables } = useTableContext();

  const [table, setTable] = useState<any>(null);
  const [availableItems, setAvailableItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedMenuItem[]>([]);
  const [tableName, setTableName] = useState('');
  const [tableSection, setTableSection] = useState('');
  const [processing, setProcessing] = useState(false);
  const [allOriginalItems, setAllOriginalItems] = useState<MenuItem[]>([]);
  const [totalOffered, setTotalOffered] = useState(0);
  const { paymentMethods } = useSettings();
  const enabledMethods = paymentMethods.filter((method) => method.enabled);

  // États pour la modal de division
  const [completelyDividedItems, setCompletelyDividedItems] = useState<
    Set<number>
  >(new Set());
  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [itemToSplit, setItemToSplit] = useState<MenuItem | null>(null);

  // Mémoïzation des calculs de total
  const totalOrder = useMemo(() => {
    return (
      availableItems.reduce((sum, item) => sum + item.total, 0) +
      selectedItems.reduce((sum, item) => {
        if (!item.offered) {
          return sum + item.price * item.selectedQuantity;
        }
        return sum;
      }, 0)
    );
  }, [availableItems, selectedItems]);

  // Calcul du total des articles sélectionnés (excluant les articles offerts)
  const totalSelected = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      if (!item.offered) {
        return sum + item.price * item.selectedQuantity;
      }
      return sum;
    }, 0);
  }, [selectedItems]);

  // Calculer le total des articles offerts
  const offeredSelected = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      if (item.offered) {
        return sum + item.price * item.selectedQuantity;
      }
      return sum;
    }, 0);
  }, [selectedItems]);

  // Fonction pour ouvrir la modal de division
  const handleSplitItem = useCallback((item: MenuItem) => {
    setItemToSplit(item);
    setSplitModalVisible(true);
  }, []);

  // Fonction pour confirmer la division d'un article
  const handleConfirmSplit = useCallback(
    (quantityToSplit: number, splitParts: number) => {
      if (!itemToSplit) return;

      const pricePerPart = itemToSplit.price / splitParts;

      // Créer plusieurs articles divisés basés sur la quantité sélectionnée
      const splitItems: MenuItem[] = [];
      const totalPartsToCreate = quantityToSplit * splitParts;

      for (let i = 0; i < totalPartsToCreate; i++) {
        splitItems.push({
          id: itemToSplit.id + (i + 1) * 0.001, // ID unique pour chaque part
          name: itemToSplit.name,
          quantity: 1,
          price: pricePerPart,
          total: pricePerPart,
          notes: itemToSplit.notes,
          offered: false,
          isSplit: true,
          splitInfo: {
            originalQuantity: quantityToSplit,
            splitParts: splitParts,
            pricePerPart: itemToSplit.price, // Prix original avant division
          },
        });
      }

      // Mettre à jour les articles disponibles
      setAvailableItems((prevItems) => {
        const updatedItems = prevItems
          .map((item) => {
            if (item.id === itemToSplit.id) {
              const remainingQuantity = item.quantity - quantityToSplit;
              if (remainingQuantity <= 0) {
                // NOUVEAU : Marquer l'article comme complètement divisé s'il n'en reste plus
                setCompletelyDividedItems(
                  (prev) => new Set([...prev, Math.floor(item.id)])
                );
                return null; // Sera filtré
              }
              return {
                ...item,
                quantity: remainingQuantity,
                total: item.price * remainingQuantity,
              };
            }
            return item;
          })
          .filter((item): item is MenuItem => item !== null);

        return [...updatedItems, ...splitItems];
      });

      toast.showToast(
        `${quantityToSplit} article(s) "${itemToSplit.name}" divisé(s) en ${totalPartsToCreate} parts`,
        'success'
      );
    },
    [itemToSplit, toast]
  );

  // Fonction pour basculer l'état offert d'un article
  const toggleItemOffered = useCallback((itemId: number) => {
    setSelectedItems((prevItems) => {
      return prevItems.map((item) => {
        if (item.id === itemId) {
          return { ...item, offered: !item.offered };
        }
        return item;
      });
    });
  }, []);

  // loadTable avec useCallback
  const loadTable = useCallback(async () => {
    const tableData = await getTable(tableIdNum);
    if (tableData) {
      setTable(tableData);
      setTableName(tableData.name);
      setTableSection(tableData.section);

      if (tableData.order && tableData.order.items) {
        const items = tableData.order.items
          .filter((item: OrderItem) => {
            // NOUVEAU : Exclure les articles qui ont été complètement divisés
            return !completelyDividedItems.has(Math.floor(item.id));
          })
          .map((item: OrderItem) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
            notes: item.notes,
            offered: item.offered,
          }));

        setAvailableItems((prevItems) => {
          // Conserver les articles divisés existants
          const existingSplitItems = prevItems.filter((item) => item.isSplit);
          return [...items, ...existingSplitItems];
        });

        // Garder une copie des articles originaux (sans les articles divisés)
        setAllOriginalItems(items);

        // Calculer le total des articles offerts dans la commande
        const offeredTotal = tableData.order.items.reduce((sum, item) => {
          if (
            item.offered &&
            !completelyDividedItems.has(Math.floor(item.id))
          ) {
            return sum + item.price * item.quantity;
          }
          return sum;
        }, 0);
        setTotalOffered(offeredTotal);
      }
    }
  }, [tableIdNum, completelyDividedItems]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  // Handlers optimisés avec useCallback
  const addItemToSelection = useCallback(
    (item: MenuItem, addAll: boolean = false) => {
      if (item.quantity <= 0) return;

      setAvailableItems((prevAvailableItems) => {
        const updatedAvailableItems = prevAvailableItems
          .map((availItem) => {
            if (availItem.id === item.id) {
              const quantityToAdd = addAll ? availItem.quantity : 1;
              const newQuantity = Math.max(
                0,
                availItem.quantity - quantityToAdd
              );

              // Si c'est un article divisé et qu'il n'y a plus de quantité, on le supprime complètement
              if (newQuantity <= 0) {
                return null;
              }

              return {
                ...availItem,
                quantity: newQuantity,
                total: availItem.price * newQuantity,
              };
            }
            return availItem;
          })
          .filter((availItem): availItem is MenuItem => availItem !== null);

        return updatedAvailableItems;
      });

      setSelectedItems((prevSelectedItems) => {
        const quantityToAdd = addAll ? item.quantity : 1;
        const existingIndex = prevSelectedItems.findIndex(
          (selected) => selected.id === item.id
        );

        if (existingIndex >= 0) {
          const updatedSelectedItems = [...prevSelectedItems];
          const currentItem = updatedSelectedItems[existingIndex];
          updatedSelectedItems[existingIndex] = {
            ...currentItem,
            selectedQuantity: currentItem.selectedQuantity + quantityToAdd,
            offered: currentItem.offered,
          };
          return updatedSelectedItems;
        } else {
          const newSelectedItem: SelectedMenuItem = {
            ...item,
            id: item.id,
            uniqueKey: `${item.id}-${Date.now()}`,
            selectedQuantity: quantityToAdd,
            offered: item.offered,
            // Conserver les propriétés de division si elles existent
            isSplit: item.isSplit,
            splitInfo: item.splitInfo,
          };
          return [...prevSelectedItems, newSelectedItem];
        }
      });
    },
    []
  );

  const removeItemCompletely = useCallback(
    (itemId: number) => {
      const itemToRemove = selectedItems.find((item) => item.id === itemId);
      if (!itemToRemove) return;

      setSelectedItems((prevSelectedItems) => {
        return prevSelectedItems.filter((item) => item.id !== itemId);
      });

      // Restaurer l'article dans les disponibles
      setAvailableItems((prevAvailableItems) => {
        // Si c'est un article divisé, on le remet tel quel
        if (itemToRemove.isSplit) {
          return [
            ...prevAvailableItems,
            {
              id: itemToRemove.id,
              name: itemToRemove.name,
              quantity: itemToRemove.selectedQuantity,
              price: itemToRemove.price,
              total: itemToRemove.price * itemToRemove.selectedQuantity,
              notes: itemToRemove.notes,
              offered: itemToRemove.offered,
              isSplit: itemToRemove.isSplit,
              splitInfo: itemToRemove.splitInfo,
            },
          ];
        }

        // Pour un article normal, chercher s'il existe déjà
        const existingItemIndex = prevAvailableItems.findIndex(
          (item) => item.id === itemId && !item.isSplit
        );

        if (existingItemIndex >= 0) {
          const updatedAvailableItems = [...prevAvailableItems];
          const availableItem = updatedAvailableItems[existingItemIndex];
          updatedAvailableItems[existingItemIndex] = {
            ...availableItem,
            quantity: availableItem.quantity + itemToRemove.selectedQuantity,
            total:
              availableItem.price *
              (availableItem.quantity + itemToRemove.selectedQuantity),
            offered: itemToRemove.offered,
          };
          return updatedAvailableItems;
        } else {
          const originalItem = allOriginalItems.find(
            (item) => Math.floor(item.id) === Math.floor(itemId)
          );
          if (originalItem) {
            return [
              ...prevAvailableItems,
              {
                id: originalItem.id,
                name: originalItem.name,
                quantity: itemToRemove.selectedQuantity,
                price: originalItem.price,
                total: originalItem.price * itemToRemove.selectedQuantity,
                notes: originalItem.notes,
                offered: itemToRemove.offered,
              },
            ];
          }
          return prevAvailableItems;
        }
      });
    },
    [selectedItems, allOriginalItems]
  );

  const updateAvailableItemsQuantity = useCallback(
    (itemId: number, change: number) => {
      setAvailableItems((prevItems) => {
        // Pour les articles divisés, on les traite individuellement
        const targetItem = prevItems.find((item) => item.id === itemId);
        if (targetItem?.isSplit) {
          if (change > 0) {
            // Ajouter une part divisée
            return [
              ...prevItems,
              {
                ...targetItem,
                quantity: Math.abs(change),
                total: targetItem.price * Math.abs(change),
              },
            ];
          } else {
            // Retirer une part divisée (ne devrait pas arriver normalement)
            return prevItems.filter((item) => item.id !== itemId);
          }
        }

        // Logique normale pour les articles non divisés
        const existingItemIndex = prevItems.findIndex(
          (item) => item.id === itemId && !item.isSplit
        );

        if (existingItemIndex >= 0) {
          const updatedItems = [...prevItems];
          const item = updatedItems[existingItemIndex];
          const newQuantity = item.quantity + change;

          if (newQuantity <= 0) {
            updatedItems.splice(existingItemIndex, 1);
            return updatedItems;
          }

          updatedItems[existingItemIndex] = {
            ...item,
            quantity: newQuantity,
            total: item.price * newQuantity,
          };

          return updatedItems;
        } else {
          const originalItem = allOriginalItems.find(
            (item) => Math.floor(item.id) === Math.floor(itemId)
          );
          if (originalItem && change > 0) {
            return [
              ...prevItems,
              {
                id: originalItem.id,
                name: originalItem.name,
                quantity: change,
                price: originalItem.price,
                total: originalItem.price * change,
                notes: originalItem.notes,
                offered: originalItem.offered,
              },
            ];
          }
        }

        return prevItems;
      });
    },
    [allOriginalItems]
  );

  const handleSelectedItemQuantityChange = useCallback(
    (itemId: number, increment: boolean) => {
      setSelectedItems((prevSelectedItems) => {
        return prevSelectedItems
          .map((item) => {
            if (item.id === itemId) {
              const currentQuantity = item.selectedQuantity;
              const newQuantity = increment
                ? currentQuantity + 1
                : Math.max(0, currentQuantity - 1);

              if (newQuantity === 0) {
                // Si l'article divisé retourne à 0, on le remet dans les disponibles
                if (item.isSplit) {
                  updateAvailableItemsQuantity(itemId, 1);
                } else {
                  updateAvailableItemsQuantity(itemId, 1);
                }
                return null;
              }

              return {
                ...item,
                selectedQuantity: newQuantity,
              };
            }
            return item;
          })
          .filter((item): item is SelectedMenuItem => item !== null);
      });

      // Gérer les changements dans les articles disponibles
      if (!increment) {
        const itemToCheck = selectedItems.find((item) => item.id === itemId);
        if ((itemToCheck?.selectedQuantity ?? 0) > 1) {
          updateAvailableItemsQuantity(itemId, 1);
        }
      } else {
        updateAvailableItemsQuantity(itemId, -1);
      }
    },
    [selectedItems, updateAvailableItemsQuantity]
  );

  const handlePayment = useCallback(
    async (method: 'card' | 'cash' | 'check') => {
      if (selectedItems.length === 0) {
        toast.showToast(
          'Veuillez sélectionner au moins un article à payer.',
          'warning'
        );
        return;
      }

      setProcessing(true);

      try {
        const currentTable = await getTable(tableIdNum);
        if (!currentTable || !currentTable.order) {
          toast.showToast(
            'Impossible de récupérer les informations de la table',
            'error'
          );
          setProcessing(false);
          return;
        }

        const paidItems = selectedItems.map((item) => {
          const originalItem = allOriginalItems.find(
            (origItem) =>
              origItem.name === item.name && origItem.price === item.price
          );

          return {
            id: originalItem ? originalItem.id : item.id,
            name: item.name,
            quantity: item.selectedQuantity,
            price: item.price,
            offered: item.offered,
            isSplit: item.isSplit,
            splitInfo: item.splitInfo,
          };
        });

        const offeredAmount = paidItems.reduce((sum, item) => {
          return item.offered ? sum + item.price * item.quantity : sum;
        }, 0);

        const bill = {
          id: Date.now(),
          tableNumber: tableIdNum,
          tableName: tableName,
          section: tableSection,
          amount: totalSelected,
          items: paidItems.length,
          status: 'paid' as 'paid',
          timestamp: new Date().toISOString(),
          paymentMethod: method,
          paymentType: 'items' as any,
          paidItems: paidItems,
          offeredAmount: offeredAmount,
          guests: table.guests,
        };

        await addBill(bill);

        // Préserver les articles divisés non payés AVANT le rechargement
        const unpaidSplitItems = availableItems.filter(
          (item) =>
            item.isSplit &&
            !selectedItems.some((selected) => selected.id === item.id)
        );

        let updatedOrderItems = [...currentTable.order.items];

        for (const selectedItem of selectedItems) {
          if (selectedItem.isSplit) {
            // Pour les articles divisés, on ne touche PAS à la commande originale
            continue;
          }

          const originalItem = allOriginalItems.find(
            (origItem) =>
              origItem.name === selectedItem.name &&
              Math.floor(origItem.id) === Math.floor(selectedItem.id)
          );

          const itemIdToFind = originalItem ? originalItem.id : selectedItem.id;
          const orderItemIndex = updatedOrderItems.findIndex(
            (item) => Math.floor(item.id) === Math.floor(itemIdToFind)
          );

          if (orderItemIndex >= 0) {
            const orderItem = updatedOrderItems[orderItemIndex];
            const remainingQuantity =
              orderItem.quantity - selectedItem.selectedQuantity;

            if (remainingQuantity <= 0) {
              updatedOrderItems.splice(orderItemIndex, 1);
            } else {
              updatedOrderItems[orderItemIndex] = {
                ...orderItem,
                quantity: remainingQuantity,
                offered: orderItem.offered,
              };
            }
          }
        }

        const newTotal = updatedOrderItems.reduce((sum, item) => {
          if (!item.offered) {
            return sum + item.price * item.quantity;
          }
          return sum;
        }, 0);

        const unpaidSplitTotal = unpaidSplitItems.reduce((sum, item) => {
          if (!item.offered) {
            return sum + item.price * item.quantity;
          }
          return sum;
        }, 0);

        const totalWithUnpaidSplits = newTotal + unpaidSplitTotal;

        if (updatedOrderItems.length === 0 && unpaidSplitItems.length === 0) {
          await resetTable(tableIdNum);
          // Réinitialiser aussi le tracking des articles divisés
          setCompletelyDividedItems(new Set());

          let verificationAttempts = 0;
          let tableClean = false;

          while (!tableClean && verificationAttempts < 3) {
            const checkTable = await getTable(tableIdNum);

            if (!checkTable || (!checkTable.order && !checkTable.guests)) {
              tableClean = true;
              break;
            }

            const forcedCleanTable = {
              ...checkTable,
              status: 'available' as 'available',
              guests: undefined,
              order: undefined,
            };

            await updateTable(forcedCleanTable);
            verificationAttempts++;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }

          await refreshTables();
          router.replace('/');
          toast.showToast('Tous les articles ont été payés.', 'success');
        } else {
          const updatedTable = {
            ...currentTable,
            order: {
              ...currentTable.order,
              items: updatedOrderItems,
              total: totalWithUnpaidSplits,
            },
          };

          await updateTable(updatedTable);

          // Sauvegarder les articles divisés avant le rechargement
          const splitItemsToPreserve = [...unpaidSplitItems];

          await refreshTables();
          setSelectedItems([]);

          // Recharger SANS les articles divisés préservés (ils seront rajoutés après)
          await loadTable();

          // Remettre les articles divisés préservés
          if (splitItemsToPreserve.length > 0) {
            setAvailableItems((prevItems) => {
              return [...prevItems, ...splitItemsToPreserve];
            });
          }

          toast.showToast(
            `Articles payés: ${totalSelected.toFixed(
              2
            )}€\nRestant à payer: ${totalWithUnpaidSplits.toFixed(2)}€`,
            'success'
          );
        }
      } catch (error) {
        console.error('Erreur lors du paiement:', error);
        toast.showToast(
          'Une erreur est survenue lors du traitement du paiement.',
          'error'
        );
      } finally {
        setProcessing(false);
      }
    },
    [
      selectedItems,
      totalSelected,
      tableIdNum,
      tableName,
      tableSection,
      loadTable,
      router,
      allOriginalItems,
      refreshTables,
      availableItems,
      toast,
      table,
    ]
  );

  // Handler pour le backButton avec useCallback
  const handleBack = useCallback(() => {
    if (selectedItems.length > 0) {
      Alert.alert(
        'Articles en attente de paiement',
        "Attention, vous avez des articles sélectionnés qui n'ont pas été payés. Voulez-vous vraiment quitter cette page?",
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text: 'Quitter quand même',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  }, [selectedItems, router]);

  // Fonction pour déplacer tous les articles disponibles vers les articles sélectionnés
  const moveAllToSelected = useCallback(() => {
    setSelectedItems((prevSelectedItems) => {
      const newSelectedItems = availableItems.map((item) => ({
        ...item,
        selectedQuantity: item.quantity,
        offered: item.offered,
      }));
      return [...prevSelectedItems, ...newSelectedItems];
    });
    setAvailableItems([]);
  }, [availableItems]);

  // Fonction pour déplacer tous les articles sélectionnés vers les articles disponibles
  const moveAllToAvailable = useCallback(() => {
    setAvailableItems((prevAvailableItems) => {
      const newAvailableItems = selectedItems.map((item) => ({
        ...item,
        quantity: item.selectedQuantity,
        total: item.price * item.selectedQuantity,
        offered: item.offered,
      }));
      return [...prevAvailableItems, ...newAvailableItems];
    });
    setSelectedItems([]);
  }, [selectedItems]);

  if (!table) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement des informations de la table...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={24} color="#333" />
          </Pressable>
          <View style={styles.titleContainer}>
            <View>
              <Text style={styles.title}>
                Paiement par article - {tableName}
              </Text>
              {tableSection && (
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionText}>{tableSection}</Text>
                </View>
              )}
            </View>

            {/* Résumé déplacé ici */}
            <View style={styles.inlineSummary}>
              <Text style={styles.inlineSummaryText}>
                Total: {totalOrder.toFixed(2)}€ | Sélectionnés:{' '}
                {totalSelected.toFixed(2)}€
              </Text>
            </View>
          </View>
          {selectedItems.length > 0 && (
            <View style={styles.warningBadge}>
              <Text style={styles.warningText}>
                {selectedItems.length} article(s) en attente
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.columnsContainer}>
        {/* Colonne de gauche - Articles disponibles */}
        <View style={styles.column}>
          <View style={styles.columnHeader}>
            <Text style={styles.columnTitle}>Articles disponibles</Text>
            <ShoppingCart size={20} color="#666" />
          </View>

          {availableItems.length === 0 ? (
            <Text style={styles.emptyText}>
              Tous les articles ont été sélectionnés
            </Text>
          ) : (
            <View style={styles.doubleColumnLayout}>
              {/* Colonne Plats */}
              <View style={styles.subColumn}>
                <Text style={styles.subColumnTitle}>Plats</Text>
                <ScrollView style={styles.itemsList}>
                  {categorizeItems(availableItems).plat.map((item) => (
                    <ItemCard
                      key={
                        item.uniqueKey ||
                        `available-plat-${item.id}-${Math.random()}`
                      }
                      item={item}
                      isSelected={false}
                      onAdd={(addAll) => addItemToSelection(item, addAll)}
                      onSplitItem={() => handleSplitItem(item)}
                    />
                  ))}
                </ScrollView>
              </View>

              {/* Colonne Boissons */}
              <View style={styles.subColumn}>
                <Text style={styles.subColumnTitle}>Boissons</Text>
                <ScrollView style={styles.itemsList}>
                  {categorizeItems(availableItems).boisson.map((item) => (
                    <ItemCard
                      key={
                        item.uniqueKey ||
                        `available-boisson-${item.id}-${Math.random()}`
                      }
                      item={item}
                      isSelected={false}
                      onAdd={(addAll) => addItemToSelection(item, addAll)}
                      onSplitItem={() => handleSplitItem(item)}
                    />
                  ))}
                </ScrollView>
              </View>
            </View>
          )}
        </View>

        {/* Colonne de droite - Articles sélectionnés */}
        <View style={styles.column}>
          <View style={styles.columnHeader}>
            <Text style={styles.columnTitle}>Articles sélectionnés</Text>
            <ShoppingCart size={20} color="#4CAF50" />
          </View>

          {selectedItems.length === 0 ? (
            <Text style={styles.emptyText}>Aucun article sélectionné</Text>
          ) : (
            <View style={styles.doubleColumnLayout}>
              <View style={styles.subColumn}>
                <Text style={styles.subColumnTitle}>Plats</Text>
                <ScrollView style={styles.itemsList}>
                  {categorizeItems(selectedItems).plat.map((item) => (
                    <ItemCard
                      key={`selected-plat-${item.uniqueKey}`}
                      item={item}
                      isSelected={true}
                      onQuantityChange={(increment) =>
                        handleSelectedItemQuantityChange(item.id, increment)
                      }
                      onRemoveCompletely={() => removeItemCompletely(item.id)}
                      onToggleOffered={() => toggleItemOffered(item.id)}
                    />
                  ))}
                </ScrollView>
              </View>
              <View style={styles.subColumn}>
                <Text style={styles.subColumnTitle}>Boissons</Text>
                <ScrollView style={styles.itemsList}>
                  {categorizeItems(selectedItems).boisson.map((item) => (
                    <ItemCard
                      key={`selected-boisson-${item.uniqueKey}`}
                      item={item}
                      isSelected={true}
                      onQuantityChange={(increment) =>
                        handleSelectedItemQuantityChange(item.id, increment)
                      }
                      onRemoveCompletely={() => removeItemCompletely(item.id)}
                      onToggleOffered={() => toggleItemOffered(item.id)}
                    />
                  ))}
                </ScrollView>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Boutons pour déplacer tous les articles */}
      <View style={styles.moveAllButtonsContainer}>
        <Pressable
          style={[styles.moveAllButton, { backgroundColor: '#4CAF50' }]}
          onPress={moveAllToSelected}
        >
          <Text style={styles.moveAllButtonText}>Payer tout</Text>
        </Pressable>
        <Pressable
          style={[styles.moveAllButton, { backgroundColor: '#F44336' }]}
          onPress={moveAllToAvailable}
        >
          <Text style={styles.moveAllButtonText}>Enlever tout</Text>
        </Pressable>
      </View>

      <View style={styles.paymentMethods}>
        <Text style={styles.paymentTitle}>Méthode de paiement</Text>

        <View style={styles.paymentButtons}>
          {enabledMethods.map((method) => (
            <Pressable
              key={method.id}
              style={[
                styles.paymentButton,
                { backgroundColor: getMethodColor(method.id) },
              ]}
              onPress={() =>
                handlePayment(method.id as 'cash' | 'check' | 'card')
              }
              disabled={processing || selectedItems.length === 0}
            >
              {getMethodIcon(method.id)}
              <Text style={styles.paymentButtonText}>{method.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Modal pour diviser un article */}
      <SplitItemModal
        visible={splitModalVisible}
        item={itemToSplit}
        onClose={() => {
          setSplitModalVisible(false);
          setItemToSplit(null);
        }}
        onConfirm={handleConfirmSplit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 8,
  },
  headerTop: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    // marginRight supprimé car maintenant géré par titleContainer
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 4,
  },
  sectionText: {
    color: '#0288D1',
    fontWeight: '600',
    fontSize: 12,
  },
  warningBadge: {
    backgroundColor: '#FFF9C4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  warningText: {
    color: '#F57F17',
    fontWeight: '600',
    fontSize: 12,
  },
  summaryCard: {
    backgroundColor: '#f8f9fa',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  selectedAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  offeredRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#FFD54F',
    borderStyle: 'dashed',
  },
  offeredLabel: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '500',
  },
  offeredAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  columnsContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 8,
    gap: 8,
  },
  column: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  columnTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  doubleColumnLayout: {
    flexDirection: 'row',
    flex: 1,
  },
  subColumn: {
    flex: 1,
    borderRightWidth: 1,
    borderColor: '#e0e0e0',
  },
  subColumnTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    padding: 6,
    backgroundColor: '#f5f5f5',
    textAlign: 'center',
  },
  itemsList: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
    fontStyle: 'italic',
  },
  itemCard: {
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedItemCard: {
    backgroundColor: '#f9fff9',
  },
  offeredItemCard: {
    backgroundColor: '#FFF8E1',
    borderLeftWidth: 2,
    borderLeftColor: '#FF9800',
  },
  offeredItemText: {
    fontStyle: 'italic',
    color: '#FF9800',
  },
  offeredPrice: {
    textDecorationLine: 'line-through',
    color: '#FF9800',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: '60%',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
  },
  originalPriceText: {
    fontSize: 10,
    color: '#666',
    fontWeight: 'normal',
  },
  selectedItemPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  quantityText: {
    fontSize: 13,
    color: '#666',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  addAllButton: {
    backgroundColor: '#2196F3',
  },
  splitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9C27B0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  splitButtonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 11,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 11,
  },
  selectedItemDetails: {
    gap: 3,
  },
  selectedItemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  quantityButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityValue: {
    width: 24,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  subtotalText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  removeButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
  },
  removeButtonText: {
    fontSize: 10,
    color: '#F44336',
  },
  offerButton: {
    padding: 4,
    marginLeft: 4,
    borderRadius: 4,
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  offerButtonText: {
    fontSize: 10,
    color: '#FF9800',
  },
  cancelOfferButton: {
    backgroundColor: '#FFECB3',
  },
  cancelOfferButtonText: {
    fontWeight: '500',
  },
  paymentMethods: {
    backgroundColor: 'white',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  paymentButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 4,
    gap: 6,
  },
  paymentButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  moveAllButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  moveAllButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  moveAllButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  selectedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftContent: {
    flex: 1,
    marginRight: 8,
  },
  rightContent: {
    alignItems: 'flex-end',
  },
  // Styles pour la modal de division
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    minWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  itemPreview: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
  },
  itemPreviewName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemPreviewPrice: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  itemPreviewQuantity: {
    fontSize: 14,
    color: '#666',
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  calculationContainer: {
    backgroundColor: '#F1F8E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  calculationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 4,
  },
  calculationSubText: {
    fontSize: 14,
    color: '#2E7D32',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  modalConfirmButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#9C27B0',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  inlineSummary: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  inlineSummaryText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'right',
  },
});
