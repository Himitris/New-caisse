// app/(tabs)/journal.tsx - Journal des ventes

import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { BarChart3, Filter, Search, Calendar, X, FileDown, ClipboardList } from 'lucide-react-native';
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
}

interface SummaryItem {
  id: number;
  name: string;
  totalQuantity: number;
  totalAmount: number;
}

interface SalesByCategory {
  category: string;
  totalAmount: number;
  itemCount: number;
}

export default function JournalScreen() {
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<Bill[]>([]);
  const [soldItems, setSoldItems] = useState<SoldItem[]>([]);
  const [summaryItems, setSummaryItems] = useState<SummaryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<SoldItem[]>([]);
  const [salesByCategory, setSalesByCategory] = useState<SalesByCategory[]>([]);
  
  // États pour le filtrage
  const [searchText, setSearchText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateFilterActive, setDateFilterActive] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'all' | 'card' | 'cash' | 'check'>('all');
  const [viewMode, setViewMode] = useState<'detailed' | 'summary'>('detailed');

  // Statistiques globales
  const [totalSales, setTotalSales] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [topSellingItems, setTopSellingItems] = useState<SummaryItem[]>([]);

  useEffect(() => {
    loadSalesData();
  }, []);

  // Charger les données de vente
  const loadSalesData = async () => {
    try {
      setLoading(true);
      const allBills = await getBills();

      // Trier les factures par date (la plus récente en premier)
      const sortedBills = allBills.sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setBills(sortedBills);

      // Extraire tous les articles vendus
      const itemsSold: SoldItem[] = [];
      let totalItemCount = 0;
      let totalSalesAmount = 0;

      sortedBills.forEach(bill => {
        // Si la facture a des articles spécifiquement payés (paiement par article)
        if (bill.paidItems && bill.paidItems.length > 0) {
          bill.paidItems.forEach(item => {
            const soldItem: SoldItem = {
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              totalAmount: item.price * item.quantity,
              date: bill.timestamp,
              tableNumber: bill.tableNumber,
              tableName: bill.tableName,
              section: bill.section,
              paymentMethod: bill.paymentMethod
            };
            itemsSold.push(soldItem);
            totalItemCount += item.quantity;
            totalSalesAmount += soldItem.totalAmount;
          });
        } 
        // Si la facture n'a pas d'articles spécifiques, mais représente un paiement complet ou partiel
        else if (bill.status === 'paid' || bill.status === 'split') {
          // Nous n'avons pas les détails des articles, mais nous pouvons compter ça comme une vente générique
          const soldItem: SoldItem = {
            id: bill.id,
            name: `Paiement ${bill.paymentType === 'full' ? 'complet' : bill.paymentType === 'split' ? 'partagé' : 'personnalisé'}`,
            quantity: 1,
            price: bill.amount,
            totalAmount: bill.amount,
            date: bill.timestamp,
            tableNumber: bill.tableNumber,
            tableName: bill.tableName,
            section: bill.section,
            paymentMethod: bill.paymentMethod
          };
          itemsSold.push(soldItem);
          totalItemCount += 1;
          totalSalesAmount += bill.amount;
        }
      });

      setSoldItems(itemsSold);
      setFilteredItems(itemsSold);
      setTotalItems(totalItemCount);
      setTotalSales(totalSalesAmount);

      // Préparer les données pour le résumé
      prepareSummaryData(itemsSold);
      
    } catch (error) {
      console.error('Erreur lors du chargement des données de vente:', error);
    } finally {
      setLoading(false);
    }
  };

  // Préparer les données pour le résumé
  const prepareSummaryData = (items: SoldItem[]) => {
    // Regrouper les articles par nom
    const itemSummary = items.reduce((acc: {[key: string]: SummaryItem}, item) => {
      const key = `${item.id}-${item.name}`;
      if (!acc[key]) {
        acc[key] = {
          id: item.id,
          name: item.name,
          totalQuantity: 0,
          totalAmount: 0
        };
      }
      acc[key].totalQuantity += item.quantity;
      acc[key].totalAmount += item.totalAmount;
      return acc;
    }, {});

    // Convertir l'objet en tableau
    const summaryArray = Object.values(itemSummary);
    
    // Trier par montant total (du plus élevé au plus bas)
    summaryArray.sort((a, b) => b.totalAmount - a.totalAmount);
    
    setSummaryItems(summaryArray);
    
    // Définir les top articles (Top 5)
    setTopSellingItems(summaryArray.slice(0, 5));

    // Catégoriser les ventes
    // Ceci est une version simplifiée - dans une version plus complète,
    // vous pourriez vouloir définir des catégories réelles basées sur vos articles
    const categories = {
      'plats': items.filter(item => item.name.toLowerCase().includes('plat') || 
                                  item.name.toLowerCase().includes('magret') || 
                                  item.name.toLowerCase().includes('confit') ||
                                  item.name.toLowerCase().includes('tartare')),
      'boissons': items.filter(item => item.name.toLowerCase().includes('vin') || 
                                     item.name.toLowerCase().includes('bière') || 
                                     item.name.toLowerCase().includes('soft') ||
                                     item.name.toLowerCase().includes('eau')),
      'desserts': items.filter(item => item.name.toLowerCase().includes('dessert')),
      'autres': items.filter(item => !item.name.toLowerCase().includes('plat') && 
                                   !item.name.toLowerCase().includes('magret') && 
                                   !item.name.toLowerCase().includes('confit') &&
                                   !item.name.toLowerCase().includes('tartare') &&
                                   !item.name.toLowerCase().includes('vin') &&
                                   !item.name.toLowerCase().includes('bière') &&
                                   !item.name.toLowerCase().includes('soft') &&
                                   !item.name.toLowerCase().includes('eau') &&
                                   !item.name.toLowerCase().includes('dessert'))
    };

    const categorySummary: SalesByCategory[] = [];
    
    Object.entries(categories).forEach(([category, categoryItems]) => {
      const totalAmount = categoryItems.reduce((sum, item) => sum + item.totalAmount, 0);
      categorySummary.push({
        category,
        totalAmount,
        itemCount: categoryItems.length
      });
    });

    setSalesByCategory(categorySummary);
  };

  // Fonction pour filtrer les articles
  const filterItems = () => {
    let filtered = [...soldItems];

    // Filtre par terme de recherche
    if (searchText) {
      const lowerCaseSearch = searchText.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(lowerCaseSearch) ||
        (item.tableName && item.tableName.toLowerCase().includes(lowerCaseSearch))
      );
    }

    // Filtre par date
    if (dateFilterActive && selectedDate) {
      const filterDate = new Date(selectedDate);
      filterDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);

      filtered = filtered.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= filterDate && itemDate < nextDay;
      });
    }

    // Filtre par méthode de paiement
    if (selectedPaymentMethod !== 'all') {
      filtered = filtered.filter(item => item.paymentMethod === selectedPaymentMethod);
    }

    setFilteredItems(filtered);
    
    // Mettre à jour les résumés basés sur les filtres
    prepareSummaryData(filtered);
  };

  // Appliquer les filtres lorsque les critères changent
  useEffect(() => {
    filterItems();
  }, [searchText, dateFilterActive, selectedDate, selectedPaymentMethod]);

  // Gérer le changement de date
  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    
    if (date) {
      setSelectedDate(date);
      setDateFilterActive(true);
    }
  };

  // Réinitialiser le filtre de date
  const clearDateFilter = () => {
    setSelectedDate(null);
    setDateFilterActive(false);
  };

  // Formater la date pour l'affichage
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Exporter les données en CSV
  const exportToCSV = async () => {
    try {
      let csvContent = "Nom de l'article,Quantité,Prix unitaire,Montant total,Date,Table,Section,Méthode de paiement\n";
      
      filteredItems.forEach(item => {
        const row = [
          `"${item.name.replace(/"/g, '""')}"`,
          item.quantity,
          item.price.toFixed(2),
          item.totalAmount.toFixed(2),
          formatDate(item.date),
          item.tableName || `Table ${item.tableNumber}`,
          item.section || 'N/A',
          item.paymentMethod || 'N/A'
        ].join(',');
        
        csvContent += row + '\n';
      });
      
      const fileUri = FileSystem.documentDirectory + 'journal_ventes.csv';
      await FileSystem.writeAsStringAsync(fileUri, csvContent);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        alert("Le partage n'est pas disponible sur cet appareil.");
      }
    } catch (error) {
      console.error('Erreur lors de l\'exportation:', error);
      alert("Une erreur s'est produite lors de l'exportation des données.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement du journal de ventes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Journal des Ventes</Text>
        <View style={styles.headerButtons}>
          <Pressable 
            style={[styles.viewModeButton, viewMode === 'detailed' && styles.activeViewModeButton]} 
            onPress={() => setViewMode('detailed')}>
            <ClipboardList size={20} color={viewMode === 'detailed' ? '#2196F3' : '#666'} />
            <Text style={[styles.viewModeText, viewMode === 'detailed' && styles.activeViewModeText]}>Détaillé</Text>
          </Pressable>
          <Pressable 
            style={[styles.viewModeButton, viewMode === 'summary' && styles.activeViewModeButton]} 
            onPress={() => setViewMode('summary')}>
            <BarChart3 size={20} color={viewMode === 'summary' ? '#2196F3' : '#666'} />
            <Text style={[styles.viewModeText, viewMode === 'summary' && styles.activeViewModeText]}>Résumé</Text>
          </Pressable>
          <Pressable
            style={styles.exportButton}
            onPress={exportToCSV}>
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
            style={[styles.filterButton, dateFilterActive && styles.activeFilterButton]}
            onPress={() => setShowDatePicker(true)}>
            <Calendar size={20} color={dateFilterActive ? '#fff' : '#2196F3'} />
            <Text style={[styles.filterButtonText, dateFilterActive && styles.activeFilterButtonText]}>
              {dateFilterActive && selectedDate 
                ? selectedDate.toLocaleDateString('fr-FR') 
                : 'Filtrer par date'}
            </Text>
            {dateFilterActive && (
              <Pressable onPress={clearDateFilter} style={styles.clearFilterButton}>
                <X size={16} color={dateFilterActive ? '#fff' : '#666'} />
              </Pressable>
            )}
          </Pressable>

          <View style={styles.paymentFilterContainer}>
            <Text style={styles.paymentFilterLabel}>Paiement:</Text>
            <View style={styles.paymentFilterButtons}>
              <Pressable 
                style={[styles.paymentFilterButton, selectedPaymentMethod === 'all' && styles.activePaymentFilterButton]}
                onPress={() => setSelectedPaymentMethod('all')}>
                <Text style={[styles.paymentFilterButtonText, selectedPaymentMethod === 'all' && styles.activePaymentFilterButtonText]}>
                  Tous
                </Text>
              </Pressable>
              <Pressable 
                style={[styles.paymentFilterButton, selectedPaymentMethod === 'card' && styles.activePaymentFilterButton]}
                onPress={() => setSelectedPaymentMethod('card')}>
                <Text style={[styles.paymentFilterButtonText, selectedPaymentMethod === 'card' && styles.activePaymentFilterButtonText]}>
                  Carte
                </Text>
              </Pressable>
              <Pressable 
                style={[styles.paymentFilterButton, selectedPaymentMethod === 'cash' && styles.activePaymentFilterButton]}
                onPress={() => setSelectedPaymentMethod('cash')}>
                <Text style={[styles.paymentFilterButtonText, selectedPaymentMethod === 'cash' && styles.activePaymentFilterButtonText]}>
                  Espèces
                </Text>
              </Pressable>
              <Pressable 
                style={[styles.paymentFilterButton, selectedPaymentMethod === 'check' && styles.activePaymentFilterButton]}
                onPress={() => setSelectedPaymentMethod('check')}>
                <Text style={[styles.paymentFilterButtonText, selectedPaymentMethod === 'check' && styles.activePaymentFilterButtonText]}>
                  Chèque
                </Text>
              </Pressable>
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
      </View>

      {viewMode === 'detailed' ? (
        <ScrollView style={styles.scrollContainer}>
          {filteredItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Aucun article vendu trouvé</Text>
              <Text style={styles.emptySubtext}>Ajustez vos filtres ou effectuez des ventes pour voir les données ici</Text>
            </View>
          ) : (
            filteredItems.map((item, index) => (
              <View key={`${item.id}-${index}`} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>{item.totalAmount.toFixed(2)} €</Text>
                </View>
                <View style={styles.itemDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Quantité:</Text>
                    <Text style={styles.detailValue}>{item.quantity} x {item.price.toFixed(2)} €</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date:</Text>
                    <Text style={styles.detailValue}>{formatDate(item.date)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Table:</Text>
                    <Text style={styles.detailValue}>{item.tableName || `Table ${item.tableNumber}`}</Text>
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
                        {item.paymentMethod === 'card' ? 'Carte bancaire' :
                         item.paymentMethod === 'cash' ? 'Espèces' : 'Chèque'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView style={styles.scrollContainer}>
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Top 5 des Articles Vendus</Text>
            {topSellingItems.map((item, index) => (
              <View key={`top-${item.id}-${index}`} style={styles.summaryItemRow}>
                <View style={styles.summaryItemInfo}>
                  <Text style={styles.summaryItemRank}>#{index + 1}</Text>
                  <Text style={styles.summaryItemName}>{item.name}</Text>
                </View>
                <View style={styles.summaryItemStats}>
                  <Text style={styles.summaryItemQuantity}>{item.totalQuantity} vendus</Text>
                  <Text style={styles.summaryItemAmount}>{item.totalAmount.toFixed(2)} €</Text>
                </View>
              </View>
            ))}
          </View>
          
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Ventes par Catégorie</Text>
            {salesByCategory.map((category, index) => (
              <View key={`cat-${index}`} style={styles.categoryRow}>
                <Text style={styles.categoryName}>
                  {category.category.charAt(0).toUpperCase() + category.category.slice(1)}
                </Text>
                <View style={styles.categoryStats}>
                  <Text style={styles.categoryCount}>{category.itemCount} articles</Text>
                  <Text style={styles.categoryAmount}>{category.totalAmount.toFixed(2)} €</Text>
                </View>
              </View>
            ))}
          </View>
          
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Tous les Articles (Résumé)</Text>
            {summaryItems.map((item, index) => (
              <View key={`summary-${item.id}-${index}`} style={styles.summaryItemRow}>
                <Text style={styles.summaryItemName}>{item.name}</Text>
                <View style={styles.summaryItemStats}>
                  <Text style={styles.summaryItemQuantity}>{item.totalQuantity} vendus</Text>
                  <Text style={styles.summaryItemAmount}>{item.totalAmount.toFixed(2)} €</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
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
  // Styles pour la vue résumé
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
});