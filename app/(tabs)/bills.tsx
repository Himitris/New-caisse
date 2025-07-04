// app/(tabs)/bills.tsx - VERSION SIMPLIFIÉE AVEC GUESTS

import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowUpDown,
  Calendar,
  CreditCard,
  Download,
  Eye,
  Filter,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Share as ShareIcon,
  Trash2,
  X,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Bill,
  getBills,
  saveBills,
  getFilteredBills,
  BillManager,
} from '../../utils/storage';
import { useToast } from '../../utils/ToastContext';
import { useSettings } from '@/utils/useSettings';

const STATUS_COLORS = {
  pending: '#FFC107',
  paid: '#4CAF50',
  split: '#2196F3',
  custom: '#FF9800',
  default: '#E0E0E0',
} as const;

const PAYMENT_METHOD_LABELS = {
  card: 'Carte bancaire',
  cash: 'Espèces',
  check: 'Chèque',
} as const;

const ITEM_HEIGHT = 80;
const MAX_BILLS_DISPLAY = 200;

const getBillStatusColor = (bill: Bill) => {
  if (bill.status === 'split' && bill.paymentType === 'custom') {
    return STATUS_COLORS.custom;
  }
  return STATUS_COLORS[bill.status] || STATUS_COLORS.default;
};

// Modal de visualisation simplifiée
interface ViewReceiptModalProps {
  visible: boolean;
  bill: Bill | null;
  onClose: () => void;
  onPrint: () => void;
  onShare: () => void;
  onDelete: () => void;
}

const ViewReceiptModal = memo<ViewReceiptModalProps>(
  ({ visible, bill, onClose, onPrint, onShare, onDelete }) => {
    const { restaurantInfo, paymentMethods } = useSettings();

    const getPaymentMethodLabel = useCallback(
      (methodId: string) => {
        const method = paymentMethods.find((m) => m.id === methodId);
        return method ? method.name : methodId;
      },
      [paymentMethods]
    );

    const calculateOriginalAmount = useCallback((bill: Bill) => {
      const hasDetailedItems = bill.paidItems && bill.paidItems.length > 0;

      if (bill.paymentType === 'custom' && hasDetailedItems) {
        return (
          bill.paidItems?.reduce((sum, item) => {
            if (item.offered) return sum;
            return sum + item.price * item.quantity;
          }, 0) || bill.amount
        );
      }
      return bill.amount;
    }, []);

    const handleDelete = useCallback(() => {
      Alert.alert(
        'Supprimer la facture',
        'Êtes-vous sûr de vouloir supprimer cette facture ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Supprimer', style: 'destructive', onPress: onDelete },
        ]
      );
    }, [onDelete]);

    if (!bill) return null;

    const statusColor = getBillStatusColor(bill);
    const paymentLabel = bill.paymentMethod
      ? getPaymentMethodLabel(bill.paymentMethod)
      : '';
    const hasDetailedItems = bill.paidItems && bill.paidItems.length > 0;

    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.receiptModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reçu</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <X size={24} color="#666" />
              </Pressable>
            </View>

            <ScrollView style={styles.receiptContent}>
              <View style={styles.restaurantInfo}>
                <Text style={styles.restaurantName}>{restaurantInfo.name}</Text>
                <Text style={styles.restaurantAddress}>
                  {restaurantInfo.address}
                </Text>
                <Text style={styles.restaurantPhone}>
                  {restaurantInfo.phone}
                </Text>
              </View>

              <View style={styles.receiptDivider} />

              <View style={styles.billInfo}>
                <Text style={styles.billTable}>
                  {bill.tableName || `Table ${bill.tableNumber}`}
                </Text>
                <Text style={styles.billDate}>
                  {new Date(bill.timestamp).toLocaleString()}
                </Text>
                {bill.section ? (
                  <Text style={styles.billSection}>
                    Section: {bill.section}
                  </Text>
                ) : null}
                {typeof bill.guests === 'number' && bill.guests > 0 ? (
                  <Text style={styles.billGuests}>Couverts: {bill.guests}</Text>
                ) : null}
              </View>

              <View style={styles.receiptDivider} />

              {hasDetailedItems && (
                <View style={styles.itemsContainer}>
                  <Text style={styles.itemsHeader}>Détail des articles</Text>
                  {(bill.paidItems ?? []).slice(0, 20).map((item, index) => (
                    <View key={index} style={styles.itemRow}>
                      <View style={styles.itemDetails}>
                        <Text style={styles.itemQuantity}>
                          {item.quantity}x
                        </Text>
                        <Text
                          style={[
                            styles.itemName,
                            item.offered && styles.offeredItemText,
                          ]}
                        >
                          {item.name} {item.offered ? '(Offert)' : ''}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.itemPrice,
                          item.offered && styles.offeredItemPrice,
                        ]}
                      >
                        {(item.price * item.quantity).toFixed(2)} €
                      </Text>
                    </View>
                  ))}
                  <View style={styles.receiptDivider} />
                </View>
              )}

              <View style={styles.billSummary}>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Articles:</Text>
                  <Text style={styles.billValue}>
                    {hasDetailedItems
                      ? bill.paidItems?.length ?? 0
                      : bill.items}
                  </Text>
                </View>

                {typeof bill.offeredAmount === 'number' &&
                bill.offeredAmount > 0 ? (
                  <View style={styles.billRow}>
                    <Text style={styles.billOfferedLabel}>
                      Articles offerts:
                    </Text>
                    <Text style={styles.billOfferedValue}>
                      {bill.offeredAmount.toFixed(2)} €
                    </Text>
                  </View>
                ) : null}

                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Montant:</Text>
                  <Text style={styles.billAmount}>
                    {(bill.amount || 0).toFixed(2)} €
                  </Text>
                </View>

                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Statut:</Text>
                  <Text style={[styles.billStatus, { color: statusColor }]}>
                    {bill.status}
                  </Text>
                </View>

                {paymentLabel && (
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Paiement:</Text>
                    <Text style={styles.billValue}>{paymentLabel}</Text>
                  </View>
                )}
              </View>

              <View style={styles.receiptDivider} />
              <Text style={styles.receiptFooter}>Merci de votre visite!</Text>
            </ScrollView>

            <View style={styles.receiptActions}>
              <Pressable style={styles.receiptAction} onPress={onPrint}>
                <Printer size={20} color="#4CAF50" />
                <Text style={[styles.receiptActionText, { color: '#4CAF50' }]}>
                  Imprimer
                </Text>
              </Pressable>
              <Pressable style={styles.receiptAction} onPress={onShare}>
                <ShareIcon size={20} color="#2196F3" />
                <Text style={[styles.receiptActionText, { color: '#2196F3' }]}>
                  Partager
                </Text>
              </Pressable>
              <Pressable style={styles.receiptAction} onPress={handleDelete}>
                <Trash2 size={20} color="#F44336" />
                <Text style={[styles.receiptActionText, { color: '#F44336' }]}>
                  Supprimer
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
);

