import { useSettings } from '@/utils/useSettings';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  CreditCard,
  Edit3,
  Gift, // Ajout de l'icône Gift
  Minus,
  Plus,
  ShoppingCart,
  Wallet,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EVENT_TYPES, events } from '../../utils/events';
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
  offered?: boolean; // Ajout de la propriété offered
}

interface SelectedMenuItem extends MenuItem {
  selectedQuantity: number;
  offered?: boolean;
  uniqueKey?: string;
}

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

// Fonction pour catégoriser les items
const getCategoryFromName = (name: string): 'plat' | 'boisson' => {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('glace')) return 'boisson';
  if (lowerName.includes('thé') || lowerName.includes('café')) return 'boisson';
  if (
    lowerName.includes('bière') ||
    lowerName.includes('blonde') ||
    lowerName.includes('ambree')
  )
    return 'boisson';
  if (
    lowerName.includes('vin') ||
    lowerName.includes('pichet') ||
    lowerName.includes('btl')
  )
    return 'boisson';
  if (
    lowerName.includes('apero') ||
    lowerName.includes('digestif') ||
    lowerName.includes('ricard') ||
    lowerName.includes('alcool') ||
    lowerName.includes('punch') ||
    lowerName.includes('cocktail')
  )
    return 'boisson';
  if (
    lowerName.includes('boisson') ||
    lowerName.includes('soft') ||
    lowerName.includes('soda')
  )
    return 'boisson';

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

