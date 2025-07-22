// app/payment/items.tsx - VERSION AMÉLIORÉE AVEC DIVISION D'ARTICLES FONCTIONNELLE
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
  Users,
  Trash2,
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

interface DividedItem {
  id: string;
  originalId: number;
  name: string;
  price: number;
  originalPrice: number;
  quantity: number;
  notes?: string;
  offered?: boolean;
  partNumber: number;
  totalParts: number;
  isDivided: true;
}

interface MenuItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  total: number;
  notes?: string;
  offered?: boolean;
}

interface SelectedMenuItem extends MenuItem {
  selectedQuantity: number;
  offered?: boolean;
  uniqueKey?: string;
  isDivided?: boolean;
  partInfo?: {
    partNumber: number;
    totalParts: number;
    originalPrice: number;
  };
}

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
    onConfirm: (quantityToDivide: number, numberOfParts: number) => void;
  }) => {
    const [quantityToDivide, setQuantityToDivide] = useState('1');
    const [numberOfParts, setNumberOfParts] = useState('2');
    const [error, setError] = useState('');

    useEffect(() => {
      if (visible && item) {
        setQuantityToDivide('1');
        setNumberOfParts('2');
        setError('');
      }
    }, [visible, item]);

    const handleConfirm = useCallback(() => {
      if (!item) return;
      const qtyToDivide = parseInt(quantityToDivide);
      const parts = parseInt(numberOfParts);

      if (isNaN(qtyToDivide) || qtyToDivide < 1) {
        setError('La quantité doit être au moins 1');
        return;
      }
      if (qtyToDivide > item.quantity) {
        setError(`Maximum ${item.quantity} disponible`);
        return;
      }
      if (isNaN(parts) || parts < 2) {
        setError('Il faut au moins 2 parts');
        return;
      }
      if (parts > 10) {
        setError('Maximum 10 parts autorisées');
        return;
      }

      onConfirm(qtyToDivide, parts);
      onClose();
    }, [item, quantityToDivide, numberOfParts, onConfirm, onClose]);

    if (!item) return null;

    const qtyToDivide = parseInt(quantityToDivide) || 1;
    const parts = parseInt(numberOfParts) || 2;
    const pricePerPart = item.price / parts;
    const totalPartsCreated = qtyToDivide * parts;

    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Diviser l'article</Text>
            <View style={styles.itemPreview}>
              <Text style={styles.itemPreviewName}>{item.name}</Text>
              <Text style={styles.itemPreviewPrice}>
                Prix unitaire: {item.price.toFixed(2)} €
              </Text>
              <Text style={styles.itemPreviewQuantity}>
                Disponible: {item.quantity}
              </Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Quantité à diviser:</Text>
              <View style={styles.quantitySelector}>
                <Pressable
                  style={styles.quantityBtn}
                  onPress={() =>
                    setQuantityToDivide(Math.max(1, qtyToDivide - 1).toString())
                  }
                >
                  <Minus size={16} color="#666" />
                </Pressable>
                <TextInput
                  style={styles.quantityInput}
                  value={quantityToDivide}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 1;
                    if (num <= item.quantity) {
                      setQuantityToDivide(text);
                      setError('');
                    }
                  }}
                  keyboardType="numeric"
                />
                <Pressable
                  style={styles.quantityBtn}
                  onPress={() => {
                    const newQty = Math.min(item.quantity, qtyToDivide + 1);
                    setQuantityToDivide(newQty.toString());
                  }}
                >
                  <Plus size={16} color="#666" />
                </Pressable>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Diviser en combien de parts:
              </Text>
              <View style={styles.quantitySelector}>
                <Pressable
                  style={styles.quantityBtn}
                  onPress={() =>
                    setNumberOfParts(Math.max(2, parts - 1).toString())
                  }
                >
                  <Minus size={16} color="#666" />
                </Pressable>
                <TextInput
                  style={styles.quantityInput}
                  value={numberOfParts}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 2;
                    if (num <= 10) {
                      setNumberOfParts(text);
                      setError('');
                    }
                  }}
                  keyboardType="numeric"
                />
                <Pressable
                  style={styles.quantityBtn}
                  onPress={() => {
                    const newParts = Math.min(10, parts + 1);
                    setNumberOfParts(newParts.toString());
                  }}
                >
                  <Plus size={16} color="#666" />
                </Pressable>
              </View>
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <View style={styles.calculationPreview}>
              <Text style={styles.calculationTitle}>Résultat:</Text>
              <Text style={styles.calculationDetail}>
                Prix par part: {pricePerPart.toFixed(2)} €
              </Text>
              <Text style={styles.calculationDetail}>
                Total de parts créées: {totalPartsCreated}
              </Text>
              <Text style={styles.calculationTotal}>
                Valeur totale: {(qtyToDivide * item.price).toFixed(2)} €
              </Text>
            </View>
            <View style={styles.modalButtons}>
              <Pressable style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.confirmButton} onPress={handleConfirm}>
                <Users size={18} color="white" />
                <Text style={styles.confirmButtonText}>Diviser</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
);

