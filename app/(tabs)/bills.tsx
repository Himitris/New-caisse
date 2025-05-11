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
  X
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
  View
} from 'react-native';
import { getBills, saveBills } from '../../utils/storage';
import { useToast } from '../../utils/ToastContext';

interface Bill {
  id: number;
  tableNumber: number;
  tableName?: string;
  section?: string;
  amount: number;
  items: number;
  status: 'pending' | 'paid' | 'split';
  timestamp: string;
  paymentMethod?: 'card' | 'cash' | 'check';
}

interface ViewReceiptModalProps {
  visible: boolean;
  bill: Bill | null;
  onClose: () => void;
  onPrint: () => void;
  onShare: () => void;
  onDelete: () => void;
}

// Cache pour les constantes
const STATUS_COLORS = {
  pending: '#FFC107',
  paid: '#4CAF50',
  split: '#2196F3',
  default: '#E0E0E0',
} as const;

const PAYMENT_METHOD_ICONS = {
  card: '💳',
  cash: '💶',
  check: '📝',
  default: '',
} as const;

const PAYMENT_METHOD_LABELS = {
  card: 'Carte bancaire',
  cash: 'Espèces',
  check: 'Chèque',
} as const;

const RESTAURANT_INFO = {
  name: 'Manjo Carn',
  address: 'Route de la Corniche, 82140 Saint Antonin Noble Val',
  siret: 'Siret N° 803 520 998 00011',
  phone: 'Tel : 0563682585',
  owner: 'Virginie',
} as const;

const ITEM_HEIGHT = 80;
const PAGE_SIZE = 20;
const MAX_BILLS_IN_STORAGE = 1000; // Limite pour éviter les problèmes de mémoire

// Fonction de nettoyage optimisée
const cleanupOldBills = async (currentBills: Bill[]): Promise<Bill[]> => {
  if (currentBills.length <= MAX_BILLS_IN_STORAGE) {
    return currentBills;
  }

  // Trier par date et garder les plus récents
  const sortedBills = [...currentBills].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Garder les 1000 plus récents
  const cleanedBills = sortedBills.slice(0, MAX_BILLS_IN_STORAGE);

  await saveBills(cleanedBills);
  console.log(`Cleaned ${currentBills.length - cleanedBills.length} old bills`);

  return cleanedBills;
};

// Modal pour voir le reçu - Mémoïzé
const ViewReceiptModal = memo<ViewReceiptModalProps>(
  ({ visible, bill, onClose, onPrint, onShare, onDelete }) => {
    if (!bill) return null;

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

    const statusColor = STATUS_COLORS[bill.status];
    const paymentLabel = bill.paymentMethod
      ? PAYMENT_METHOD_LABELS[bill.paymentMethod]
      : '';

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
                <Text style={styles.restaurantName}>
                  {RESTAURANT_INFO.name}
                </Text>
                <Text style={styles.restaurantAddress}>
                  {RESTAURANT_INFO.address}
                </Text>
                <Text style={styles.restaurantPhone}>
                  {RESTAURANT_INFO.phone}
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
              </View>

              <View style={styles.receiptDivider} />

              <View style={styles.billSummary}>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Articles:</Text>
                  <Text style={styles.billValue}>{bill.items}</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Montant:</Text>
                  <Text style={styles.billAmount}>
                    {bill.amount.toFixed(2)} €
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

// Composant pour le filtrage - Amélioré avec les nouveaux filtres
interface FilterBarProps {
  onSearch: (text: string) => void;
  onDateChange: (date: Date | null) => void;
  sortOrder: 'desc' | 'asc' | 'none';
  onSortChange: (order: 'desc' | 'asc' | 'none') => void;
  onDeleteAll: () => void;
  onFilter: () => void;
  searchText: string;
  selectedDate: Date | null;
  onPaymentMethodChange: (method: Bill['paymentMethod'] | null) => void;
  selectedPaymentMethod: Bill['paymentMethod'] | null;
  onResetFilters: () => void;
}

const FilterBar = memo<FilterBarProps>(
  ({
    onFilter,
    onSearch,
    onDateChange,
    sortOrder,
    onSortChange,
    onDeleteAll,
    searchText,
    selectedDate,
    onPaymentMethodChange,
    selectedPaymentMethod,
    onResetFilters,
  }) => {
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showPaymentPicker, setShowPaymentPicker] = useState(false);
    const [tempDate, setTempDate] = useState(selectedDate || new Date());

    const handleSearch = useCallback(
      (text: string) => {
        onSearch(text);
      },
      [onSearch]
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

    const handleClearDate = useCallback(() => {
      onDateChange(null);
    }, [onDateChange]);

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
      return PAYMENT_METHOD_LABELS[selectedPaymentMethod];
    }, [selectedPaymentMethod]);

    return (
      <View style={styles.filterBar}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher par table ou montant..."
            value={searchText}
            onChangeText={handleSearch}
          />
          {searchText ? (
            <Pressable onPress={() => handleSearch('')}>
              <X size={20} color="#666" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filterActions}>
          <Pressable
            style={styles.filterButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Calendar size={20} color="#2196F3" />
            <Text style={styles.filterButtonText}>{dateLabel}</Text>
            {selectedDate && (
              <Pressable onPress={handleClearDate} style={styles.clearButton}>
                <X size={16} color="#F44336" />
              </Pressable>
            )}
          </Pressable>

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

          <Pressable style={styles.filterButton} onPress={handleSortToggle}>
            {sortIcon}
            <Text style={styles.filterButtonText}>{sortLabel}</Text>
          </Pressable>

          <Pressable style={styles.filterButton} onPress={onDeleteAll}>
            <Filter size={20} color="#F44336" />
            <Text style={[styles.filterButtonText, { color: '#F44336' }]}>
              Supprimer toutes les notes
            </Text>
          </Pressable>

          <Pressable style={styles.resetButton} onPress={onResetFilters}>
            <RefreshCw size={20} color="#2196F3" />
            <Text style={[styles.filterButtonText, { color: '#2196F3' }]}>
              Réinitialiser filtres
            </Text>
          </Pressable>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

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
            {Object.entries(PAYMENT_METHOD_LABELS).map(([method, label]) => (
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
            ))}
          </View>
        )}
      </View>
    );
  }
);