// Composant ItemCard optimisé avec React.memo
const ItemCard = memo(
  ({
    item,
    isSelected,
    onAdd,
    onQuantityChange,
    onRemoveCompletely,
    onToggleOffered,
  }: {
    item: MenuItem | SelectedMenuItem;
    isSelected: boolean;
    onAdd?: (addAll?: boolean) => void;
    onQuantityChange?: (increment: boolean) => void;
    onRemoveCompletely?: () => void;
    onToggleOffered?: () => void;
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
                {isOffered && <Gift size={14} color="#FF9800" />}
                <Text
                  style={[styles.itemName, isOffered && styles.offeredItemText]}
                >
                  {selectedItem.name} {isOffered ? '(Offert)' : ''}
                </Text>
              </View>
              <View style={styles.quantityControl}>
                <Pressable
                  style={styles.quantityButton}
                  onPress={() => onQuantityChange?.(false)}
                >
                  <Minus size={14} color="#666" />
                </Pressable>
                <Text style={styles.quantityValue}>
                  {selectedItem.selectedQuantity}
                </Text>
                <Pressable
                  style={styles.quantityButton}
                  onPress={() => onQuantityChange?.(true)}
                >
                  <Plus size={14} color="#666" />
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
            {isOffered && <Gift size={14} color="#FF9800" />}
            <Text
              style={[styles.itemName, isOffered && styles.offeredItemText]}
            >
              {item.name} {isOffered ? '(Offert)' : ''}
            </Text>
          </View>
          <Text style={[styles.itemPrice, isOffered && styles.offeredPrice]}>
            {item.price.toFixed(2)} €
          </Text>
        </View>

        <View style={styles.itemActions}>
          <Text style={styles.quantityText}>Quantité: {item.quantity}</Text>

          <View style={styles.actionButtons}>
            <Pressable style={styles.addButton} onPress={() => onAdd?.(false)}>
              <Plus size={16} color="white" />
              <Text style={styles.addButtonText}>Ajouter</Text>
            </Pressable>

            {item.quantity > 1 && (
              <Pressable
                style={[styles.addButton, styles.addAllButton]}
                onPress={() => onAdd?.(true)}
              >
                <ShoppingCart size={16} color="white" />
                <Text style={styles.addButtonText}>Tout</Text>
              </Pressable>
            )}
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

  const [table, setTable] = useState<any>(null);
  const [availableItems, setAvailableItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedMenuItem[]>([]);
  const [tableName, setTableName] = useState('');
  const [tableSection, setTableSection] = useState('');
  const [processing, setProcessing] = useState(false);
  const [allOriginalItems, setAllOriginalItems] = useState<MenuItem[]>([]);
  const [totalOffered, setTotalOffered] = useState(0); // Ajout de l'état pour les articles offerts
  const { paymentMethods } = useSettings();
  const enabledMethods = paymentMethods.filter((method) => method.enabled);

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
        const items = tableData.order.items.map((item: OrderItem) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
          notes: item.notes,
          offered: item.offered, // Préserver l'état offert
        }));
        setAvailableItems(items);
        setAllOriginalItems(items);

        // Calculer le total des articles offerts dans la commande
        const offeredTotal = tableData.order.items.reduce((sum, item) => {
          if (item.offered) {
            return sum + item.price * item.quantity;
          }
          return sum;
        }, 0);
        setTotalOffered(offeredTotal);
      }
    }
  }, [tableIdNum]);

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
              return {
                ...availItem,
                quantity: newQuantity,
                total: availItem.price * newQuantity,
              };
            }
            return availItem;
          })
          .filter((availItem) => availItem.quantity > 0);

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
          // Correction: Garder l'ID original mais ajouter une propriété originalId
          const newSelectedItem: SelectedMenuItem = {
            ...item,
            // Garder l'ID original
            id: item.id,
            // Ajouter une propriété pour rendre l'item unique dans la liste si nécessaire
            uniqueKey: `${item.id}-${Date.now()}`,
            selectedQuantity: quantityToAdd,
            offered: item.offered,
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
        const existingItemIndex = prevAvailableItems.findIndex(
          (item) => item.id === itemId
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
            offered: itemToRemove.offered, // Préserver l'état offert
          };
          return updatedAvailableItems;
        } else {
          const originalItem = allOriginalItems.find(
            (item) => item.id === itemId
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
                offered: itemToRemove.offered, // Préserver l'état offert
              },
            ];
          }
          return prevAvailableItems;
        }
      });
    },
    [selectedItems, allOriginalItems]
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
                : Math.max(0, currentQuantity - 1); // Permettre 0 au lieu de blocage à 1

              // Si la quantité devient 0, on va supprimer l'item
              if (newQuantity === 0) {
                // On doit restaurer l'item dans les disponibles
                updateAvailableItemsQuantity(itemId, 1);
                return null; // Marquer pour suppression
              }

              return {
                ...item,
                selectedQuantity: newQuantity,
              };
            }
            return item;
          })
          .filter((item): item is SelectedMenuItem => item !== null); // Supprimer les items null avec type guard
      });

      // Si on ne décrémente pas à 0, on met à jour les disponibles normalement
      if (!increment) {
        const itemToCheck = selectedItems.find((item) => item.id === itemId);
        if ((itemToCheck?.selectedQuantity ?? 0) > 1) {
          updateAvailableItemsQuantity(itemId, 1);
        }
      } else {
        updateAvailableItemsQuantity(itemId, -1);
      }
    },
    [selectedItems]
  );

  const updateAvailableItemsQuantity = useCallback(
    (itemId: number, change: number) => {
      setAvailableItems((prevItems) => {
        const existingItemIndex = prevItems.findIndex(
          (item) => item.id === itemId
        );

        if (existingItemIndex >= 0) {
          const updatedItems = [...prevItems];
          const item = updatedItems[existingItemIndex];
          const newQuantity = item.quantity + change;

          updatedItems[existingItemIndex] = {
            ...item,
            quantity: newQuantity,
            total: item.price * newQuantity,
          };

          return updatedItems;
        } else {
          const originalItem = allOriginalItems.find(
            (item) => item.id === itemId
          );
          if (originalItem) {
            return [
              ...prevItems,
              {
                id: originalItem.id,
                name: originalItem.name,
                quantity: change,
                price: originalItem.price,
                total: originalItem.price * change,
                notes: originalItem.notes,
                offered: originalItem.offered, // Préserver l'état offert
              },
            ];
          }
        }

        return prevItems;
      });
    },
    [allOriginalItems]
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

        // Problème 1: Les IDs des articles sélectionnés ne correspondent pas aux IDs originaux
        // Solution: Récupérer les IDs originaux pour les articles sélectionnés
        const paidItems = selectedItems.map((item) => {
          // Trouver l'article original correspondant pour récupérer l'ID correct
          const originalItem = allOriginalItems.find(
            (origItem) =>
              origItem.name === item.name && origItem.price === item.price
          );

          return {
            // Utiliser l'ID original si disponible, sinon garder l'ID actuel
            id: originalItem ? originalItem.id : item.id,
            name: item.name,
            quantity: item.selectedQuantity,
            price: item.price,
            offered: item.offered,
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
        };

        await addBill(bill);

        // Problème 2: La mise à jour des articles de la commande n'utilise pas les bons identifiants
        // Solution: Améliorer la logique de mise à jour des articles dans la commande
        let updatedOrderItems = [...currentTable.order.items];

        for (const selectedItem of selectedItems) {
          // Trouver l'article original correspondant
          const originalItem = allOriginalItems.find(
            (origItem) =>
              origItem.name === selectedItem.name &&
              origItem.price === selectedItem.price
          );

          // Utiliser l'ID original pour chercher dans la commande
          const itemIdToFind = originalItem ? originalItem.id : selectedItem.id;

          // Chercher l'article dans la commande actuelle
          const orderItemIndex = updatedOrderItems.findIndex(
            (item) => item.id === itemIdToFind
          );

          if (orderItemIndex >= 0) {
            const orderItem = updatedOrderItems[orderItemIndex];
            const remainingQuantity =
              orderItem.quantity - selectedItem.selectedQuantity;

            if (remainingQuantity <= 0) {
              // Supprimer complètement l'article
              updatedOrderItems.splice(orderItemIndex, 1);
            } else {
              // Mettre à jour la quantité
              updatedOrderItems[orderItemIndex] = {
                ...orderItem,
                quantity: remainingQuantity,
                offered: orderItem.offered,
              };
            }
          }
        }

        // Calculer le nouveau total en excluant les articles offerts
        const newTotal = updatedOrderItems.reduce((sum, item) => {
          if (!item.offered) {
            return sum + item.price * item.quantity;
          }
          return sum;
        }, 0);

        if (updatedOrderItems.length === 0 || newTotal <= 0) {
          // Table complètement payée, s'assurer qu'elle est correctement fermée
          await resetTable(tableIdNum);

          // Vérification supplémentaire pour s'assurer que la table est bien réinitialisée
          const checkTable = await getTable(tableIdNum);
          if (checkTable && (checkTable.order || checkTable.guests)) {
            console.warn(
              'Table non correctement réinitialisée, forçage du nettoyage'
            );

            // Méthode 1: Réessayer la réinitialisation
            await resetTable(tableIdNum);

            // Méthode 2: Forcer une mise à jour directe si nécessaire
            const verifyReset = await getTable(tableIdNum);
            if (verifyReset && (verifyReset.order || verifyReset.guests)) {
              const forcedCleanTable = {
                ...verifyReset,
                status: 'available' as 'available',
                guests: undefined,
                order: undefined,
              };
              await updateTable(forcedCleanTable);
            }
          }

          // Émettre l'événement pour mettre à jour l'interface
          events.emit(EVENT_TYPES.TABLE_UPDATED, tableIdNum);
          router.push('/');

          toast.showToast('Tous les articles ont été payés.', 'success');
        } else {
          const updatedTable = {
            ...currentTable,
            order: {
              ...currentTable.order,
              items: updatedOrderItems,
              total: newTotal,
            },
          };

          await updateTable(updatedTable);

          // Émettre l'événement pour mettre à jour l'interface
          events.emit(EVENT_TYPES.TABLE_UPDATED, tableIdNum);

          // Problème 3: La liste des articles disponibles n'est pas correctement mise à jour
          // Solution: Vider les articles sélectionnés et recharger complètement la table
          setSelectedItems([]);

          // Recharger complètement les données de la table au lieu de manipuler l'état local
          await loadTable();

          toast.showToast(
            `Articles payés: ${totalSelected.toFixed(
              2
            )}€\nRestant à payer: ${newTotal.toFixed(2)}€`,
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
      allOriginalItems, // Ajout de cette dépendance importante
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
        offered: item.offered, // Préserver l'état offert
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
        offered: item.offered, // Préserver l'état offert
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
        <Pressable style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={24} color="#333" />
        </Pressable>
        <View>
          <Text style={styles.title}>Paiement par article - {tableName}</Text>
          {tableSection && (
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionText}>{tableSection}</Text>
            </View>
          )}
        </View>
        {selectedItems.length > 0 && (
          <View style={styles.warningBadge}>
            <Text style={styles.warningText}>
              {selectedItems.length} article(s) en attente
            </Text>
          </View>
        )}
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total de la commande:</Text>
          <Text style={styles.totalAmount}>{totalOrder.toFixed(2)} €</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Articles sélectionnés:</Text>
          <Text style={styles.selectedAmount}>
            {totalSelected.toFixed(2)} €
          </Text>
        </View>
        {offeredSelected > 0 && (
          <View style={styles.offeredRow}>
            <Text style={styles.offeredLabel}>Articles offerts:</Text>
            <Text style={styles.offeredAmount}>
              {offeredSelected.toFixed(2)} €
            </Text>
          </View>
        )}
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
                      key={item.uniqueKey || `selected-plat-${item.id}`}
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
                      key={item.uniqueKey || `selected-boisson-${item.id}`}
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
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
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
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginLeft: 'auto',
  },
  warningText: {
    color: '#F57F17',
    fontWeight: '600',
    fontSize: 12,
  },
  summaryCard: {
    backgroundColor: 'white',
    margin: 12,
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 16,
    color: '#666',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  selectedAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  // Styles pour les articles offerts
  offeredRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FFD54F',
    borderStyle: 'dashed',
  },
  offeredLabel: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '500',
  },
  offeredAmount: {
    fontSize: 16,
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
  // Styles pour les articles offerts
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
  // Bouton pour offrir/annuler l'offre
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
});
