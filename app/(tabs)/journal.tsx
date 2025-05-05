// app/(tabs)/journal.tsx - Journal des ventes optimisé avec chargement paresseux

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  Filter,
  Search,
  Calendar,
  X,
  FileDown,
  ClipboardList,
  Tag,
  Grid,
} from 'lucide-react-native';
import { getBills, Bill } from '../../utils/storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

interface SoldItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  totalAmount: number;
  date: string;
  tableNumber: number;
  tableName?: string;
  section?: string;
  paymentMethod?: 'card' | 'cash' | 'check';
  paymentType?: 'full' | 'split' | 'custom' | 'items';
}

interface SummaryItem {
  id: number | string;
  name: string;
  totalQuantity: number;
  totalAmount: number;
  occurrences: number;
  details: SoldItem[];
}

interface SalesByCategory {
  category: string;
  totalAmount: number;
  itemCount: number;
  items: SummaryItem[];
}

interface PaymentMethodStats {
  card: number;
  cash: number;
  check: number;
  unknown: number;
}

type ViewMode = 'detailed' | 'summary';
type GroupByMode = 'article' | 'transaction';
type PaymentFilter = 'all' | 'card' | 'cash' | 'check';

const PAYMENT_METHODS_MAP = {
  card: 'Carte bancaire',
  cash: 'Espèces',
  check: 'Chèque',
} as const;

const PAYMENT_TYPES_MAP = {
  full: 'Paiement complet',
  split: 'Paiement partagé',
  custom: 'Paiement personnalisé',
  items: 'Paiement par article',
} as const;

// Batch size pour le traitement par chunks
const BATCH_SIZE = 100;

// Limite de chargement initial
const INITIAL_LOAD_LIMIT = 500;

// Cache pour les catégories d'articles
const articleCategoryCache = new Map<string, string>();