// Composant pour un item de facture - Mémoïzé
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

    const statusColor = STATUS_COLORS[bill.status];
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
            {bill.status}
          </Text>
        </View>
        <Text style={styles.billItemDate}>{formattedDate}</Text>
      </Pressable>
    );
  }
);

export default function BillsScreen() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [filteredBills, setFilteredBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'none'>('desc');
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<
    Bill['paymentMethod'] | null
  >(null);
  const toast = useToast();

  // Chargement des factures avec nettoyage automatique
  useEffect(() => {
    let mounted = true;

    const loadBills = async () => {
      try {
        setLoading(true);
        const loadedBills = await getBills();

        // Nettoyer les anciennes factures si nécessaire
        const cleanedBills = await cleanupOldBills(loadedBills);

        if (mounted) {
          const sortedBills = sortBillsByDate(cleanedBills, 'desc');
          setBills(sortedBills);
          setFilteredBills(sortedBills);
          if (sortedBills.length > 0) {
            setSelectedBill(sortedBills[0]);
          }
        }
      } catch (error) {
        console.error('Error loading bills:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadBills();

    return () => {
      mounted = false;
    };
  }, []);

  // Tri des factures par date - Mémoïzé
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

  // Filtrage optimisé avec useMemo
  const appliedFilters = useMemo(() => {
    let filtered = bills;

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

    if (dateFilter) {
      const selectedDate = new Date(dateFilter);
      selectedDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(selectedDate);
      nextDay.setDate(selectedDate.getDate() + 1);

      filtered = filtered.filter((bill) => {
        const billDate = new Date(bill.timestamp);
        return billDate >= selectedDate && billDate < nextDay;
      });
    }

    if (paymentMethodFilter) {
      filtered = filtered.filter(
        (bill) => bill.paymentMethod === paymentMethodFilter
      );
    }

    return sortBillsByDate(filtered, sortOrder);
  }, [
    bills,
    searchText,
    dateFilter,
    paymentMethodFilter,
    sortOrder,
    sortBillsByDate,
  ]);

  // Mise à jour des filtres avec debounce
  useEffect(() => {
    setFilteredBills(appliedFilters);
    setPage(0);
    setHasMorePages(appliedFilters.length > PAGE_SIZE);
  }, [appliedFilters]);

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

  const getStatusColor = useCallback(
    (status: Bill['status']) => STATUS_COLORS[status],
    []
  );

  const handleSelectBill = useCallback((bill: Bill) => {
    setSelectedBill(bill);
  }, []);

  const handleView = useCallback(() => {
    if (selectedBill) {
      setViewModalVisible(true);
    } else {
      toast.showToast(
        'Veuillez sélectionner une facture à visualiser.',
        'info'
      );
    }
  }, [selectedBill]);

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
              setProcessingAction(true);
              await saveBills([]);
              setBills([]);
              setFilteredBills([]);
              setSelectedBill(null);
              toast.showToast(
                'Toutes les factures ont été supprimées avec succès.',
                'success'
              );
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              toast.showToast('Impossible de supprimer les factures.', 'error');
            } finally {
              setProcessingAction(false);
            }
          },
        },
      ]
    );
  }, []);

  const handleDeleteBill = useCallback(async () => {
    if (!selectedBill) return;

    try {
      setProcessingAction(true);
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
      setProcessingAction(false);
    }
  }, [selectedBill, bills, sortOrder, sortBillsByDate]);

  const generateHTML = useCallback((bill: Bill) => {
    const paymentLabel = bill.paymentMethod
      ? PAYMENT_METHOD_LABELS[bill.paymentMethod]
      : '';

    const taxInfo = 'TVA non applicable - art.293B du CGI';
    const restaurantInfo = {
      name: 'Manjo Carn',
      address: 'Route de la Corniche, 82140 Saint Antonin Noble Val',
      siret: 'Siret N° 803 520 998 00011',
      phone: 'Tel : 0563682585',
      owner: 'Virginie',
    };

    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header, .footer { text-align: center; margin-bottom: 20px; }
            .info { margin-bottom: 20px; text-align: center; }
            .totals { text-align: right; font-weight: bold; }
            .payment-info { text-align: center; margin-top: 20px; padding: 10px; border: 1px dashed #ccc; }
            .partial { color: #f44336; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${restaurantInfo.name}</h1>
            <p>${restaurantInfo.address}</p>
            <p>${restaurantInfo.siret}</p>
            <p>${taxInfo}</p>
          </div>

          <div class="info">
            <p><strong>${
              bill.tableName || `Table ${bill.tableNumber}`
            }</strong></p>
            <p>Date: ${new Date(bill.timestamp).toLocaleString()}</p>
            ${bill.section ? `<p>Section: ${bill.section}</p>` : ''}
          </div>

          <div class="totals">
            <p>Articles: ${bill.items}</p>
            <h2>Total: ${bill.amount.toFixed(2)} €</h2>
            <p>Statut: ${bill.status}</p>
            ${paymentLabel ? `<p>Paiement: ${paymentLabel}</p>` : ''}
          </div>

          <div class="payment-info">
            <p>Méthode de paiement: ${
              bill.paymentMethod === 'card'
                ? 'Carte bancaire'
                : bill.paymentMethod === 'cash'
                ? 'Espèces'
                : 'Chèque'
            }</p>
            <p>Montant payé: ${bill.amount.toFixed(2)} €</p>
            <p>Statut: ${bill.status}</p>
          </div>

          <div class="footer">
            <p>${taxInfo}</p>
            <p>Merci de votre visite !</p>
            <p>À bientôt,<br>${restaurantInfo.owner}<br>${
      restaurantInfo.phone
    }</p>
          </div>
        </body>
      </html>
    `;
  }, []);

  const handlePrint = useCallback(async () => {
    if (!selectedBill) {
      toast.showToast('Veuillez sélectionner une facture à imprimer.', 'info');
      return;
    }

    setProcessingAction(true);
    try {
      await Print.printAsync({
        html: generateHTML(selectedBill),
      });
      toast.showToast("Reçu envoyé à l'imprimante.", 'success');
    } catch (error) {
      console.error("Erreur d'impression:", error);
      toast.showToast(
        "Impossible d'imprimer le reçu. Vérifiez que votre imprimante est connectée.",
        'error'
      );
    } finally {
      setProcessingAction(false);
    }
  }, [selectedBill, generateHTML]);

  const handleShare = useCallback(async () => {
    if (!selectedBill) {
      toast.showToast('Veuillez sélectionner une facture à partager.', 'info');
      return;
    }

    setProcessingAction(true);
    try {
      const { uri } = await Print.printToFileAsync({
        html: generateHTML(selectedBill),
      });

      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
      });
    } catch (error) {
      console.error('Erreur de partage:', error);
      toast.showToast('Impossible de partager le reçu.', 'error');
    } finally {
      setProcessingAction(false);
    }
  }, [selectedBill, generateHTML]);

  const handleExport = useCallback(async () => {
    if (!selectedBill) {
      toast.showToast('Veuillez sélectionner une facture à exporter.', 'info');
      return;
    }

    setProcessingAction(true);
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
      setProcessingAction(false);
    }
  }, [selectedBill, generateHTML]);

  // Pagination pour FlatList
  const paginatedBills = useMemo(() => {
    const start = 0;
    const end = (page + 1) * PAGE_SIZE;
    return filteredBills.slice(start, end);
  }, [filteredBills, page]);

  const handleLoadMore = useCallback(() => {
    if (
      hasMorePages &&
      !loading &&
      (page + 1) * PAGE_SIZE < filteredBills.length
    ) {
      setPage((prevPage) => prevPage + 1);
    }
  }, [hasMorePages, loading, page, filteredBills.length]);

  const getItemLayout = useCallback(
    (data: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  const keyExtractor = useCallback((item: Bill) => item.id.toString(), []);

  const renderBillItem = useCallback(
    ({ item }: { item: Bill }) => (
      <BillListItem
        key={`bill-${item.id}-${item.timestamp}`}
        bill={item}
        isSelected={selectedBill?.id === item.id}
        onSelect={handleSelectBill}
      />
    ),
    [selectedBill, handleSelectBill]
  );

  const renderListFooter = useCallback(() => {
    if (!loading || page === 0) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color="#2196F3" />
        <Text style={styles.loadingMoreText}>Chargement...</Text>
      </View>
    );
  }, [loading, page]);

  if (loading && page === 0) {
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
            onFilter={() => {}}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            onDeleteAll={handleDeleteAll}
            searchText={searchText}
            selectedDate={dateFilter}
            onPaymentMethodChange={handlePaymentMethodFilter}
            selectedPaymentMethod={paymentMethodFilter}
            onResetFilters={handleResetFilters}
          />

          <View style={styles.content}>
            {/* Liste des factures à gauche */}
            <View style={styles.billsList}>
              <Text style={styles.listTitle}>Historique des Factures</Text>
              <Text style={styles.billCount}>
                {filteredBills.length} facture(s){' '}
                {filteredBills.length !== bills.length
                  ? `(sur ${bills.length} total)`
                  : ''}
              </Text>
              <FlatList
                data={paginatedBills}
                renderItem={renderBillItem}
                keyExtractor={keyExtractor}
                getItemLayout={getItemLayout}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderListFooter}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={10}
                initialNumToRender={10}
              />
            </View>

            {/* Détails de la facture sélectionnée */}
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
                        { color: getStatusColor(selectedBill.status) },
                      ]}
                    >
                      {selectedBill.status}
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
                    {selectedBill.paymentMethod && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>
                          Mode de paiement:
                        </Text>
                        <Text style={styles.detailValue}>
                          {PAYMENT_METHOD_LABELS[selectedBill.paymentMethod]}
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

      {processingAction && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.processingText}>Traitement en cours...</Text>
        </View>
      )}

    </View>
  );
}

// Styles mis à jour pour inclure les nouveaux éléments
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
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
  searchInput: {
    flex: 1,
    height: 40,
    marginLeft: 8,
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  filterButtonText: {
    marginLeft: 8,
    color: '#2196F3',
    fontWeight: '500',
  },
  billsList: {
    width: 300,
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    padding: 16,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  billCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
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
  billItemTable: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  billItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  billItemAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  billItemStatus: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  billItemDate: {
    fontSize: 12,
    color: '#666',
  },
  billDetails: {
    flex: 1,
    padding: 20,
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  noBillSelected: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noBillText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  selectedBillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectedBillTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionBadge: {
    marginLeft: 12,
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  sectionText: {
    color: '#0288D1',
    fontWeight: '600',
    fontSize: 12,
  },
  selectedBillStatus: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  billDetailsContent: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  detailAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
  },
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
  actionText: {
    fontSize: 16,
    fontWeight: '500',
  },
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  receiptContent: {
    flex: 1,
  },
  restaurantInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  restaurantName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  restaurantAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  restaurantPhone: {
    fontSize: 14,
    color: '#666',
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 16,
  },
  billInfo: {
    marginBottom: 16,
  },
  billTable: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  billDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  billSection: {
    fontSize: 14,
    color: '#0288D1',
  },
  billSummary: {
    marginBottom: 16,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  billLabel: {
    fontSize: 16,
    color: '#666',
  },
  billValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  billAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
  },
  billStatus: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
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
  receiptActionText: {
    fontSize: 16,
    fontWeight: '500',
  },
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
  processingText: {
    color: 'white',
    marginTop: 12,
    fontSize: 16,
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  loadingMore: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreText: {
    marginTop: 5,
    color: '#666',
  },
  // Nouveaux styles ajoutés
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
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
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
    minWidth: 200,
  },
  paymentOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectedPaymentOption: {
    backgroundColor: '#E3F2FD',
  },
  paymentOptionText: {
    fontSize: 16,
    color: '#333',
  },
});