const DividedItemCard = memo(
  ({
    item,
    onRemove,
    onToggleOffered,
  }: {
    item: DividedItem;
    onRemove: () => void;
    onToggleOffered: () => void;
  }) => {
    return (
      <View
        style={[styles.dividedItemCard, item.offered && styles.offeredItemCard]}
      >
        <View style={styles.dividedItemHeader}>
          <View style={styles.dividedItemInfo}>
            <View style={styles.dividedItemNameRow}>
              {item.offered && <Gift size={14} color="#FF9800" />}
              <Users size={14} color="#9C27B0" />
              <Text
                style={[
                  styles.itemName,
                  item.offered && styles.offeredItemText,
                ]}
              >
                {item.name} {item.offered ? '(Offert)' : ''}
              </Text>
            </View>
            <Text style={styles.dividedItemPartInfo}>
              Part {item.partNumber}/{item.totalParts} • {item.price.toFixed(2)}
              €
            </Text>
            <Text style={styles.dividedItemOriginalPrice}>
              (Prix original: {item.originalPrice.toFixed(2)}€)
            </Text>
          </View>
          <View style={styles.dividedItemActions}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
              onPress={onToggleOffered}
            >
              <Text style={styles.actionButtonText}>
                {item.offered ? 'Annuler' : 'Offrir'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: '#F44336' }]}
              onPress={onRemove}
            >
              <Trash2 size={14} color="white" />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
);

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

const getCategoryFromName = (name: string): 'plat' | 'boisson' => {
  const lowerName = name.toLowerCase();
  if (
    lowerName.includes('pinte') ||
    lowerName.includes('demi') ||
    lowerName.includes('bière') ||
    lowerName.includes('vin') ||
    lowerName.includes('pichet') ||
    lowerName.includes('boisson') ||
    lowerName.includes('café') ||
    lowerName.includes('thé') ||
    lowerName.includes('eau') ||
    lowerName.includes('soft') ||
    lowerName.includes('coca')
  ) {
    return 'boisson';
  }
  return 'plat';
};

const categorizeItems = (
  items: (MenuItem | SelectedMenuItem | DividedItem)[]
) => {
  return items.reduce(
    (acc, item) => {
      const category = getCategoryFromName(item.name);
      acc[category].push(item);
      return acc;
    },
    { plat: [] as any[], boisson: [] as any[] }
  );
};

