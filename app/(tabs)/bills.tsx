// app/(tabs)/bills.tsx - VERSION CORRIGÉE AVEC GESTION AMÉLIORÉE
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

// Fonctions utilitaires pour les calculs
const calculateOriginalTotal = (bill: Bill) => {
  const hasDetailedItems = bill.paidItems && bill.paidItems.length > 0;
  if (bill.paymentType === 'custom' && hasDetailedItems) {
    return calculateTotalFromItems(bill);
  }
  if (bill.paymentType === 'split') {
    return bill.amount * (bill.guests ?? 1);
  }
  return bill.amount;
};

const getPaymentContext = (bill: Bill) => {
  const originalTotal = calculateOriginalTotal(bill);
  switch (bill.paymentType) {
    case 'split':
      return {
        type: 'Paiement partagé',
        detail: `Cette addition a été divisée en ${bill.guests || 2} parts`,
        originalTotal: originalTotal,
        paidAmount: bill.amount,
        showBreakdown: true,
      };
    case 'custom':
      return {
        type: 'Paiement personnalisé',
        detail: 'Montant partiel payé par le client',
        originalTotal: originalTotal,
        paidAmount: bill.amount,
        showBreakdown: true,
      };
    case 'items':
      return {
        type: 'Paiement par articles',
        detail: 'Articles sélectionnés uniquement',
        originalTotal: bill.amount,
        paidAmount: bill.amount,
        showBreakdown: false,
      };
    default:
      return {
        type: 'Paiement complet',
        detail: 'Facture payée intégralement',
        originalTotal: bill.amount,
        paidAmount: bill.amount,
        showBreakdown: false,
      };
  }
};

const calculateTotalFromItems = (bill: Bill) => {
  if (!bill.paidItems || bill.paidItems.length === 0) return bill.amount;
  if (bill.paymentType === 'split' && bill.guests) {
    return bill.amount * bill.guests;
  }
  return bill.paidItems.reduce((total, item) => {
    if (item.offered) return total;
    return total + item.price * item.quantity;
  }, 0);
};

const getItemsDisplay = (bill: Bill) => {
  if (!bill.paidItems || bill.paidItems.length === 0) return [];
  if (bill.paymentType === 'split' && bill.guests) {
    return bill.paidItems.map((item) => ({
      ...item,
      quantity: Math.round(item.quantity * (bill.guests ?? 1)),
      isOriginalQuantity: true,
    }));
  }
  return bill.paidItems.map((item) => ({
    ...item,
    isOriginalQuantity: false,
  }));
};

const getPaymentInfo = (bill: Bill) => {
  const context = getPaymentContext(bill);
  const isTotalPaid = context.originalTotal === bill.amount;

  if (bill.paymentType === 'split') {
    return {
      showContext: true,
      contextText: context.detail,
      paidText: isTotalPaid
        ? `Montant total: ${bill.amount.toFixed(2)} €`
        : `Montant payé: ${bill.amount.toFixed(2)} €`,
      originalText: `Total original: ${context.originalTotal.toFixed(2)} €`,
      breakdown: context.showBreakdown,
    };
  }

  if (bill.paymentType === 'custom') {
    return {
      showContext: true,
      contextText: context.detail,
      paidText: isTotalPaid
        ? `Montant total: ${bill.amount.toFixed(2)} €`
        : `Montant payé: ${bill.amount.toFixed(2)} €`,
      originalText: `Total estimé: ${context.originalTotal.toFixed(2)} €`,
      breakdown: context.showBreakdown,
    };
  }

  if (bill.paymentType === 'items') {
    return {
      showContext: true,
      contextText: context.detail,
      paidText: `Montant payé: ${bill.amount.toFixed(2)} €`,
      originalText: '',
      breakdown: false,
    };
  }

  return {
    showContext: true,
    contextText: context.detail,
    paidText: `Montant total: ${bill.amount.toFixed(2)} €`,
    originalText: '',
    breakdown: false,
  };
};