const getArticleCategory = (itemName: string): string => {
  const cacheKey = itemName.toLowerCase();

  if (articleCategoryCache.has(cacheKey)) {
    return articleCategoryCache.get(cacheKey)!;
  }

  const lowerName = cacheKey;
  let category = 'Autres';

  const categoryPatterns = {
    Plats: [
      'magret',
      'confit',
      'tartare',
      'cassoulet',
      'saucisse',
      'plat',
      'maxi',
    ],
    Salades: ['salade'],
    Desserts: ['dessert', 'glace'],
    Boissons: [
      'verre',
      'pichet',
      'btl',
      'vin',
      'biere',
      'blonde',
      'ambree',
      'soft',
      'eau',
      'café',
      'thé',
    ],
    'Apéritifs et Alcools': [
      'apero',
      'digestif',
      'ricard',
      'alcool',
      'cocktail',
    ],
    'Menu Enfant': ['enfant'],
    Accompagnements: ['frites', 'accompagnement'],
    'Paiements génériques': ['paiement', 'payment'],
  };

  for (const [catName, patterns] of Object.entries(categoryPatterns)) {
    if (patterns.some((pattern) => lowerName.includes(pattern))) {
      category = catName;
      break;
    }
  }

  articleCategoryCache.set(cacheKey, category);
  return category;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function JournalScreen() {
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loadedBills, setLoadedBills] = useState<Bill[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // États calculés paresseusement
  const [summaryItems, setSummaryItems] = useState<SummaryItem[]>([]);
  const [salesByCategory, setSalesByCategory] = useState<SalesByCategory[]>([]);
  const [paymentMethodStats, setPaymentMethodStats] =
    useState<PaymentMethodStats>({
      card: 0,
      cash: 0,
      check: 0,
      unknown: 0,
    });

  // États pour le filtrage
  const [searchText, setSearchText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateFilterActive, setDateFilterActive] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [groupByMode, setGroupByMode] = useState<GroupByMode>('article');

  // Statistiques globales
  const [totalSales, setTotalSales] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  // Mémoïzation des données calculées
  const soldItems = useMemo(() => {
    return processBillsToSoldItems(loadedBills);
  }, [loadedBills]);

  const filteredItems = useMemo(() => {
    let filtered = [...soldItems];

    if (searchText) {
      const lowerCaseSearch = searchText.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(lowerCaseSearch) ||
          (item.tableName &&
            item.tableName.toLowerCase().includes(lowerCaseSearch))
      );
    }

    if (dateFilterActive && selectedDate) {
      const filterDate = new Date(selectedDate);
      filterDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);

      filtered = filtered.filter((item) => {
        const itemDate = new Date(item.date);
        return itemDate >= filterDate && itemDate < nextDay;
      });
    }

    if (selectedPaymentMethod !== 'all') {
      filtered = filtered.filter(
        (item) => item.paymentMethod === selectedPaymentMethod
      );
    }

    return filtered;
  }, [
    soldItems,
    searchText,
    dateFilterActive,
    selectedDate,
    selectedPaymentMethod,
  ]);

  const topSellingItems = useMemo(() => {
    return summaryItems.slice(0, 5);
  }, [summaryItems]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    computeStatistics();
  }, [filteredItems]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const allBills = await getBills();

      // Trier les factures par date décroissante
      const sortedBills = allBills.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setBills(sortedBills);

      // Chargement initial limité
      const initialBills = sortedBills.slice(0, INITIAL_LOAD_LIMIT);
      setLoadedBills(initialBills);
      setOffset(INITIAL_LOAD_LIMIT);
      setHasMore(sortedBills.length > INITIAL_LOAD_LIMIT);
    } catch (error) {
      console.error('Erreur lors du chargement des données de vente:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreData = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const newBatch = bills.slice(offset, offset + BATCH_SIZE);
      setLoadedBills((prev) => [...prev, ...newBatch]);
      setOffset((prev) => prev + BATCH_SIZE);
      setHasMore(offset + BATCH_SIZE < bills.length);
    } catch (error) {
      console.error(
        'Erreur lors du chargement de données supplémentaires:',
        error
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [bills, offset, hasMore, isLoadingMore]);

  const processBillsToSoldItems = useCallback(
    (billsToProcess: Bill[]): SoldItem[] => {
      const itemsSold: SoldItem[] = [];

      for (let i = 0; i < billsToProcess.length; i += BATCH_SIZE) {
        const batch = billsToProcess.slice(i, i + BATCH_SIZE);

        batch.forEach((bill) => {
          if (bill.paidItems && bill.paidItems.length > 0) {
            bill.paidItems.forEach((item) => {
              const soldItem: SoldItem = {
                id: item.id,
                name: item.name,
                quantity: item.quantity || 1,
                price: item.price,
                totalAmount: item.price * (item.quantity || 1),
                date: bill.timestamp,
                tableNumber: bill.tableNumber,
                tableName: bill.tableName,
                section: bill.section,
                paymentMethod: bill.paymentMethod,
                paymentType: bill.paymentType,
              };
              itemsSold.push(soldItem);
            });
          } else if (bill.status === 'paid' || bill.status === 'split') {
            const paymentTypeName =
              bill.paymentType === 'full'
                ? 'complet'
                : bill.paymentType === 'split'
                ? 'partagé'
                : 'personnalisé';

            const soldItem: SoldItem = {
              id: bill.id,
              name: `Paiement ${paymentTypeName}`,
              quantity: 1,
              price: bill.amount,
              totalAmount: bill.amount,
              date: bill.timestamp,
              tableNumber: bill.tableNumber,
              tableName: bill.tableName,
              section: bill.section,
              paymentMethod: bill.paymentMethod,
              paymentType: bill.paymentType,
            };
            itemsSold.push(soldItem);
          }
        });
      }

      return itemsSold;
    },
    []
  );

  const computeStatistics = useCallback(() => {
    let totalSalesAmount = 0;
    let totalItemCount = 0;
    const itemSummary: { [key: string]: SummaryItem } = {};
    const paymentMethodCounts: PaymentMethodStats = {
      card: 0,
      cash: 0,
      check: 0,
      unknown: 0,
    };

    filteredItems.forEach((item) => {
      totalItemCount += item.quantity;
      totalSalesAmount += item.totalAmount;

      // Statistiques de paiement
      if (item.paymentMethod && item.paymentMethod in paymentMethodCounts) {
        paymentMethodCounts[item.paymentMethod]++;
      } else {
        paymentMethodCounts.unknown++;
      }

      // Résumé des articles
      const key = item.name.toLowerCase();
      if (!itemSummary[key]) {
        itemSummary[key] = {
          id: typeof item.id === 'number' ? item.id : 0,
          name: item.name,
          totalQuantity: 0,
          totalAmount: 0,
          occurrences: 0,
          details: [],
        };
      }

      itemSummary[key].totalQuantity += item.quantity;
      itemSummary[key].totalAmount += item.totalAmount;
      itemSummary[key].occurrences += 1;
      itemSummary[key].details.push(item);
    });

    const summaryArray = Object.values(itemSummary).sort(
      (a, b) => b.totalAmount - a.totalAmount
    );

    setSummaryItems(summaryArray);
    setTotalSales(totalSalesAmount);
    setTotalItems(totalItemCount);
    setPaymentMethodStats(paymentMethodCounts);

    // Calcul des ventes par catégorie de manière paresseuse
    const categorizedSales = prepareCategorizedSales(summaryArray);
    setSalesByCategory(categorizedSales);
  }, [filteredItems]);

  const prepareCategorizedSales = useCallback((summaryArray: SummaryItem[]) => {
    const categorizedSales: { [key: string]: SalesByCategory } = {};

    summaryArray.forEach((item) => {
      const category = getArticleCategory(item.name);

      if (!categorizedSales[category]) {
        categorizedSales[category] = {
          category,
          totalAmount: 0,
          itemCount: 0,
          items: [],
        };
      }

      categorizedSales[category].totalAmount += item.totalAmount;
      categorizedSales[category].itemCount += 1;
      categorizedSales[category].items.push(item);
    });

    return Object.values(categorizedSales).sort(
      (a, b) => b.totalAmount - a.totalAmount
    );
  }, []);

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      setDateFilterActive(true);
    }
  };

  const clearDateFilter = () => {
    setSelectedDate(null);
    setDateFilterActive(false);
  };

  const exportToCSV = async () => {
    try {
      let csvContent = '';

      if (viewMode === 'detailed') {
        csvContent =
          "Nom de l'article,Quantité,Prix unitaire,Montant total,Date,Table,Section,Méthode de paiement\n";

        filteredItems.forEach((item) => {
          const row = [
            `"${item.name.replace(/"/g, '""')}"`,
            item.quantity,
            item.price.toFixed(2),
            item.totalAmount.toFixed(2),
            formatDate(item.date),
            item.tableName || `Table ${item.tableNumber}`,
            item.section || 'N/A',
            item.paymentMethod || 'N/A',
          ].join(',');

          csvContent += row + '\n';
        });
      } else {
        csvContent = 'Article,Quantité totale,Montant total,Nombre de ventes\n';

        summaryItems.forEach((item) => {
          const row = [
            `"${item.name.replace(/"/g, '""')}"`,
            item.totalQuantity,
            item.totalAmount.toFixed(2),
            item.occurrences,
          ].join(',');

          csvContent += row + '\n';
        });
      }

      const fileUri = FileSystem.documentDirectory + 'journal_ventes.csv';
      await FileSystem.writeAsStringAsync(fileUri, csvContent);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        alert("Le partage n'est pas disponible sur cet appareil.");
      }
    } catch (error) {
      console.error("Erreur lors de l'exportation:", error);
      alert("Une erreur s'est produite lors de l'exportation des données.");
    }
  };

  const toggleGroupByMode = () => {
    setGroupByMode(groupByMode === 'article' ? 'transaction' : 'article');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>
          Chargement du journal de ventes...
        </Text>
      </View>
    );
  }

  const renderDetailedItem = (item: SoldItem, index: number) => (
    <View key={`${item.id}-${index}`} style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemPrice}>{item.totalAmount.toFixed(2)} €</Text>
      </View>
      <View style={styles.itemDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Quantité:</Text>
          <Text style={styles.detailValue}>
            {item.quantity} x {item.price.toFixed(2)} €
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date:</Text>
          <Text style={styles.detailValue}>{formatDate(item.date)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Table:</Text>
          <Text style={styles.detailValue}>
            {item.tableName || `Table ${item.tableNumber}`}
          </Text>
        </View>
        {item.section && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Section:</Text>
            <Text style={styles.detailValue}>{item.section}</Text>
          </View>
        )}
        {item.paymentMethod && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Paiement:</Text>
            <Text style={styles.detailValue}>
              {PAYMENT_METHODS_MAP[item.paymentMethod] || item.paymentMethod}
            </Text>
          </View>
        )}
        {item.paymentType && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type:</Text>
            <Text style={styles.detailValue}>
              {PAYMENT_TYPES_MAP[item.paymentType] || item.paymentType}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.categoryTag}>
        <Tag size={14} color="#666" />
        <Text style={styles.categoryTagText}>
          {getArticleCategory(item.name)}
        </Text>
      </View>
    </View>
  );

  const renderSummaryView = () => (
    <ScrollView
      style={styles.scrollContainer}
      onScroll={({ nativeEvent }) => {
        // Chargement infini
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        const isCloseToBottom =
          layoutMeasurement.height + contentOffset.y >=
          contentSize.height - 100;

        if (isCloseToBottom && hasMore && !isLoadingMore) {
          loadMoreData();
        }
      }}
      scrollEventThrottle={400}
    >
      <View style={styles.summarySection}>
        <Text style={styles.sectionTitle}>Top 5 des Articles Vendus</Text>
        {topSellingItems.map((item, index) => (
          <View key={`top-${index}`} style={styles.summaryItemRow}>
            <View style={styles.summaryItemInfo}>
              <Text style={styles.summaryItemRank}>#{index + 1}</Text>
              <Text style={styles.summaryItemName}>{item.name}</Text>
            </View>
            <View style={styles.summaryItemStats}>
              <Text style={styles.summaryItemQuantity}>
                {item.totalQuantity} vendus
              </Text>
              <Text style={styles.summaryItemAmount}>
                {item.totalAmount.toFixed(2)} €
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.summarySection}>
        <Text style={styles.sectionTitle}>Ventes par Catégorie</Text>
        {salesByCategory.map((category, index) => (
          <Pressable
            key={`cat-${index}`}
            style={styles.categoryRow}
            onPress={() => setSearchText(category.category)}
          >
            <Text style={styles.categoryName}>
              {category.category.charAt(0).toUpperCase() +
                category.category.slice(1)}
            </Text>
            <View style={styles.categoryStats}>
              <Text style={styles.categoryCount}>
                {category.itemCount} articles
              </Text>
              <Text style={styles.categoryAmount}>
                {category.totalAmount.toFixed(2)} €
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.summarySection}>
        <Text style={styles.sectionTitle}>
          Tous les Articles ({summaryItems.length})
        </Text>

        {summaryItems.slice(0, 100).map((item, index) => (
          <View key={`summary-${index}`} style={styles.summaryItemRow}>
            <Text style={styles.summaryItemName}>{item.name}</Text>
            <View style={styles.summaryItemStats}>
              <Text style={styles.summaryItemQuantity}>
                {item.totalQuantity} vendus
              </Text>
              <Text style={styles.summaryItemAmount}>
                {item.totalAmount.toFixed(2)} €
              </Text>
            </View>
          </View>
        ))}
        {summaryItems.length > 100 && (
          <Text style={styles.moreSummaryItems}>
            Et {summaryItems.length - 100} articles de plus...
          </Text>
        )}
      </View>

      {isLoadingMore && (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color="#2196F3" />
          <Text style={styles.loadingMoreText}>Chargement...</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderDetailedView = () => {
    if (filteredItems.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Aucun article vendu trouvé</Text>
          <Text style={styles.emptySubtext}>
            Ajustez vos filtres ou effectuez des ventes pour voir les données
            ici
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollContainer}
        onScroll={({ nativeEvent }) => {
          // Chargement infini
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isCloseToBottom =
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - 100;

          if (isCloseToBottom && hasMore && !isLoadingMore) {
            loadMoreData();
          }
        }}
        scrollEventThrottle={400}
      >
        {filteredItems.map((item, index) => renderDetailedItem(item, index))}

        {isLoadingMore && (
          <View style={styles.loadingMore}>
            <ActivityIndicator size="small" color="#2196F3" />
            <Text style={styles.loadingMoreText}>Chargement...</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Journal des Ventes</Text>
        <View style={styles.headerButtons}>
          <Pressable
            style={[
              styles.viewModeButton,
              viewMode === 'detailed' && styles.activeViewModeButton,
            ]}
            onPress={() => setViewMode('detailed')}
          >
            <ClipboardList
              size={20}
              color={viewMode === 'detailed' ? '#2196F3' : '#666'}
            />
            <Text
              style={[
                styles.viewModeText,
                viewMode === 'detailed' && styles.activeViewModeText,
              ]}
            >
              Détaillé
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.viewModeButton,
              viewMode === 'summary' && styles.activeViewModeButton,
            ]}
            onPress={() => setViewMode('summary')}
          >
            <BarChart3
              size={20}
              color={viewMode === 'summary' ? '#2196F3' : '#666'}
            />
            <Text
              style={[
                styles.viewModeText,
                viewMode === 'summary' && styles.activeViewModeText,
              ]}
            >
              Résumé
            </Text>
          </Pressable>
          {viewMode === 'summary' && (
            <Pressable
              style={[styles.viewModeButton, styles.groupByButton]}
              onPress={toggleGroupByMode}
            >
              <Grid size={20} color="#666" />
              <Text style={styles.groupByText}>
                Grouper par:{' '}
                {groupByMode === 'article' ? 'Article' : 'Transaction'}
              </Text>
            </Pressable>
          )}
          <Pressable style={styles.exportButton} onPress={exportToCSV}>
            <FileDown size={20} color="#4CAF50" />
            <Text style={styles.exportButtonText}>Exporter CSV</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.filterBar}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un article..."
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText ? (
            <Pressable onPress={() => setSearchText('')}>
              <X size={20} color="#666" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filterActions}>
          <Pressable
            style={[
              styles.filterButton,
              dateFilterActive && styles.activeFilterButton,
            ]}
            onPress={() => setShowDatePicker(true)}
          >
            <Calendar size={20} color={dateFilterActive ? '#fff' : '#2196F3'} />
            <Text
              style={[
                styles.filterButtonText,
                dateFilterActive && styles.activeFilterButtonText,
              ]}
            >
              {dateFilterActive && selectedDate
                ? selectedDate.toLocaleDateString('fr-FR')
                : 'Filtrer par date'}
            </Text>
            {dateFilterActive && (
              <Pressable
                onPress={clearDateFilter}
                style={styles.clearFilterButton}
              >
                <X size={16} color={dateFilterActive ? '#fff' : '#666'} />
              </Pressable>
            )}
          </Pressable>

          <View style={styles.paymentFilterContainer}>
            <Text style={styles.paymentFilterLabel}>Paiement:</Text>
            <View style={styles.paymentFilterButtons}>
              {(['all', 'card', 'cash', 'check'] as const).map((method) => (
                <Pressable
                  key={method}
                  style={[
                    styles.paymentFilterButton,
                    selectedPaymentMethod === method &&
                      styles.activePaymentFilterButton,
                  ]}
                  onPress={() => setSelectedPaymentMethod(method)}
                >
                  <Text
                    style={[
                      styles.paymentFilterButtonText,
                      selectedPaymentMethod === method &&
                        styles.activePaymentFilterButtonText,
                    ]}
                  >
                    {method === 'all'
                      ? 'Tous'
                      : method === 'card'
                      ? 'Carte'
                      : method === 'cash'
                      ? 'Espèces'
                      : 'Chèque'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate || new Date()}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}
      </View>

      <View style={styles.statsSummary}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalSales.toFixed(2)} €</Text>
          <Text style={styles.statLabel}>Ventes totales</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalItems}</Text>
          <Text style={styles.statLabel}>Articles vendus</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{filteredItems.length}</Text>
          <Text style={styles.statLabel}>Transactions</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.paymentMethodIcons}>
            <Text style={styles.paymentMethodIcon}>
              💳 {paymentMethodStats.card}
            </Text>
            <Text style={styles.paymentMethodIcon}>
              💶 {paymentMethodStats.cash}
            </Text>
            <Text style={styles.paymentMethodIcon}>
              📝 {paymentMethodStats.check}
            </Text>
          </View>
          <Text style={styles.statLabel}>Méthodes de paiement</Text>
        </View>
      </View>

      {viewMode === 'detailed' ? renderDetailedView() : renderSummaryView()}
    </View>
  );
}

// Styles inchangés
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  activeViewModeButton: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  groupByButton: {
    backgroundColor: '#f9f9f9',
  },
  groupByText: {
    color: '#666',
    fontWeight: '500',
  },
  viewModeText: {
    color: '#666',
    fontWeight: '500',
  },
  activeViewModeText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#4CAF50',
    gap: 6,
  },
  exportButtonText: {
    color: '#4CAF50',
    fontWeight: '600',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeFilterButton: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterButtonText: {
    marginLeft: 8,
    color: '#2196F3',
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: 'white',
  },
  clearFilterButton: {
    marginLeft: 8,
  },
  paymentFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentFilterLabel: {
    fontWeight: '500',
    marginRight: 8,
    color: '#666',
  },
  paymentFilterButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  paymentFilterButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activePaymentFilterButton: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  paymentFilterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  activePaymentFilterButtonText: {
    color: 'white',
  },
  statsSummary: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  paymentMethodIcons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  paymentMethodIcon: {
    fontSize: 14,
    color: '#2196F3',
  },
  scrollContainer: {
    flex: 1,
    padding: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 8,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  itemCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  itemDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoryTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  categoryTagText: {
    fontSize: 12,
    color: '#666',
  },
  summarySection: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 8,
  },
  summaryItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  summaryItemRank: {
    fontWeight: 'bold',
    marginRight: 12,
    color: '#2196F3',
    width: 30,
  },
  summaryItemName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  summaryItemStats: {
    alignItems: 'flex-end',
  },
  summaryItemQuantity: {
    fontSize: 14,
    color: '#666',
  },
  summaryItemAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
  },
  categoryStats: {
    alignItems: 'flex-end',
  },
  categoryCount: {
    fontSize: 14,
    color: '#666',
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  moreSummaryItems: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    padding: 12,
    textAlign: 'center',
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
});