// Barre de filtres simplifiée
interface FilterBarProps {
  onSearch: (text: string) => void;
  onDateChange: (date: Date | null) => void;
  sortOrder: 'desc' | 'asc' | 'none';
  onSortChange: (order: 'desc' | 'asc' | 'none') => void;
  onDeleteAll: () => void;
  onDeleteFiltered: () => void;
  searchText: string;
  selectedDate: Date | null;
  onPaymentMethodChange: (method: Bill['paymentMethod'] | null) => void;
  selectedPaymentMethod: Bill['paymentMethod'] | null;
  onResetFilters: () => void;
}

const FilterBar = memo<FilterBarProps>(
  ({
    onSearch,
    onDateChange,
    sortOrder,
    onSortChange,
    onDeleteAll,
    onDeleteFiltered,
    searchText,
    selectedDate,
    onPaymentMethodChange,
    selectedPaymentMethod,
    onResetFilters,
  }) => {
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showPaymentPicker, setShowPaymentPicker] = useState(false);
    const [tempDate, setTempDate] = useState(selectedDate || new Date());
    const { paymentMethods } = useSettings();

    const getPaymentMethodLabel = useCallback(
      (methodId: string) => {
        const method = paymentMethods.find((m) => m.id === methodId);
        return method ? method.name : methodId;
      },
      [paymentMethods]
    );

    const handleDateChange = useCallback(
      (event: any, date?: Date) => {
        setShowDatePicker(false);
        if (date) {
          setTempDate(date);
          onDateChange(date);
        }
      },
      [onDateChange]
    );

    const handleSortToggle = useCallback(() => {
      let newSortOrder: 'none' | 'desc' | 'asc';
      switch (sortOrder) {
        case 'desc':
          newSortOrder = 'asc';
          break;
        case 'asc':
          newSortOrder = 'none';
          break;
        default:
          newSortOrder = 'desc';
      }
      onSortChange(newSortOrder);
    }, [sortOrder, onSortChange]);

    const sortIcon = useMemo(() => {
      if (sortOrder === 'desc')
        return <ArrowDownAZ size={20} color="#2196F3" />;
      if (sortOrder === 'asc') return <ArrowUpAZ size={20} color="#2196F3" />;
      return <ArrowUpDown size={20} color="#666" />;
    }, [sortOrder]);

    const sortLabel = useMemo(() => {
      if (sortOrder === 'none') return 'Trier';
      if (sortOrder === 'asc') return 'Ancien→Récent';
      return 'Récent→Ancien';
    }, [sortOrder]);

    const dateLabel = useMemo(() => {
      if (!selectedDate) return 'Par date';
      return new Date(selectedDate).toLocaleDateString();
    }, [selectedDate]);

    const paymentMethodLabel = useMemo(() => {
      if (!selectedPaymentMethod) return 'Mode de paiement';
      return getPaymentMethodLabel(selectedPaymentMethod);
    }, [selectedPaymentMethod, getPaymentMethodLabel]);

    return (
      <View style={styles.filterBar}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher par table ou montant..."
            value={searchText}
            onChangeText={onSearch}
          />
          {searchText ? (
            <Pressable onPress={() => onSearch('')}>
              <X size={20} color="#666" />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterActions}
        >
          <Pressable
            style={styles.filterButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Calendar size={20} color="#2196F3" />
            <Text style={styles.filterButtonText}>{dateLabel}</Text>
            {selectedDate && (
              <Pressable
                onPress={() => onDateChange(null)}
                style={styles.clearButton}
              >
                <X size={16} color="#F44336" />
              </Pressable>
            )}
          </Pressable>

          <View style={styles.paymentButtonContainer}>
            <Pressable
              style={styles.filterButton}
              onPress={() => setShowPaymentPicker(!showPaymentPicker)}
            >
              <CreditCard size={20} color="#2196F3" />
              <Text style={styles.filterButtonText}>{paymentMethodLabel}</Text>
              {selectedPaymentMethod && (
                <Pressable
                  onPress={() => onPaymentMethodChange(null)}
                  style={styles.clearButton}
                >
                  <X size={16} color="#F44336" />
                </Pressable>
              )}
            </Pressable>

            {showPaymentPicker && (
              <View style={styles.paymentPickerContainer}>
                <Pressable
                  style={[
                    styles.paymentOption,
                    !selectedPaymentMethod && styles.selectedPaymentOption,
                  ]}
                  onPress={() => {
                    onPaymentMethodChange(null);
                    setShowPaymentPicker(false);
                  }}
                >
                  <Text style={styles.paymentOptionText}>Tous les modes</Text>
                </Pressable>
                {Object.entries(PAYMENT_METHOD_LABELS).map(
                  ([method, label]) => (
                    <Pressable
                      key={method}
                      style={[
                        styles.paymentOption,
                        selectedPaymentMethod === method &&
                          styles.selectedPaymentOption,
                      ]}
                      onPress={() => {
                        onPaymentMethodChange(method as Bill['paymentMethod']);
                        setShowPaymentPicker(false);
                      }}
                    >
                      <Text style={styles.paymentOptionText}>{label}</Text>
                    </Pressable>
                  )
                )}
              </View>
            )}
          </View>

          <Pressable style={styles.filterButton} onPress={handleSortToggle}>
            {sortIcon}
            <Text style={styles.filterButtonText}>{sortLabel}</Text>
          </Pressable>

          <Pressable style={styles.filterButton} onPress={onDeleteAll}>
            <Filter size={20} color="#F44336" />
            <Text style={[styles.filterButtonText, { color: '#F44336' }]}>
              Supprimer toutes
            </Text>
          </Pressable>

          <Pressable style={styles.filterButton} onPress={onDeleteFiltered}>
            <Trash2 size={20} color="#FF9800" />
            <Text style={[styles.filterButtonText, { color: '#FF9800' }]}>
              Supprimer sélection
            </Text>
          </Pressable>

          <Pressable style={styles.resetButton} onPress={onResetFilters}>
            <RefreshCw size={20} color="#2196F3" />
            <Text style={[styles.filterButtonText, { color: '#2196F3' }]}>
              Réinitialiser
            </Text>
          </Pressable>
        </ScrollView>

        {showDatePicker && (
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}
      </View>
    );
  }
);

// Item de facture simplifié
interface BillListItemProps {
  bill: Bill;
  isSelected: boolean;
  onSelect: (bill: Bill) => void;
}

const BillListItem = memo<BillListItemProps>(
  ({ bill, isSelected, onSelect }) => {
    const handlePress = useCallback(() => {
      onSelect(bill);
    }, [bill, onSelect]);

    const statusColor = getBillStatusColor(bill);

    const formattedDate = useMemo(() => {
      const date = new Date(bill.timestamp);
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }, [bill.timestamp]);

    return (
      <Pressable
        style={[styles.billListItem, isSelected && styles.selectedBillItem]}
        onPress={handlePress}
      >
        <Text style={styles.billItemTable}>
          {bill.tableName || `Table ${bill.tableNumber}`}
        </Text>
        <View style={styles.billItemDetails}>
          <Text style={styles.billItemAmount}>{bill.amount.toFixed(2)} €</Text>
          <Text style={[styles.billItemStatus, { color: statusColor }]}>
            {bill.status === 'split' && bill.paymentType === 'custom'
              ? 'Custom'
              : bill.status === 'split' && bill.paymentType === 'split'
              ? 'Split'
              : bill.status}
          </Text>
        </View>
        <Text style={styles.billItemDate}>{formattedDate}</Text>
      </Pressable>
    );
  }
);

// Composant principal simplifié
export default function BillsScreen() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [filteredBills, setFilteredBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'none'>('desc');
  const [searchText, setSearchText] = useState('');
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<
    Bill['paymentMethod'] | null
  >(null);

  const { restaurantInfo, paymentMethods } = useSettings();
  const toast = useToast();

  // Chargement des factures
  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      if (searchText || dateFilter || paymentMethodFilter) {
        const filters = {
          searchText: searchText.trim() || undefined,
          dateRange: dateFilter
            ? {
                start: new Date(dateFilter.setHours(0, 0, 0, 0)),
                end: new Date(dateFilter.setHours(23, 59, 59, 999)),
              }
            : undefined,
          paymentMethod: paymentMethodFilter || undefined,
        };

        const filtered = await getFilteredBills(filters);
        setFilteredBills(filtered.slice(0, MAX_BILLS_DISPLAY));
      } else {
        const allBills = await getBills();
        setFilteredBills(allBills.slice(0, MAX_BILLS_DISPLAY));
      }
    } catch (error) {
      console.error('Error loading bills:', error);
      toast.showToast('Impossible de charger les factures.', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchText, dateFilter, paymentMethodFilter, toast]);

  useEffect(() => {
    const loadAllBills = async () => {
      try {
        const allBills = await getBills();
        setBills(allBills.slice(0, MAX_BILLS_DISPLAY));
      } catch (error) {
        console.error('Error loading all bills:', error);
      }
    };

    loadAllBills();
    loadBills();
  }, [loadBills]);

  // Tri des factures
  const sortBillsByDate = useCallback(
    (billsToSort: Bill[], order: 'desc' | 'asc' | 'none' = 'desc') => {
      if (order === 'none') return billsToSort;

      return [...billsToSort].sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return order === 'desc' ? dateB - dateA : dateA - dateB;
      });
    },
    []
  );

  const getPaymentMethodLabel = useCallback(
    (methodId: string) => {
      const method = paymentMethods.find((m) => m.id === methodId);
      return method ? method.name : methodId;
    },
    [paymentMethods]
  );

  // Supprimer les factures filtrées
  const handleDeleteFiltered = useCallback(() => {
    if (filteredBills.length === 0) {
      toast.showToast('Aucune facture à supprimer.', 'info');
      return;
    }

    Alert.alert(
      'Supprimer les factures filtrées',
      `Êtes-vous sûr de vouloir supprimer ${filteredBills.length} facture(s) ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessing(true);

              const billIdsToDelete = new Set(
                filteredBills.map((bill) => bill.id)
              );
              const remainingBills = bills.filter(
                (bill) => !billIdsToDelete.has(bill.id)
              );

              await saveBills(remainingBills);
              setBills(remainingBills);
              setFilteredBills([]);

              if (
                remainingBills.length > 0 &&
                selectedBill &&
                billIdsToDelete.has(selectedBill.id)
              ) {
                setSelectedBill(remainingBills[0]);
              } else if (remainingBills.length === 0) {
                setSelectedBill(null);
              }

              toast.showToast(
                `${billIdsToDelete.size} facture(s) supprimée(s).`,
                'success'
              );

              setTimeout(() => {
                loadBills();
              }, 500);
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              toast.showToast('Impossible de supprimer les factures.', 'error');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  }, [filteredBills, bills, selectedBill, loadBills, toast]);

  // Filtres appliqués
  const appliedFilters = useMemo(() => {
    let filtered = [...filteredBills];

    if (searchText.trim()) {
      const lowerCaseText = searchText.toLowerCase();
      filtered = filtered.filter((bill) => {
        const tableName = bill.tableName || `Table ${bill.tableNumber}`;
        const amount = bill.amount.toString();

        return (
          tableName.toLowerCase().includes(lowerCaseText) ||
          amount.includes(lowerCaseText) ||
          (bill.section && bill.section.toLowerCase().includes(lowerCaseText))
        );
      });
    }

    return sortBillsByDate(filtered, sortOrder);
  }, [filteredBills, searchText, sortOrder, sortBillsByDate]);

  // Handlers
  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
  }, []);

  const handleDateFilter = useCallback((date: Date | null) => {
    setDateFilter(date);
  }, []);

  const handlePaymentMethodFilter = useCallback(
    (method: Bill['paymentMethod'] | null) => {
      setPaymentMethodFilter(method);
    },
    []
  );

  const handleSortChange = useCallback(
    (newSortOrder: 'desc' | 'asc' | 'none') => {
      setSortOrder(newSortOrder);
    },
    []
  );

  const handleResetFilters = useCallback(() => {
    setSearchText('');
    setDateFilter(null);
    setPaymentMethodFilter(null);
    setSortOrder('desc');
  }, []);

  const handleSelectBill = useCallback(
    (bill: Bill) => {
      if (selectedBill?.id !== bill.id) {
        setSelectedBill(bill);
      }
    },
    [selectedBill?.id]
  );

  const handleView = useCallback(() => {
    if (selectedBill) {
      setViewModalVisible(true);
    } else {
      toast.showToast(
        'Veuillez sélectionner une facture à visualiser.',
        'info'
      );
    }
  }, [selectedBill, toast]);

  const handleDeleteAll = useCallback(() => {
    Alert.alert(
      'Supprimer toutes les factures',
      'Êtes-vous sûr de vouloir supprimer toutes les factures ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessing(true);
              await BillManager.clearAllBills();
              setBills([]);
              setFilteredBills([]);
              setSelectedBill(null);
              toast.showToast(
                'Toutes les factures ont été supprimées.',
                'success'
              );
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              toast.showToast('Impossible de supprimer les factures.', 'error');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  }, [toast]);

  const handleDeleteBill = useCallback(async () => {
    if (!selectedBill) return;

    try {
      setProcessing(true);
      const updatedBills = bills.filter((bill) => bill.id !== selectedBill.id);
      await saveBills(updatedBills);

      setBills(updatedBills);
      setFilteredBills(sortBillsByDate(updatedBills, sortOrder));

      if (updatedBills.length > 0) {
        setSelectedBill(updatedBills[0]);
      } else {
        setSelectedBill(null);
      }

      setViewModalVisible(false);
      toast.showToast('Facture supprimée avec succès.', 'success');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.showToast('Impossible de supprimer la facture.', 'error');
    } finally {
      setProcessing(false);
    }
  }, [selectedBill, bills, sortOrder, sortBillsByDate, toast]);

  // Génération HTML
  const generateHTML = useCallback(
    (bill: Bill) => {
      const paymentLabel = bill.paymentMethod
        ? getPaymentMethodLabel(bill.paymentMethod)
        : '';
      const taxInfo = 'TVA non applicable - art.293B du CGI';

      const dateObj = new Date(bill.timestamp);
      const dateFormatted = dateObj.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const timeFormatted = dateObj.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const hasDetailedItems = bill.paidItems && bill.paidItems.length > 0;

      let itemsHTML = '';
      if (hasDetailedItems) {
        const itemsToShow = (bill.paidItems ?? []).slice(0, 20);
        itemsHTML = `
          <div class="items-section">
            <table style="width: 100%; border-collapse: collapse; margin: 5mm 0;">
              <tr>
                <th style="text-align: left;">Qté</th>
                <th style="text-align: left;">Article</th>
                <th style="text-align: right;">Prix</th>
              </tr>
              ${itemsToShow
                .map(
                  (item) => `
                <tr ${
                  item.offered
                    ? 'style="font-style: italic; color: #FF9800;"'
                    : ''
                }>
                  <td>${item.quantity}x</td>
                  <td>${item.name}${item.offered ? ' (Offert)' : ''}</td>
                  <td style="text-align: right;">${(
                    item.price * item.quantity
                  ).toFixed(2)}€</td>
                </tr>
              `
                )
                .join('')}
            </table>
          </div>
        `;
      }

      let offeredHTML = '';
      if (bill.offeredAmount && bill.offeredAmount > 0) {
        offeredHTML = `
          <div class="total-line" style="color: #FF9800; font-style: italic;">
            <span>Articles offerts:</span>
            <span>${bill.offeredAmount.toFixed(2)}€</span>
          </div>
        `;
      }

      return `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              @page { size: 80mm auto; margin: 0mm; }
              body { 
                font-family: 'Courier New', monospace; 
                width: 80mm;
                padding: 5mm;
                margin: 0;
                font-size: 14pt;
              }
              .header, .footer { 
                text-align: center; 
                margin-bottom: 5mm;
              }
              .header h1 {
                font-size: 18pt;
                margin: 0 0 2mm 0;
              }
              .header p, .footer p {
                margin: 0 0 1mm 0;
                font-size: 14pt;
              }
              .divider {
                border-bottom: 1px dashed #000;
                margin: 3mm 0;
              }
              .info {
                margin-bottom: 3mm;
              }
              .info p {
                margin: 0 0 1mm 0;
              }
              .totals {
                margin: 2mm 0;
              }
              .total-line {
                display: flex;
                justify-content: space-between;
                margin: 1mm 0;
                font-size: 16pt;
              }
              .total-amount {
                font-weight: bold;
                font-size: 16pt;
                text-align: right;
                margin: 2mm 0;
              }
              .payment-info {
                text-align: center;
                margin: 3mm 0;
                font-size: 14pt;
              }
              .payment-info p {
                margin: 0 0 1mm 0;
              }
              th, td {
                padding: 1mm 0;
                font-size: 14pt;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${restaurantInfo.name}</h1>
              <p>${restaurantInfo.address}</p>
              <p>${restaurantInfo.phone}</p>
            </div>

            <div class="divider"></div>
            
            <div class="info">
              <p><strong>${
                bill.tableName || `Table ${bill.tableNumber}`
              }</strong></p>
              <p>Date: ${dateFormatted} ${timeFormatted}</p>
              ${bill.section ? `<p>Section: ${bill.section}</p>` : ''}
              ${bill.guests ? `<p>Couverts: ${bill.guests}</p>` : ''}
            </div>

            <div class="divider"></div>

            ${itemsHTML}

            <div class="totals">
              <div class="total-line">
                <span>Articles:</span>
                <span>${
                  hasDetailedItems ? bill.paidItems?.length ?? 0 : bill.items
                }</span>
              </div>
              ${offeredHTML}
              <div class="total-amount">
                TOTAL: ${bill.amount.toFixed(2)}€
              </div>
            </div>

            <div class="divider"></div>

            <div class="payment-info">
              <p>Paiement: ${paymentLabel}</p>
              <p>Statut: ${bill.status}</p>
            </div>

            <div class="divider"></div>

            <div class="footer">
              <p>${taxInfo}</p>
              <p>Merci de votre visite!</p>
              <p>À bientôt, ${restaurantInfo.owner}</p>
            </div>
          </body>
        </html>
      `;
    },
    [getPaymentMethodLabel, restaurantInfo]
  );

  const handlePrint = useCallback(async () => {
    if (!selectedBill) {
      toast.showToast('Veuillez sélectionner une facture à imprimer.', 'info');
      return;
    }

    setProcessing(true);
    try {
      await Print.printAsync({
        html: generateHTML(selectedBill),
      });
      toast.showToast("Reçu envoyé à l'imprimante.", 'success');
    } catch (error) {
      console.error("Erreur d'impression:", error);
      toast.showToast("Impossible d'imprimer le reçu.", 'error');
    } finally {
      setProcessing(false);
    }
  }, [selectedBill, generateHTML, toast]);

  const handleShare = useCallback(async () => {
    if (!selectedBill) {
      toast.showToast('Veuillez sélectionner une facture à partager.', 'info');
      return;
    }

    setProcessing(true);
    try {
      const { uri } = await Print.printToFileAsync({
        html: generateHTML(selectedBill),
      });

      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
      });

      toast.showToast('Reçu partagé avec succès.', 'success');
    } catch (error) {
      console.error('Erreur de partage:', error);
      toast.showToast('Impossible de partager le reçu.', 'error');
    } finally {
      setProcessing(false);
    }
  }, [selectedBill, generateHTML, toast]);

  const handleExport = useCallback(async () => {
    if (!selectedBill) {
      toast.showToast('Veuillez sélectionner une facture à exporter.', 'info');
      return;
    }

    setProcessing(true);
    try {
      const { uri } = await Print.printToFileAsync({
        html: generateHTML(selectedBill),
      });

      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: 'Exporter le reçu en PDF',
      });

      toast.showToast('Reçu exporté avec succès.', 'success');
    } catch (error) {
      console.error("Erreur d'export:", error);
      toast.showToast("Impossible d'exporter le reçu.", 'error');
    } finally {
      setProcessing(false);
    }
  }, [selectedBill, generateHTML, toast]);

  const keyExtractor = useCallback((item: Bill, index: number) => {
    return item.id ? `bill-${item.id}` : `bill-index-${index}`;
  }, []);

  const renderBillItem = useCallback(
    ({ item }: { item: Bill }) => (
      <BillListItem
        bill={item}
        isSelected={selectedBill?.id === item.id}
        onSelect={handleSelectBill}
      />
    ),
    [selectedBill?.id, handleSelectBill]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement des factures...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Factures & Paiements</Text>
      </View>

      {bills.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Receipt size={60} color="#cccccc" />
          <Text style={styles.emptyText}>Aucune facture trouvée</Text>
          <Text style={styles.emptySubtext}>
            Les factures apparaîtront ici après les paiements
          </Text>
        </View>
      ) : (
        <View style={styles.mainContainer}>
          <FilterBar
            onSearch={handleSearch}
            onDateChange={handleDateFilter}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            onDeleteAll={handleDeleteAll}
            onDeleteFiltered={handleDeleteFiltered}
            searchText={searchText}
            selectedDate={dateFilter}
            onPaymentMethodChange={handlePaymentMethodFilter}
            selectedPaymentMethod={paymentMethodFilter}
            onResetFilters={handleResetFilters}
          />

          <View style={styles.content}>
            <View style={styles.billsList}>
              <Text style={styles.listTitle}>Historique des Factures</Text>
              <Text style={styles.billCount}>
                {appliedFilters.length} facture(s){' '}
                {appliedFilters.length !== bills.length
                  ? `(sur ${bills.length} total)`
                  : ''}
                {appliedFilters.length >= MAX_BILLS_DISPLAY && (
                  <Text style={styles.limitText}> - Affichage limité</Text>
                )}
              </Text>
              <FlatList
                data={appliedFilters}
                renderItem={renderBillItem}
                keyExtractor={keyExtractor}
                initialNumToRender={10}
                maxToRenderPerBatch={8}
                windowSize={15}
                removeClippedSubviews={true}
                updateCellsBatchingPeriod={50}
                extraData={selectedBill?.id}
                getItemLayout={(data, index) => ({
                  length: ITEM_HEIGHT,
                  offset: ITEM_HEIGHT * index,
                  index,
                })}
              />
            </View>

            <View style={styles.billDetails}>
              {selectedBill ? (
                <>
                  <View style={styles.selectedBillHeader}>
                    <View style={{ flexDirection: 'row' }}>
                      <Text style={styles.selectedBillTitle}>
                        {selectedBill.tableName ||
                          `Table ${selectedBill.tableNumber}`}
                      </Text>
                      {selectedBill.section && (
                        <View style={styles.sectionBadge}>
                          <Text style={styles.sectionText}>
                            {selectedBill.section}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.selectedBillStatus,
                        { color: getBillStatusColor(selectedBill) },
                      ]}
                    >
                      {selectedBill.status === 'split' &&
                      selectedBill.paymentType === 'custom'
                        ? 'Custom'
                        : selectedBill.status === 'split' &&
                          selectedBill.paymentType === 'split'
                        ? 'Split'
                        : selectedBill.status}
                    </Text>
                  </View>

                  <View style={styles.billDetailsContent}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Date:</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedBill.timestamp).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Montant:</Text>
                      <Text style={styles.detailAmount}>
                        {selectedBill.amount.toFixed(2)} €
                      </Text>
                    </View>
                    {/* ✅ NOUVEAU: Affichage du nombre de couverts */}
                    {selectedBill.guests && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Couverts:</Text>
                        <Text style={styles.detailValue}>
                          {selectedBill.guests}
                        </Text>
                      </View>
                    )}
                    {selectedBill.paymentMethod && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>
                          Mode de paiement:
                        </Text>
                        <Text style={styles.detailValue}>
                          {getPaymentMethodLabel(selectedBill.paymentMethod)}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.actionsContainer}>
                    <Pressable style={styles.actionButton} onPress={handleView}>
                      <Eye size={20} color="#2196F3" />
                      <Text style={[styles.actionText, { color: '#2196F3' }]}>
                        Voir
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionButton}
                      onPress={handlePrint}
                    >
                      <Printer size={20} color="#4CAF50" />
                      <Text style={[styles.actionText, { color: '#4CAF50' }]}>
                        Imprimer
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionButton}
                      onPress={handleExport}
                    >
                      <Download size={20} color="#FF9800" />
                      <Text style={[styles.actionText, { color: '#FF9800' }]}>
                        Exporter
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionButton}
                      onPress={() => {
                        Alert.alert(
                          'Supprimer la facture',
                          'Êtes-vous sûr de vouloir supprimer cette facture ?',
                          [
                            { text: 'Annuler', style: 'cancel' },
                            {
                              text: 'Supprimer',
                              style: 'destructive',
                              onPress: handleDeleteBill,
                            },
                          ]
                        );
                      }}
                    >
                      <Trash2 size={20} color="#F44336" />
                      <Text style={[styles.actionText, { color: '#F44336' }]}>
                        Supprimer
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <View style={styles.noBillSelected}>
                  <Text style={styles.noBillText}>
                    Sélectionnez une facture pour voir les détails
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      <ViewReceiptModal
        visible={viewModalVisible}
        bill={selectedBill}
        onClose={() => setViewModalVisible(false)}
        onPrint={handlePrint}
        onShare={handleShare}
        onDelete={handleDeleteBill}
      />

      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.processingText}>Traitement en cours...</Text>
        </View>
      )}
    </View>
  );
}

// Styles corrigés (sans margin/marginHorizontal dans les objets JavaScript)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: { marginTop: 20, fontSize: 18, fontWeight: 'bold', color: '#666' },
  emptySubtext: {
    marginTop: 8,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  title: { fontSize: 24, fontWeight: 'bold' },
  mainContainer: { flex: 1, flexDirection: 'column' },
  content: { flex: 1, flexDirection: 'row' },
  filterBar: {
    padding: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: { flex: 1, height: 40, marginLeft: 8 },
  filterActions: { flexDirection: 'row', paddingVertical: 8 },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  filterButtonText: { marginLeft: 8, color: '#2196F3', fontWeight: '500' },
  billsList: {
    width: 300,
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    padding: 16,
  },
  listTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  billCount: { fontSize: 14, color: '#666', marginBottom: 16 },
  limitText: { color: '#FF9800', fontWeight: '600' },
  billListItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 8,
    borderRadius: 6,
    height: ITEM_HEIGHT,
  },
  selectedBillItem: {
    backgroundColor: '#e3f2fd',
    borderBottomColor: '#2196F3',
  },
  billItemTable: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
  billItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  billItemAmount: { fontSize: 14, fontWeight: '600' },
  billItemStatus: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  billItemGuests: { fontSize: 12, color: '#666', marginBottom: 4 }, // ✅ NOUVEAU
  billItemDate: { fontSize: 12, color: '#666' },
  billDetails: {
    flex: 1,
    padding: 20,
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  noBillSelected: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noBillText: { fontSize: 16, color: '#666', fontStyle: 'italic' },
  selectedBillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectedBillTitle: { fontSize: 24, fontWeight: '600', marginBottom: 8 },
  sectionBadge: {
    marginLeft: 12,
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  sectionText: { color: '#0288D1', fontWeight: '600', fontSize: 12 },
  selectedBillStatus: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  billDetailsContent: { marginBottom: 20 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: { fontSize: 16, color: '#666' },
  detailValue: { fontSize: 16, fontWeight: '500' },
  detailAmount: { fontSize: 18, fontWeight: '600', color: '#4CAF50' },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  actionText: { fontSize: 16, fontWeight: '500' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptModalContent: {
    backgroundColor: 'white',
    width: '60%',
    height: '80%',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  closeButton: { padding: 5 },
  receiptContent: { flex: 1 },
  restaurantInfo: { alignItems: 'center', marginBottom: 20 },
  restaurantName: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  restaurantAddress: { fontSize: 14, color: '#666', marginBottom: 2 },
  restaurantPhone: { fontSize: 14, color: '#666' },
  receiptDivider: { height: 1, backgroundColor: '#ddd', marginVertical: 16 },
  billInfo: { marginBottom: 16 },
  billTable: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  billDate: { fontSize: 14, color: '#666', marginBottom: 4 },
  billSection: { fontSize: 14, color: '#0288D1' },
  billGuests: { fontSize: 14, color: '#666', marginBottom: 4 }, // ✅ NOUVEAU
  billSummary: { marginBottom: 16 },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  billLabel: { fontSize: 16, color: '#666' },
  billValue: { fontSize: 16, fontWeight: '500' },
  billAmount: { fontSize: 18, fontWeight: '600', color: '#4CAF50' },
  billStatus: { fontSize: 16, fontWeight: '600', textTransform: 'uppercase' },
  receiptFooter: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  receiptActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 16,
  },
  receiptAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  receiptActionText: { fontSize: 16, fontWeight: '500' },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: { color: 'white', marginTop: 12, fontSize: 16 },
  clearButton: { marginLeft: 8, padding: 4 },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  paymentPickerContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
    minWidth: 200,
  },
  paymentButtonContainer: { position: 'relative' },
  paymentOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectedPaymentOption: { backgroundColor: '#E3F2FD' },
  paymentOptionText: { fontSize: 16, color: '#333' },
  itemsContainer: { marginBottom: 16 },
  itemsHeader: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemDetails: { flexDirection: 'row', flex: 1, alignItems: 'center' },
  itemQuantity: { fontSize: 14, marginRight: 8, width: 30 },
  itemName: { fontSize: 14, flex: 1 },
  itemPrice: { fontSize: 14, fontWeight: '500' },
  offeredItemText: { fontStyle: 'italic', color: '#FF9800' },
  offeredItemPrice: { textDecorationLine: 'line-through', color: '#FF9800' },
  billOfferedLabel: { fontSize: 14, color: '#FF9800', fontWeight: '500' },
  billOfferedValue: { fontSize: 14, fontWeight: '600', color: '#FF9800' },
});