// Modal de visualisation complète
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

    const hasDetailedItems = bill.paidItems && bill.paidItems.length > 0;
    const paymentInfo = getPaymentInfo(bill);
    const paymentLabel = bill.paymentMethod
      ? getPaymentMethodLabel(bill.paymentMethod)
      : 'Non spécifié';
    const totalFromItems = calculateTotalFromItems(bill);
    const context = getPaymentContext(bill);
    const itemsToDisplay = hasDetailedItems ? getItemsDisplay(bill) : [];

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
              <Text style={styles.modalTitle}>Reçu - {context.type}</Text>
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
                {bill.section && (
                  <Text style={styles.billSection}>
                    Section: {bill.section}
                  </Text>
                )}
                {bill.guests && (
                  <Text style={styles.billGuests}>Couverts: {bill.guests}</Text>
                )}
              </View>
              <View style={styles.receiptDivider} />

              {hasDetailedItems && (
                <View style={styles.itemsContainer}>
                  <Text style={styles.itemsHeader}>Articles</Text>
                  {itemsToDisplay.slice(0, 20).map((item, index) => (
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
                      <View style={styles.itemPriceContainer}>
                        <Text
                          style={[
                            styles.itemPrice,
                            item.offered && styles.offeredPrice,
                          ]}
                        >
                          {(item.price * item.quantity).toFixed(2)} €
                        </Text>
                        {item.paymentPercentage &&
                          item.paymentPercentage < 100 && (
                            <Text style={styles.itemPaidPortion}>
                              (Payé: {item.paymentPercentage}%)
                            </Text>
                          )}
                      </View>
                    </View>
                  ))}
                  <View style={styles.receiptDivider} />
                </View>
              )}

              <View style={styles.billSummary}>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Articles:</Text>
                  <Text style={styles.billValue}>
                    {hasDetailedItems ? itemsToDisplay.length : bill.items}
                  </Text>
                </View>
                {(bill.offeredAmount ?? 0) > 0 && (
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Articles offerts:</Text>
                    <Text style={styles.billValue}>
                      {(bill.offeredAmount ?? 0).toFixed(2)} €
                    </Text>
                  </View>
                )}
                {context.showBreakdown && (
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Total original:</Text>
                    <Text style={styles.billOriginalAmount}>
                      {context.originalTotal.toFixed(2)} €
                    </Text>
                  </View>
                )}
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>MONTANT PAYÉ:</Text>
                  <Text style={styles.billAmount}>
                    {bill.amount.toFixed(2)} €
                  </Text>
                </View>
              </View>

              <View style={styles.paymentContextBox}>
                <Text style={styles.paymentContextTitle}>{context.type}</Text>
                <Text style={styles.paymentContextDetail}>
                  {context.detail}
                </Text>
                {paymentInfo.breakdown && (
                  <View style={styles.paymentBreakdown}>
                    {paymentInfo.originalText && (
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>
                          Total original:
                        </Text>
                        <Text style={styles.breakdownAmount}>
                          {context.originalTotal.toFixed(2)} €
                        </Text>
                      </View>
                    )}
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Montant payé:</Text>
                      <Text style={styles.breakdownPaidAmount}>
                        {bill.amount.toFixed(2)} €
                      </Text>
                    </View>
                  </View>
                )}
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodLabel}>
                    Mode de paiement:
                  </Text>
                  <Text style={styles.paymentMethodValue}>{paymentLabel}</Text>
                </View>
                <View style={styles.paymentStatusInfo}>
                  <Text style={styles.paymentStatusLabel}>Statut:</Text>
                  <Text
                    style={[
                      styles.paymentStatusValue,
                      { color: getBillStatusColor(bill) },
                    ]}
                  >
                    {bill.status === 'split' && bill.paymentType === 'custom'
                      ? 'Personnalisé'
                      : bill.status === 'split' && bill.paymentType === 'split'
                      ? 'Partagé'
                      : bill.status === 'paid'
                      ? 'Payé'
                      : bill.status}
                  </Text>
                </View>
              </View>
              <View style={styles.receiptDivider} />
              <Text style={styles.receiptFooter}>Merci de votre visite!</Text>
            </ScrollView>
            <View style={styles.receiptActions}>
              <Pressable style={styles.receiptAction} onPress={onPrint}>
                <Printer size={20} color="#000" />
                <Text style={styles.receiptActionText}>Imprimer</Text>
              </Pressable>
              <Pressable style={styles.receiptAction} onPress={onShare}>
                <ShareIcon size={20} color="#000" />
                <Text style={styles.receiptActionText}>Partager</Text>
              </Pressable>
              <Pressable style={styles.receiptAction} onPress={handleDelete}>
                <Trash2 size={20} color="#000" />
                <Text style={styles.receiptActionText}>Supprimer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
);