export default function ItemsPaymentScreen() {
  const { tableId } = useLocalSearchParams();
  const router = useRouter();
  const tableIdNum = parseInt(tableId as string, 10);
  const toast = useToast();
  const { refreshTables } = useTableContext();
  const [table, setTable] = useState<any>(null);
  const [availableItems, setAvailableItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedMenuItem[]>([]);
  const [dividedItems, setDividedItems] = useState<DividedItem[]>([]);
  const [tableName, setTableName] = useState('');
  const [tableSection, setTableSection] = useState('');
  const [processing, setProcessing] = useState(false);
  const [allOriginalItems, setAllOriginalItems] = useState<MenuItem[]>([]);
  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [itemToSplit, setItemToSplit] = useState<MenuItem | null>(null);
  const { paymentMethods } = useSettings();
  const enabledMethods = paymentMethods.filter((method) => method.enabled);
  const [fullyDividedItemIds, setFullyDividedItemIds] = useState<Set<number>>(
    new Set()
  );

  const loadTable = useCallback(async () => {
    const tableData = await getTable(tableIdNum);
    if (tableData) {
      setTable(tableData);
      setTableName(tableData.name);
      setTableSection(tableData.section);
      if (tableData.order && tableData.order.items) {
        const items = tableData.order.items
          .filter((item: OrderItem) => !fullyDividedItemIds.has(item.id))
          .map((item: OrderItem) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
            notes: item.notes,
            offered: item.offered,
          }));
        setAvailableItems(items);
        if (allOriginalItems.length === 0) {
          setAllOriginalItems(items);
        }
      }
    }
  }, [tableIdNum, fullyDividedItemIds, allOriginalItems.length]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const handleSplitItem = useCallback((item: MenuItem) => {
    setItemToSplit(item);
    setSplitModalVisible(true);
  }, []);

  const handleConfirmSplit = useCallback(
    (quantityToDivide: number, numberOfParts: number) => {
      if (!itemToSplit) return;
      const pricePerPart = itemToSplit.price / numberOfParts;
      const newDividedItems: DividedItem[] = [];

      for (let i = 1; i <= numberOfParts; i++) {
        for (let qty = 0; qty < quantityToDivide; qty++) {
          newDividedItems.push({
            id: `${itemToSplit.id}-${Date.now()}-${i}-${qty}`,
            originalId: itemToSplit.id,
            name: itemToSplit.name,
            price: pricePerPart,
            originalPrice: itemToSplit.price,
            quantity: 1,
            notes: itemToSplit.notes,
            offered: false,
            partNumber: i,
            totalParts: numberOfParts,
            isDivided: true,
          });
        }
      }

      const remainingQuantity = itemToSplit.quantity - quantityToDivide;
      if (remainingQuantity === 0) {
        setFullyDividedItemIds((prev) => new Set([...prev, itemToSplit.id]));
      }

      setAvailableItems((prevItems) => {
        const updatedItems = prevItems
          .map((item) => {
            if (item.id === itemToSplit.id) {
              const newQuantity = item.quantity - quantityToDivide;
              return newQuantity > 0
                ? {
                    ...item,
                    quantity: newQuantity,
                    total: item.price * newQuantity,
                  }
                : null;
            }
            return item;
          })
          .filter((item): item is MenuItem => item !== null);
        return updatedItems;
      });

      setDividedItems((prev) => [...prev, ...newDividedItems]);
      toast.showToast(
        `${quantityToDivide} ${itemToSplit.name} divisé(s) en ${numberOfParts} parts chacun`,
        'success'
      );
    },
    [itemToSplit, toast]
  );

  const getAllAvailableItemsByCategory = useMemo(() => {
    const dividedAsMenuItems: MenuItem[] = dividedItems.map((item) => ({
      id: parseInt(item.id.split('-')[0]),
      name: `${item.name} (Part ${item.partNumber}/${item.totalParts})`,
      quantity: 1,
      price: item.price,
      total: item.price,
      notes: item.notes,
      offered: item.offered,
      isDividedForDisplay: true,
      dividedItemId: item.id,
      partInfo: {
        partNumber: item.partNumber,
        totalParts: item.totalParts,
        originalPrice: item.originalPrice,
      },
    })) as any[];

    const allItems = [...availableItems, ...dividedAsMenuItems];
    return categorizeItems(allItems);
  }, [availableItems, dividedItems]);

  const addDividedItemToSelection = useCallback((dividedItem: DividedItem) => {
    setDividedItems((prev) =>
      prev.filter((item) => item.id !== dividedItem.id)
    );

    const selectedItem: SelectedMenuItem = {
      id: parseInt(dividedItem.id.split('-')[0]),
      name: dividedItem.name,
      price: dividedItem.price,
      quantity: 1,
      total: dividedItem.price,
      selectedQuantity: 1,
      offered: dividedItem.offered,
      uniqueKey: dividedItem.id,
      isDivided: true,
      partInfo: {
        partNumber: dividedItem.partNumber,
        totalParts: dividedItem.totalParts,
        originalPrice: dividedItem.originalPrice,
      },
    };
    setSelectedItems((prev) => [...prev, selectedItem]);
  }, []);

  const handleDividedItemAction = useCallback(
    (dividedItemId: string, action: 'add') => {
      const dividedItem = dividedItems.find(
        (item) => item.id === dividedItemId
      );
      if (!dividedItem) return;
      if (action === 'add') {
        addDividedItemToSelection(dividedItem);
      }
    },
    [dividedItems, addDividedItemToSelection]
  );

  const removeDividedItemFromSelection = useCallback(
    (uniqueKey: string) => {
      const itemToRemove = selectedItems.find(
        (item) => item.uniqueKey === uniqueKey
      );
      if (!itemToRemove || !itemToRemove.isDivided) return;

      setSelectedItems((prev) =>
        prev.filter((item) => item.uniqueKey !== uniqueKey)
      );

      const restoredDividedItem: DividedItem = {
        id: uniqueKey,
        originalId: itemToRemove.id,
        name: itemToRemove.name,
        price: itemToRemove.price,
        originalPrice:
          itemToRemove.partInfo?.originalPrice || itemToRemove.price,
        quantity: 1,
        offered: itemToRemove.offered,
        partNumber: itemToRemove.partInfo?.partNumber || 1,
        totalParts: itemToRemove.partInfo?.totalParts || 1,
        isDivided: true,
      };
      setDividedItems((prev) => [...prev, restoredDividedItem]);
    },
    [selectedItems]
  );

  const toggleDividedItemOffered = useCallback(
    (uniqueKey: string) => {
      if (selectedItems.some((item) => item.uniqueKey === uniqueKey)) {
        setSelectedItems((prev) =>
          prev.map((item) =>
            item.uniqueKey === uniqueKey
              ? { ...item, offered: !item.offered }
              : item
          )
        );
      } else {
        setDividedItems((prev) =>
          prev.map((item) =>
            item.id === uniqueKey ? { ...item, offered: !item.offered } : item
          )
        );
      }
    },
    [selectedItems]
  );

  const addItemToSelection = useCallback(
    (item: MenuItem, addAll: boolean = false) => {
      if (item.quantity <= 0) return;
      const quantityToAdd = addAll ? item.quantity : 1;
      setAvailableItems((prev) =>
        prev
          .map((availItem) => {
            if (availItem.id === item.id) {
              const newQuantity = Math.max(
                0,
                availItem.quantity - quantityToAdd
              );
              return newQuantity > 0
                ? {
                    ...availItem,
                    quantity: newQuantity,
                    total: availItem.price * newQuantity,
                  }
                : null;
            }
            return availItem;
          })
          .filter((item): item is MenuItem => item !== null)
      );
      setSelectedItems((prev) => {
        const existingIndex = prev.findIndex(
          (selected) => selected.id === item.id && !selected.isDivided
        );
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            selectedQuantity:
              updated[existingIndex].selectedQuantity + quantityToAdd,
          };
          return updated;
        } else {
          const newSelectedItem: SelectedMenuItem = {
            ...item,
            selectedQuantity: quantityToAdd,
            uniqueKey: `${item.id}-${Date.now()}`,
          };
          return [...prev, newSelectedItem];
        }
      });
    },
    []
  );

  const totalAvailable = useMemo(() => {
    const availableTotal = availableItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const dividedTotal = dividedItems.reduce(
      (sum, item) => sum + item.price,
      0
    );
    return availableTotal + dividedTotal;
  }, [availableItems, dividedItems]);

  const totalSelected = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      return item.offered ? sum : sum + item.price * item.selectedQuantity;
    }, 0);
  }, [selectedItems]);

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
          return;
        }

        const paidItems = selectedItems.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.selectedQuantity,
          price: item.price,
          offered: item.offered,
          isDivided: item.isDivided,
          partInfo: item.partInfo,
        }));

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

        let updatedOrderItems = [...currentTable.order.items];

        const nonDividedSelectedItems = selectedItems.filter(
          (item) => !item.isDivided
        );

        for (const selectedItem of nonDividedSelectedItems) {
          const orderItemIndex = updatedOrderItems.findIndex(
            (item) => item.id === selectedItem.id
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
              };
            }
          }
        }

        const newTotal = updatedOrderItems.reduce((sum, item) => {
          return item.offered ? sum : sum + item.price * item.quantity;
        }, 0);

        if (updatedOrderItems.length === 0 && dividedItems.length === 0) {
          await resetTable(tableIdNum);
          await refreshTables();
          router.replace('/');
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
          await refreshTables();
          setSelectedItems([]);
          const reloadedTable = await getTable(tableIdNum);
          if (
            reloadedTable &&
            reloadedTable.order &&
            reloadedTable.order.items
          ) {
            const filteredItems = reloadedTable.order.items
              .filter((item: OrderItem) => !fullyDividedItemIds.has(item.id))
              .map((item: OrderItem) => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                total: item.price * item.quantity,
                notes: item.notes,
                offered: item.offered,
              }));
            setAvailableItems(filteredItems);
          }
          toast.showToast(
            `Articles payés: ${totalSelected.toFixed(
              2
            )}€\nRestant: ${newTotal.toFixed(2)}€`,
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
      table,
      dividedItems,
      refreshTables,
      router,
      toast,
      fullyDividedItemIds,
    ]
  );

  const handleBack = useCallback(() => {
    if (selectedItems.length > 0 || dividedItems.length > 0) {
      Alert.alert(
        'Articles en cours',
        'Vous avez des articles sélectionnés ou divisés. Voulez-vous vraiment quitter ?',
        [
          { text: 'Rester', style: 'cancel' },
          { text: 'Quitter', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  }, [selectedItems.length, dividedItems.length, router]);

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
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Paiement par article - {tableName}</Text>
          {tableSection && (
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionText}>{tableSection}</Text>
            </View>
          )}
        </View>
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>
            Articles disponibles: {totalAvailable.toFixed(2)}€
          </Text>
          <Text style={styles.summarySubText}>
            Sélectionnés: {totalSelected.toFixed(2)}€
          </Text>
          {selectedItems.length > 0 && (
            <Text style={styles.warningText}>
              {selectedItems.length} article(s) sélectionné(s)
            </Text>
          )}
        </View>
      </View>
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Articles disponibles</Text>
          <View style={styles.doubleColumn}>
            <View style={styles.subColumn}>
              <Text style={styles.subColumnTitle}>Plats</Text>
              <ScrollView style={styles.itemsList}>
                {getAllAvailableItemsByCategory.plat.map((item: any) => (
                  <View
                    key={
                      item.isDividedForDisplay ? item.dividedItemId : item.id
                    }
                    style={[
                      styles.itemCard,
                      item.isDividedForDisplay && styles.dividedItemCard,
                    ]}
                  >
                    <View style={styles.itemHeader}>
                      <View style={styles.itemNameRow}>
                        {item.isDividedForDisplay && (
                          <Users size={14} color="#9C27B0" />
                        )}
                        <Text style={styles.itemName}>{item.name}</Text>
                      </View>
                      <Text
                        style={[
                          styles.itemPrice,
                          item.isDividedForDisplay && { color: '#9C27B0' },
                        ]}
                      >
                        {item.price.toFixed(2)} €
                      </Text>
                    </View>
                    {item.isDividedForDisplay ? (
                      <View style={styles.itemActions}>
                        <Text style={styles.dividedItemOriginalPrice}>
                          Prix original:{' '}
                          {item.partInfo.originalPrice.toFixed(2)}€
                        </Text>
                        <View style={styles.actionButtons}>
                          <Pressable
                            style={[
                              styles.actionButton,
                              { backgroundColor: '#4CAF50' },
                            ]}
                            onPress={() =>
                              handleDividedItemAction(item.dividedItemId, 'add')
                            }
                          >
                            <Plus size={14} color="white" />
                            <Text style={styles.actionButtonText}>
                              Sélectionner
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.itemActions}>
                        <Text style={styles.quantityText}>
                          Qté: {item.quantity}
                        </Text>
                        <View style={styles.actionButtons}>
                          <Pressable
                            style={[
                              styles.actionButton,
                              { backgroundColor: '#9C27B0' },
                            ]}
                            onPress={() => handleSplitItem(item)}
                          >
                            <Users size={14} color="white" />
                            <Text style={styles.actionButtonText}>Diviser</Text>
                          </Pressable>
                          {item.quantity > 1 && (
                            <Pressable
                              style={[
                                styles.actionButton,
                                { backgroundColor: '#2196F3' },
                              ]}
                              onPress={() => addItemToSelection(item, true)}
                            >
                              <ShoppingCart size={14} color="white" />
                              <Text style={styles.actionButtonText}>Tout</Text>
                            </Pressable>
                          )}
                          <Pressable
                            style={[
                              styles.actionButton,
                              { backgroundColor: '#4CAF50' },
                            ]}
                            onPress={() => addItemToSelection(item, false)}
                          >
                            <Plus size={14} color="white" />
                            <Text style={styles.actionButtonText}>+1</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
            <View style={styles.subColumn}>
              <Text style={styles.subColumnTitle}>Boissons</Text>
              <ScrollView style={styles.itemsList}>
                {getAllAvailableItemsByCategory.boisson.map((item: any) => (
                  <View
                    key={
                      item.isDividedForDisplay ? item.dividedItemId : item.id
                    }
                    style={[
                      styles.itemCard,
                      item.isDividedForDisplay && styles.dividedItemCard,
                    ]}
                  >
                    <View style={styles.itemHeader}>
                      <View style={styles.itemNameRow}>
                        {item.isDividedForDisplay && (
                          <Users size={14} color="#9C27B0" />
                        )}
                        <Text style={styles.itemName}>{item.name}</Text>
                      </View>
                      <Text
                        style={[
                          styles.itemPrice,
                          item.isDividedForDisplay && { color: '#9C27B0' },
                        ]}
                      >
                        {item.price.toFixed(2)} €
                      </Text>
                    </View>
                    {item.isDividedForDisplay ? (
                      <View style={styles.itemActions}>
                        <Text style={styles.dividedItemOriginalPrice}>
                          Prix original:{' '}
                          {item.partInfo.originalPrice.toFixed(2)}€
                        </Text>
                        <View style={styles.actionButtons}>
                          <Pressable
                            style={[
                              styles.actionButton,
                              { backgroundColor: '#4CAF50' },
                            ]}
                            onPress={() =>
                              handleDividedItemAction(item.dividedItemId, 'add')
                            }
                          >
                            <Plus size={14} color="white" />
                            <Text style={styles.actionButtonText}>
                              Sélectionner
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.itemActions}>
                        <Text style={styles.quantityText}>
                          Qté: {item.quantity}
                        </Text>
                        <View style={styles.actionButtons}>
                          <Pressable
                            style={[
                              styles.actionButton,
                              { backgroundColor: '#9C27B0' },
                            ]}
                            onPress={() => handleSplitItem(item)}
                          >
                            <Users size={14} color="white" />
                            <Text style={styles.actionButtonText}>Diviser</Text>
                          </Pressable>
                          {item.quantity > 1 && (
                            <Pressable
                              style={[
                                styles.actionButton,
                                { backgroundColor: '#2196F3' },
                              ]}
                              onPress={() => addItemToSelection(item, true)}
                            >
                              <ShoppingCart size={14} color="white" />
                              <Text style={styles.actionButtonText}>Tout</Text>
                            </Pressable>
                          )}
                          <Pressable
                            style={[
                              styles.actionButton,
                              { backgroundColor: '#4CAF50' },
                            ]}
                            onPress={() => addItemToSelection(item, false)}
                          >
                            <Plus size={14} color="white" />
                            <Text style={styles.actionButtonText}>+1</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Articles sélectionnés pour paiement
          </Text>
          {selectedItems.length === 0 ? (
            <Text style={styles.emptyText}>Aucun article sélectionné</Text>
          ) : (
            <ScrollView style={styles.selectedItemsList}>
              {selectedItems.map((item) => (
                <View
                  key={item.uniqueKey}
                  style={[
                    styles.selectedItemCard,
                    item.offered && styles.offeredItemCard,
                  ]}
                >
                  <View style={styles.selectedItemHeader}>
                    <View style={styles.selectedItemInfo}>
                      <View style={styles.selectedItemNameRow}>
                        {item.offered && <Gift size={16} color="#FF9800" />}
                        {item.isDivided && <Users size={16} color="#9C27B0" />}
                        <Text
                          style={[
                            styles.itemName,
                            item.offered && styles.offeredItemText,
                          ]}
                        >
                          {item.name} {item.offered ? '(Offert)' : ''}
                        </Text>
                      </View>
                      {item.isDivided && item.partInfo && (
                        <Text style={styles.partInfoText}>
                          Part {item.partInfo.partNumber}/
                          {item.partInfo.totalParts} • Prix original:{' '}
                          {item.partInfo.originalPrice.toFixed(2)}€
                        </Text>
                      )}
                      {!item.isDivided && (
                        <View style={styles.quantityControls}>
                          <Pressable
                            style={styles.quantityBtn}
                            onPress={() => {
                              if (item.selectedQuantity > 1) {
                                setSelectedItems((prev) =>
                                  prev.map((si) =>
                                    si.uniqueKey === item.uniqueKey
                                      ? {
                                          ...si,
                                          selectedQuantity:
                                            si.selectedQuantity - 1,
                                        }
                                      : si
                                  )
                                );
                                setAvailableItems((prev) => {
                                  const existing = prev.find(
                                    (ai) => ai.id === item.id
                                  );
                                  if (existing) {
                                    return prev.map((ai) =>
                                      ai.id === item.id
                                        ? {
                                            ...ai,
                                            quantity: ai.quantity + 1,
                                            total: ai.price * (ai.quantity + 1),
                                          }
                                        : ai
                                    );
                                  } else {
                                    const originalItem = allOriginalItems.find(
                                      (oi) => oi.id === item.id
                                    );
                                    if (originalItem) {
                                      return [
                                        ...prev,
                                        {
                                          ...originalItem,
                                          quantity: 1,
                                          total: originalItem.price,
                                        },
                                      ];
                                    }
                                  }
                                  return prev;
                                });
                              } else {
                                setSelectedItems((prev) =>
                                  prev.filter(
                                    (si) => si.uniqueKey !== item.uniqueKey
                                  )
                                );
                                setAvailableItems((prev) => {
                                  const existing = prev.find(
                                    (ai) => ai.id === item.id
                                  );
                                  if (existing) {
                                    return prev.map((ai) =>
                                      ai.id === item.id
                                        ? {
                                            ...ai,
                                            quantity: ai.quantity + 1,
                                            total: ai.price * (ai.quantity + 1),
                                          }
                                        : ai
                                    );
                                  } else {
                                    const originalItem = allOriginalItems.find(
                                      (oi) => oi.id === item.id
                                    );
                                    if (originalItem) {
                                      return [
                                        ...prev,
                                        {
                                          ...originalItem,
                                          quantity: 1,
                                          total: originalItem.price,
                                        },
                                      ];
                                    }
                                  }
                                  return prev;
                                });
                              }
                            }}
                          >
                            <Minus size={16} color="#666" />
                          </Pressable>
                          <Text style={styles.quantityText}>
                            {item.selectedQuantity}
                          </Text>
                          <Pressable
                            style={styles.quantityBtn}
                            onPress={() => {
                              const availableItem = availableItems.find(
                                (ai) => ai.id === item.id
                              );
                              if (availableItem && availableItem.quantity > 0) {
                                setSelectedItems((prev) =>
                                  prev.map((si) =>
                                    si.uniqueKey === item.uniqueKey
                                      ? {
                                          ...si,
                                          selectedQuantity:
                                            si.selectedQuantity + 1,
                                        }
                                      : si
                                  )
                                );
                                setAvailableItems((prev) =>
                                  prev
                                    .map((ai) =>
                                      ai.id === item.id && ai.quantity > 0
                                        ? {
                                            ...ai,
                                            quantity: ai.quantity - 1,
                                            total: ai.price * (ai.quantity - 1),
                                          }
                                        : ai
                                    )
                                    .filter((ai) => ai.quantity > 0)
                                );
                              }
                            }}
                          >
                            <Plus size={16} color="#666" />
                          </Pressable>
                        </View>
                      )}
                    </View>
                    <View style={styles.selectedItemActions}>
                      <Text
                        style={[
                          styles.itemPrice,
                          item.offered && styles.offeredItemText,
                        ]}
                      >
                        {(item.price * item.selectedQuantity).toFixed(2)}€
                      </Text>
                      <View style={styles.actionButtons}>
                        <Pressable
                          style={[
                            styles.actionButton,
                            { backgroundColor: '#F44336' },
                          ]}
                          onPress={() => {
                            if (item.isDivided) {
                              removeDividedItemFromSelection(
                                item.uniqueKey || ''
                              );
                            } else {
                              setAvailableItems((prev) => {
                                const existing = prev.find(
                                  (ai) => ai.id === item.id
                                );
                                if (existing) {
                                  return prev.map((ai) =>
                                    ai.id === item.id
                                      ? {
                                          ...ai,
                                          quantity:
                                            ai.quantity + item.selectedQuantity,
                                          total:
                                            ai.price *
                                            (ai.quantity +
                                              item.selectedQuantity),
                                        }
                                      : ai
                                  );
                                } else {
                                  const originalItem = allOriginalItems.find(
                                    (oi) => oi.id === item.id
                                  );
                                  if (originalItem) {
                                    return [
                                      ...prev,
                                      {
                                        ...originalItem,
                                        quantity: item.selectedQuantity,
                                        total:
                                          originalItem.price *
                                          item.selectedQuantity,
                                      },
                                    ];
                                  }
                                }
                                return prev;
                              });
                              setSelectedItems((prev) =>
                                prev.filter(
                                  (si) => si.uniqueKey !== item.uniqueKey
                                )
                              );
                            }
                          }}
                        >
                          <Trash2 size={14} color="white" />
                          <Text style={styles.actionButtonText}>Retirer</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
      <View style={styles.paymentSection}>
        <View style={styles.paymentSummary}>
          <Text style={styles.paymentSummaryText}>
            À payer: {totalSelected.toFixed(2)}€
          </Text>
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
                  (selectedItems.length === 0 || processing) &&
                    styles.paymentButtonDisabled,
                ]}
                onPress={() =>
                  handlePayment(method.id as 'cash' | 'check' | 'card')
                }
                disabled={selectedItems.length === 0 || processing}
              >
                {getMethodIcon(method.id)}
                <Text style={styles.paymentButtonText}>{method.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <SplitItemModal
        visible={splitModalVisible}
        item={itemToSplit}
        onClose={() => {
          setSplitModalVisible(false);
          setItemToSplit(null);
        }}
        onConfirm={handleConfirmSplit}
      />
      {processing && (
        <View style={styles.processingOverlay}>
          <Text style={styles.processingText}>Traitement du paiement...</Text>
        </View>
      )}
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
    padding: 20,
  },
  header: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    padding: 8,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  sectionText: {
    color: '#0288D1',
    fontWeight: '600',
    fontSize: 12,
  },
  summaryContainer: {
    alignItems: 'flex-end',
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  summarySubText: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '500',
  },
  warningText: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 2,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    padding: 8,
    gap: 8,
  },
  section: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  doubleColumn: {
    flexDirection: 'row',
    flex: 1,
    gap: 8,
  },
  subColumn: {
    flex: 1,
  },
  subColumnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
    backgroundColor: '#f8f8f8',
    paddingVertical: 4,
    borderRadius: 4,
  },
  itemsList: {
    flex: 1,
  },
  itemCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 12,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 2,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '500',
  },
  dividedItemCard: {
    backgroundColor: '#F3E5F5',
    borderLeftColor: '#9C27B0',
  },
  dividedItemHeader: {
    marginBottom: 4,
  },
  dividedItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  dividedItemPartInfo: {
    fontSize: 11,
    color: '#9C27B0',
    fontWeight: '600',
  },
  dividedItemOriginalPrice: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  dividedItemActions: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'flex-end',
  },
  selectedItemsList: {
    flex: 1,
  },
  selectedItemCard: {
    backgroundColor: '#E8F5E8',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  offeredItemCard: {
    backgroundColor: '#FFF8E1',
    borderLeftColor: '#FF9800',
  },
  selectedItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  selectedItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  selectedItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  offeredItemText: {
    fontStyle: 'italic',
    color: '#FF9800',
  },
  partInfoText: {
    fontSize: 11,
    color: '#9C27B0',
    fontWeight: '500',
    marginBottom: 6,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 4,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
  quantityBtn: {
    padding: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  selectedItemActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    marginTop: 20,
  },
  paymentSection: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 12,
  },
  paymentSummary: {
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentSummaryText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  paymentMethods: {
    alignItems: 'center',
  },
  paymentButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    minWidth: 120,
  },
  paymentButtonDisabled: {
    opacity: 0.5,
  },
  paymentButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
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
    minWidth: 320,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  itemPreview: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
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
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 4,
  },
  quantityInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 8,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  calculationPreview: {
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  calculationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  calculationDetail: {
    fontSize: 14,
    color: '#2E7D32',
    marginBottom: 2,
  },
  calculationTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#4CAF50',
    paddingTop: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#9C27B0',
    gap: 6,
  },
  confirmButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  dividedItemInfo: {
    flex: 1,
  },
});