// Barre de filtres
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
  hasFiltersActive: boolean;
  filteredBillsCount: number;
  totalBillsCount: number;
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
    hasFiltersActive,
    filteredBillsCount,
    totalBillsCount,
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

        {/* ✅ NOUVEAU: Indicateur de filtrage actif */}
        {hasFiltersActive && (
          <View style={styles.filterStatus}>
            <Text style={styles.filterStatusText}>
              Affichage: {filteredBillsCount} sur {totalBillsCount} factures
            </Text>
            <Pressable
              onPress={onResetFilters}
              style={styles.clearFiltersButton}
            >
              <X size={16} color="#F44336" />
              <Text style={styles.clearFiltersText}>Tout afficher</Text>
            </Pressable>
          </View>
        )}

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

// Item de facture
interface BillListItemProps {
  bill: Bill;
  isSelected: boolean;
  onSelect: (bill: Bill) => void;
}

const BillListItem = memo<BillListItemProps>(
  ({ bill, isSelected, onSelect }) => {
    const { paymentMethods } = useSettings();

    const handlePress = useCallback(() => {
      onSelect(bill);
    }, [bill, onSelect]);

    const statusColor = getBillStatusColor(bill);
    const context = getPaymentContext(bill);

    const formattedDate = useMemo(() => {
      const date = new Date(bill.timestamp);
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }, [bill.timestamp]);

    const paymentMethodLabel = useMemo(() => {
      if (!bill.paymentMethod) return 'Non spécifié';

      const method = paymentMethods.find((m) => m.id === bill.paymentMethod);
      return method ? method.name : bill.paymentMethod;
    }, [bill.paymentMethod, paymentMethods]);

    const totalDisplay = useMemo(() => {
      if (context.originalTotal !== bill.amount) {
        return `${context.originalTotal.toFixed(
          2
        )}€ (payé: ${bill.amount.toFixed(2)}€)`;
      }
      return `${bill.amount.toFixed(2)}€`;
    }, [context.originalTotal, bill.amount]);

    return (
      <Pressable
        style={[styles.billListItem, isSelected && styles.selectedBillItem]}
        onPress={handlePress}
      >
        <View style={styles.billItemHeader}>
          <Text style={styles.billItemTable} numberOfLines={1}>
            {bill.tableName || `Table ${bill.tableNumber}`}
          </Text>
          <Text style={styles.billItemDate}>{formattedDate}</Text>
        </View>
        <View style={styles.billItemMain}>
          <View style={styles.billItemAmountSection}>
            <Text style={styles.billItemAmount} numberOfLines={1}>
              {totalDisplay}
            </Text>
            <Text style={styles.billItemPaymentMethod} numberOfLines={1}>
              {paymentMethodLabel}
            </Text>
          </View>
          <View style={styles.billItemStatus}>
            <Text style={[styles.billItemStatusText, { color: statusColor }]}>
              {bill.status === 'split' && bill.paymentType === 'custom'
                ? 'Custom'
                : bill.status === 'split' && bill.paymentType === 'split'
                ? 'Split'
                : bill.status}
            </Text>
            {bill.guests && (
              <Text style={styles.billItemGuests}>{bill.guests}👥</Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  }
);

// Composant principal
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

  // ✅ NOUVEAU: Fonction pour charger les factures selon les filtres
  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      const hasActiveFilters =
        searchText.trim() || dateFilter || paymentMethodFilter;

      if (hasActiveFilters) {
        // ✅ Si il y a des filtres actifs, charger TOUTES les factures filtrées
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
        setFilteredBills(filtered);
      } else {
        // ✅ Si pas de filtres, charger seulement les 200 DERNIÈRES factures
        const allBills = await getBills();
        // Trier par date décroissante et prendre les 200 premières (= les plus récentes)
        const sortedBills = allBills.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const recentBills = sortedBills.slice(0, MAX_BILLS_DISPLAY);
        setFilteredBills(recentBills);
      }
    } catch (error) {
      console.error('Error loading bills:', error);
      toast.showToast('Impossible de charger les factures.', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchText, dateFilter, paymentMethodFilter, toast]);

  // ✅ Charger le nombre total de factures pour l'affichage
  useEffect(() => {
    const loadAllBillsCount = async () => {
      try {
        const allBills = await getBills();
        setBills(allBills); // Garder toutes les factures pour les stats
      } catch (error) {
        console.error('Error loading bills count:', error);
      }
    };
    loadAllBillsCount();
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

  // ✅ CORRIGÉ: Supprimer les factures filtrées - version sécurisée
  const handleDeleteFiltered = useCallback(() => {
    if (filteredBills.length === 0) {
      toast.showToast('Aucune facture à supprimer.', 'info');
      return;
    }

    const hasActiveFilters =
      searchText.trim() || dateFilter || paymentMethodFilter;

    if (!hasActiveFilters) {
      toast.showToast(
        "Veuillez d'abord appliquer des filtres pour supprimer une sélection spécifique.",
        'warning'
      );
      return;
    }

    Alert.alert(
      'Supprimer les factures filtrées',
      `Êtes-vous sûr de vouloir supprimer ${filteredBills.length} facture(s) filtrée(s) ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessing(true);
              const billIdsToDelete = new Set(
                filteredBills
                  .map((bill) => bill.id)
                  .filter((id) => id !== undefined)
              );

              const remainingBills = bills.filter(
                (bill) => !billIdsToDelete.has(bill.id)
              );

              await saveBills(remainingBills);
              setBills(remainingBills);
              await loadBills();

              if (selectedBill && billIdsToDelete.has(selectedBill.id)) {
                setSelectedBill(null);
              }

              toast.showToast(
                `${billIdsToDelete.size} facture(s) supprimée(s).`,
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
  }, [
    filteredBills,
    bills,
    selectedBill,
    loadBills,
    toast,
    searchText,
    dateFilter,
    paymentMethodFilter,
  ]);

  // ✅ Filtres appliqués avec vérification des factures vides
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

  // ✅ NOUVEAU: Indicateur de filtres actifs
  const hasActiveFilters = useMemo(() => {
    return !!(searchText.trim() || dateFilter || paymentMethodFilter);
  }, [searchText, dateFilter, paymentMethodFilter]);

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

  // ✅ CORRIGÉ: Supprimer toutes les factures - version sécurisée
  const handleDeleteAll = useCallback(() => {
    if (bills.length === 0) {
      toast.showToast('Aucune facture à supprimer.', 'info');
      return;
    }

    Alert.alert(
      'Supprimer toutes les factures',
      `Êtes-vous sûr de vouloir supprimer TOUTES les ${bills.length} facture(s) ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer toutes',
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
  }, [bills.length, toast]);

  // ✅ CORRIGÉ: Supprimer une facture spécifique - version sécurisée
  const handleDeleteBill = useCallback(async () => {
    if (!selectedBill || !selectedBill.id) {
      toast.showToast('Facture non valide.', 'error');
      return;
    }

    try {
      setProcessing(true);
      const updatedBills = bills.filter((bill) => bill.id !== selectedBill.id);
      await saveBills(updatedBills);
      setBills(updatedBills);
      await loadBills();

      setSelectedBill(null);
      setViewModalVisible(false);
      toast.showToast('Facture supprimée avec succès.', 'success');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.showToast('Impossible de supprimer la facture.', 'error');
    } finally {
      setProcessing(false);
    }
  }, [selectedBill, bills, loadBills, toast]);

  const getPaymentTypeDisplayName = (paymentType?: string): string => {
    switch (paymentType) {
      case 'split':
        return 'PAIEMENT PARTAGÉ';
      case 'custom':
        return 'PAIEMENT PARTIEL';
      case 'items':
        return 'PAIEMENT PAR ARTICLES';
      case 'full':
      default:
        return 'PAIEMENT COMPLET';
    }
  };

  const getPaymentDescription = (
    paymentType?: string,
    guests?: number
  ): string => {
    switch (paymentType) {
      case 'split':
        return `<div style="margin: 2mm 0;">Addition divisée en ${
          guests || 2
        } parts</div>`;
      case 'custom':
        return `<div style="margin: 2mm 0;">Montant partiel payé par le client</div>`;
      case 'items':
        return `<div style="margin: 2mm 0;">Articles sélectionnés uniquement</div>`;
      default:
        return '';
    }
  };

  // ✅ Génération HTML SIMPLIFIÉE pour les tickets depuis Bills
  const generateHTML = useCallback(
    (bill: Bill, currentZNumber?: number, isZReport: boolean = false) => {
      const paymentLabel = bill.paymentMethod
        ? getPaymentMethodLabel(bill.paymentMethod)
        : 'Non spécifié';
      const dateObj = new Date(bill.timestamp);
      const dateFormatted = dateObj.toLocaleDateString('fr-FR');
      const timeFormatted = dateObj.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const hasDetailedItems = bill.paidItems && bill.paidItems.length > 0;
      const itemsToDisplay = hasDetailedItems ? getItemsDisplay(bill) : [];

      // ✅ NOUVEAU: Version simplifiée pour les tickets depuis Bills
      let itemsHTML = '';
      if (hasDetailedItems && itemsToDisplay.length > 0) {
        itemsHTML = `
        <table style="width: 100%; border-collapse: collapse; margin: 5mm 0;">
          <tr>
            <th style="text-align: left; font-size: 12pt;">Qté</th>
            <th style="text-align: left; font-size: 12pt;">Article</th>
            <th style="text-align: right; font-size: 12pt;">Prix</th>
          </tr>
          ${itemsToDisplay
            .slice(0, 20)
            .map(
              (item) => `
            <tr ${item.offered ? 'style="font-style: italic;"' : ''}>
              <td style="font-size: 14pt; padding: 2mm 0;">${
                item.quantity
              }x</td>
              <td style="font-size: 14pt; padding: 2mm 0;">${item.name}${
                item.offered ? ' (Offert)' : ''
              }</td>
              <td style="text-align: right; font-size: 14pt; padding: 2mm 0;">${(
                item.price * item.quantity
              ).toFixed(2)}€</td>
            </tr>
          `
            )
            .join('')}
        </table>
      `;
      }

      // ✅ Articles offerts si applicable (simplifié)
      let offeredHTML = '';
      if ((bill.offeredAmount ?? 0) > 0) {
        offeredHTML = `
        <div style="font-style: italic; margin: 3mm 0; font-size: 14pt;">
          Articles offerts: ${(bill.offeredAmount ?? 0).toFixed(2)}€
        </div>
      `;
      }

      // ✅ NOUVEAU: Section de paiement ULTRA-SIMPLIFIÉE comme dans full.tsx
      const paymentSectionHTML = `
      <div style="border: 1px solid #000; padding: 3mm; margin: 3mm 0; text-align: center;">
        <div style="font-weight: bold; font-size: 16pt; margin-bottom: 2mm;">
          TOTAL PAYÉ: ${bill.amount.toFixed(2)}€
        </div>
        <div style="font-size: 14pt;">Méthode: ${paymentLabel}</div>
      </div>
    `;

      // ✅ En-tête spécial pour rapport Z seulement
      let headerExtension = '';
      if (isZReport && currentZNumber) {
        headerExtension = `
        <div style="text-align: center; font-weight: bold; margin: 3mm 0;">
          RAPPORT Z N° ${currentZNumber}
        </div>
      `;
      }

      return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @page { size: 80mm auto; margin: 0mm; }
            body {
              font-family: 'Courier New', monospace;
              width: 80mm;
              padding: 5mm;
              margin: 0;
              font-size: 14pt;
            }
            .header {
              text-align: center;
              margin-bottom: 5mm;
            }
            .header h1 {
              font-size: 18pt;
              margin: 0 0 2mm 0;
            }
            .header p {
              margin: 0 0 1mm 0;
              font-size: 15pt;
            }
            .divider {
              border-bottom: 1px dashed #000;
              margin: 4mm 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              padding: 1mm 0;
              font-size: 14pt;
            }
            .timestamp {
              font-size: 13pt;
            }
            .table-info {
              font-size: 15pt;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${restaurantInfo.name}</h1>
            <p>${restaurantInfo.address}</p>
            <p>${restaurantInfo.phone}</p>
            ${restaurantInfo.siret ? `<p>${restaurantInfo.siret}</p>` : ''}
          </div>

          ${headerExtension}

          <div class="divider"></div>
          
          <p class="table-info">${
            bill.tableName || `Table ${bill.tableNumber}`
          }</p>
          <p class="timestamp">${dateFormatted} à ${timeFormatted}</p>

          <div class="divider"></div>

          ${itemsHTML}

          <div style="margin: 3mm 0;">
            <div>Articles: ${
              hasDetailedItems ? itemsToDisplay.length : bill.items
            }</div>
            ${offeredHTML}
          </div>

          ${paymentSectionHTML}

          <div class="divider"></div>

          <div style="text-align: center;">
            <p>${
              restaurantInfo.taxInfo || 'TVA non applicable - art.293B du CGI'
            }</p>
            <p>Merci de votre visite!</p>
            ${
              restaurantInfo.owner
                ? `<p>À bientôt, ${restaurantInfo.owner}</p>`
                : ''
            }
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

      {/* ✅ AMÉLIORÉ: Gestion du cas sans factures */}
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
            hasFiltersActive={hasActiveFilters}
            filteredBillsCount={appliedFilters.length}
            totalBillsCount={bills.length}
          />

          <View style={styles.content}>
            <View style={styles.billsList}>
              <Text style={styles.listTitle}>Historique des Factures</Text>

              {/* ✅ NOUVEAU: Affichage amélioré du statut */}
              <View style={styles.billCountContainer}>
                <Text style={styles.billCount}>
                  {appliedFilters.length} facture(s) affichée(s)
                  {hasActiveFilters && (
                    <Text style={styles.filterIndicator}> (filtrées)</Text>
                  )}
                </Text>
                {!hasActiveFilters && bills.length > MAX_BILLS_DISPLAY && (
                  <Text style={styles.limitText}>
                    Les 200 plus récentes sur {bills.length} total
                  </Text>
                )}
                {hasActiveFilters && (
                  <Text style={styles.totalBillsText}>
                    Total: {bills.length} factures
                  </Text>
                )}
              </View>

              {/* ✅ AMÉLIORÉ: Gestion du cas sans factures filtrées */}
              {appliedFilters.length === 0 ? (
                <View style={styles.noResultsContainer}>
                  <Receipt size={40} color="#cccccc" />
                  <Text style={styles.noResultsText}>
                    {hasActiveFilters
                      ? 'Aucune facture ne correspond aux filtres'
                      : 'Aucune facture récente'}
                  </Text>
                  {hasActiveFilters && (
                    <Pressable
                      style={styles.resetFiltersButton}
                      onPress={handleResetFilters}
                    >
                      <Text style={styles.resetFiltersButtonText}>
                        Effacer les filtres
                      </Text>
                    </Pressable>
                  )}
                </View>
              ) : (
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
              )}
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
                      {getPaymentContext(selectedBill).type}
                    </Text>
                  </View>

                  <ScrollView
                    style={styles.billDetailsScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.billDetailsContent}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Date:</Text>
                        <Text style={styles.detailValue}>
                          {new Date(selectedBill.timestamp).toLocaleString()}
                        </Text>
                      </View>

                      {(() => {
                        const context = getPaymentContext(selectedBill);
                        if (context.originalTotal !== selectedBill.amount) {
                          return (
                            <>
                              <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>
                                  Total de la facture:
                                </Text>
                                <Text style={styles.detailOriginalAmount}>
                                  {context.originalTotal.toFixed(2)} €
                                </Text>
                              </View>
                              <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>
                                  Montant payé:
                                </Text>
                                <Text style={styles.detailAmount}>
                                  {selectedBill.amount.toFixed(2)} €
                                </Text>
                              </View>
                            </>
                          );
                        } else {
                          return (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>
                                Montant total:
                              </Text>
                              <Text style={styles.detailAmount}>
                                {selectedBill.amount.toFixed(2)} €
                              </Text>
                            </View>
                          );
                        }
                      })()}

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

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>
                          Type de paiement:
                        </Text>
                        <Text style={styles.detailValue}>
                          {getPaymentContext(selectedBill).type}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Statut:</Text>
                        <Text
                          style={[
                            styles.detailValue,
                            { color: getBillStatusColor(selectedBill) },
                          ]}
                        >
                          {selectedBill.status === 'paid'
                            ? 'Payé'
                            : selectedBill.status}
                        </Text>
                      </View>

                      <View style={styles.paymentDetailsSection}>
                        <Text style={styles.paymentDetailsSectionTitle}>
                          {getPaymentContext(selectedBill).type}
                        </Text>
                        <View style={styles.paymentContextInfo}>
                          <Text style={styles.paymentContextText}>
                            {getPaymentContext(selectedBill).detail}
                          </Text>
                        </View>

                        <View style={styles.paymentAmountBox}>
                          <Text style={styles.paymentAmountLabel}>
                            Montant payé:
                          </Text>
                          <Text style={styles.paymentAmountValue}>
                            {selectedBill.amount.toFixed(2)} €
                          </Text>
                        </View>

                        {selectedBill.paymentMethod && (
                          <View style={styles.paymentMethodBox}>
                            <Text style={styles.paymentMethodText}>
                              {getPaymentMethodLabel(
                                selectedBill.paymentMethod
                              )}
                            </Text>
                          </View>
                        )}
                      </View>

                      {selectedBill.paidItems &&
                        selectedBill.paidItems.length > 0 && (
                          <View style={styles.itemsSection}>
                            <Text style={styles.itemsSectionTitle}>
                              Articles ({selectedBill.paidItems.length})
                            </Text>
                            {getItemsDisplay(selectedBill)
                              .slice(0, 10)
                              .map((item, index) => (
                                <View key={index} style={styles.itemDetailRow}>
                                  <Text style={styles.itemDetailQuantity}>
                                    {item.quantity}x
                                  </Text>
                                  <Text style={styles.itemDetailName}>
                                    {item.name}
                                    {item.offered && ' (Offert)'}
                                  </Text>
                                  <Text style={styles.itemDetailPrice}>
                                    {(item.price * item.quantity).toFixed(2)} €
                                  </Text>
                                </View>
                              ))}
                            {selectedBill.paidItems.length > 10 && (
                              <Text style={styles.itemsMoreText}>
                                ... et {selectedBill.paidItems.length - 10}{' '}
                                autres articles
                              </Text>
                            )}
                          </View>
                        )}
                    </View>
                  </ScrollView>

                  <View style={styles.actionsContainer}>
                    <Pressable style={styles.actionButton} onPress={handleView}>
                      <Eye size={18} color="#2196F3" />
                      <Text style={[styles.actionText, { color: '#2196F3' }]}>
                        Voir
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionButton}
                      onPress={handlePrint}
                    >
                      <Printer size={18} color="#4CAF50" />
                      <Text style={[styles.actionText, { color: '#4CAF50' }]}>
                        Imprimer
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionButton}
                      onPress={handleExport}
                    >
                      <Download size={18} color="#FF9800" />
                      <Text style={[styles.actionText, { color: '#FF9800' }]}>
                        Exporter
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionButton}
                      onPress={() => {
                        Alert.alert(
                          'Supprimer cette facture',
                          `Êtes-vous sûr de vouloir supprimer la facture de ${
                            selectedBill.tableName ||
                            `Table ${selectedBill.tableNumber}`
                          } ?`,
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
                      <Trash2 size={18} color="#F44336" />
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

// ✅ STYLES AMÉLIORÉS
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

  // ✅ NOUVEAUX STYLES pour le statut de filtrage
  filterStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  filterStatusText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  clearFiltersText: {
    fontSize: 12,
    color: '#F44336',
    fontWeight: '500',
  },

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

  // ✅ NOUVEAUX STYLES pour le compteur amélioré
  billCountContainer: {
    marginBottom: 16,
  },
  billCount: { fontSize: 14, color: '#666', marginBottom: 4 },
  filterIndicator: { color: '#2196F3', fontWeight: '600' },
  limitText: {
    color: '#FF9800',
    fontWeight: '600',
    fontSize: 12,
    fontStyle: 'italic',
  },
  totalBillsText: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
  },

  // ✅ NOUVEAUX STYLES pour l'absence de résultats
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  resetFiltersButton: {
    marginTop: 16,
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  resetFiltersButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  billListItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 6,
    borderRadius: 6,
    height: ITEM_HEIGHT,
    justifyContent: 'space-between',
  },
  selectedBillItem: {
    backgroundColor: '#e3f2fd',
    borderBottomColor: '#2196F3',
  },
  billItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  billItemTable: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  billItemDate: {
    fontSize: 11,
    color: '#666',
    flexShrink: 0,
  },
  billItemMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  billItemAmountSection: {
    flex: 1,
    marginRight: 8,
  },
  billItemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  billItemPaymentMethod: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
    marginTop: 2,
  },
  billItemStatus: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  billItemStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  billItemGuests: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
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
  billDetailsScroll: {
    flex: 1,
    marginBottom: 16,
  },
  billDetailsContent: {
    paddingBottom: 16,
  },
  paymentDetailsSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  paymentDetailsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2196F3',
    marginBottom: 8,
  },
  paymentContextInfo: {
    marginBottom: 12,
  },
  paymentContextText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  paymentAmountBox: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentAmountLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  paymentAmountValue: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  paymentMethodBox: {
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2196F3',
    alignItems: 'center',
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  itemsSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  itemsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 12,
  },
  itemDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  itemDetailQuantity: {
    fontSize: 14,
    width: 40,
    color: '#666',
  },
  itemDetailName: {
    fontSize: 14,
    flex: 1,
    color: '#333',
  },
  itemDetailPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  itemsMoreText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: 'white',
  },
  actionButton: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
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
  detailOriginalAmount: { fontSize: 16, fontWeight: '600', color: '#FF9800' },
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
  billGuests: { fontSize: 14, color: '#666', marginBottom: 4 },
  billSummary: { marginBottom: 16 },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentContextBox: {
    borderWidth: 1,
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginVertical: 12,
  },
  paymentContextTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  },
  paymentContextDetail: {
    fontSize: 14,
    color: '#1976D2',
    marginBottom: 12,
  },
  paymentBreakdown: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBDEFB',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#666',
  },
  breakdownAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  breakdownPaidAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  paymentMethodInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentMethodLabel: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  paymentMethodValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  paymentStatusInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentStatusLabel: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  paymentStatusValue: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  offeredPrice: {
    textDecorationLine: 'line-through',
    color: '#FF9800',
  },
  offeredItemText: {
    fontStyle: 'italic',
    color: '#FF9800',
  },
  billLabel: { fontSize: 16, color: '#666' },
  billValue: { fontSize: 16, fontWeight: '500' },
  billAmount: { fontSize: 18, fontWeight: '600', color: '#4CAF50' },
  billOriginalAmount: { fontSize: 16, fontWeight: '600', color: '#FF9800' },
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
  itemPriceContainer: {
    alignItems: 'flex-end',
  },
  itemPaidPortion: {
    fontSize: 12,
    color: '#2196F3',
    fontStyle: 'italic',
  },
});
