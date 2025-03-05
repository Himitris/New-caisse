// app/(tabs)/bills.tsx - Version améliorée avec tri, recherche et suppression

import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal, ActivityIndicator, Share, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { Receipt, Printer, Download, Share as ShareIcon, Eye, X, Trash2, Search, Calendar, Filter, ArrowDownAZ, ArrowUpAZ, ArrowUpDown } from 'lucide-react-native';
import { getBills, saveBills } from '../../utils/storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Bill {
  id: number;
  tableNumber: number;
  tableName?: string;
  section?: string;
  amount: number;
  items: number;
  status: 'pending' | 'paid' | 'split';
  timestamp: string;
  paymentMethod?: 'card' | 'cash';
}

interface ViewReceiptModalProps {
  visible: boolean;
  bill: Bill | null;
  onClose: () => void;
  onPrint: () => void;
  onShare: () => void;
  onDelete: () => void;
}

// Modal pour voir le reçu
const ViewReceiptModal: React.FC<ViewReceiptModalProps> = ({
  visible,
  bill,
  onClose,
  onPrint,
  onShare,
  onDelete
}) => {
  if (!bill) return null;

  function getStatusColor(status: 'pending' | 'paid' | 'split'): string {
    switch (status) {
      case 'pending':
        return '#FFC107';
      case 'paid':
        return '#4CAF50';
      case 'split':
        return '#2196F3';
      default:
        return '#E0E0E0';
    }
  }

  const handleDelete = () => {
    Alert.alert(
      "Supprimer la facture",
      "Êtes-vous sûr de vouloir supprimer cette facture ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: onDelete }
      ]
    );
  };

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
              <Text style={styles.restaurantName}>Restaurant Manjo Carn</Text>
              <Text style={styles.restaurantAddress}>Route de la Corniche, 82140 Saint Antonin Noble Val</Text>
              <Text style={styles.restaurantPhone}>05 63 68 25 85</Text>
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.billInfo}>
              <Text style={styles.billTable}>{bill.tableName || `Table ${bill.tableNumber}`}</Text>
              <Text style={styles.billDate}>
                {new Date(bill.timestamp).toLocaleString()}
              </Text>
              {bill.section && (
                <Text style={styles.billSection}>Section: {bill.section}</Text>
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
                <Text style={styles.billAmount}>${bill.amount.toFixed(2)}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Statut:</Text>
                <Text style={[
                  styles.billStatus,
                  { color: getStatusColor(bill.status) }
                ]}>{bill.status}</Text>
              </View>
              {bill.paymentMethod && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Paiement:</Text>
                  <Text style={styles.billValue}>
                    {bill.paymentMethod === 'card' ? 'Carte bancaire' : 'Espèces'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.receiptDivider} />

            <Text style={styles.receiptFooter}>Merci de votre visite!</Text>
          </ScrollView>

          <View style={styles.receiptActions}>
            <Pressable style={styles.receiptAction} onPress={onPrint}>
              <Printer size={20} color="#4CAF50" />
              <Text style={[styles.receiptActionText, { color: '#4CAF50' }]}>Imprimer</Text>
            </Pressable>
            <Pressable style={styles.receiptAction} onPress={onShare}>
              <ShareIcon size={20} color="#2196F3" />
              <Text style={[styles.receiptActionText, { color: '#2196F3' }]}>Partager</Text>
            </Pressable>
            <Pressable style={styles.receiptAction} onPress={handleDelete}>
              <Trash2 size={20} color="#F44336" />
              <Text style={[styles.receiptActionText, { color: '#F44336' }]}>Supprimer</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Componant pour la barre de filtre
interface FilterBarProps {
  onFilter: () => void;
  onSearch: (text: string) => void;
  onDateChange: (date: Date | null) => void;
  sortOrder: 'desc' | 'asc' | 'none';
  onSortChange: (order: 'desc' | 'asc' | 'none') => void;
  onDeleteAll: () => void; // Ajoutez cette ligne
}

const FilterBar: React.FC<FilterBarProps> = ({
  onFilter,
  onSearch,
  onDateChange,
  sortOrder,
  onSortChange,
  onDeleteAll
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const handleSearch = (text: string) => {
    setSearchText(text);
    onSearch(text);
  };

  interface DateChangeEvent {
    type: string;
    nativeEvent: any;
  }

  const handleDateChange = (event: DateChangeEvent, date?: Date | undefined) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      onDateChange(date);
    }
  };

  // Rotation du tri
  const handleSortToggle = () => {
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
  };

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
          <Text style={styles.filterButtonText}>Par date</Text>
        </Pressable>

        <Pressable
          style={styles.filterButton}
          onPress={handleSortToggle}
        >
          {sortOrder === 'desc' ? (
            <ArrowDownAZ size={20} color="#2196F3" />
          ) : sortOrder === 'asc' ? (
            <ArrowUpAZ size={20} color="#2196F3" />
          ) : (
            <ArrowUpDown size={20} color="#666" />
          )}
          <Text style={styles.filterButtonText}>
            {sortOrder === 'none' ? 'Trier' : sortOrder === 'asc' ? 'Ancien→Récent' : 'Récent→Ancien'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.filterButton}
          onPress={onDeleteAll} // Modifiez cette ligne
        >
          <Filter size={20} color="#F44336" />
          <Text style={[styles.filterButtonText, { color: '#F44336' }]}>Supprimer toutes les notes</Text>
        </Pressable>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </View>
  );
};

export default function BillsScreen() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [filteredBills, setFilteredBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'none'>('desc'); // 'desc', 'asc', or 'none'

  // Chargement des factures
  useEffect(() => {
    loadBills();
  }, []);

  // Fonction pour charger les factures
  const loadBills = async () => {
    try {
      setLoading(true);
      const loadedBills = await getBills();
      // Sort bills by timestamp (newest first by default)
      const sortedBills = sortBillsByDate(loadedBills, 'desc');
      setBills(sortedBills);
      setFilteredBills(sortedBills);

      // Select the first bill by default if available
      if (sortedBills.length > 0) {
        setSelectedBill(sortedBills[0]);
      }
    } catch (error) {
      console.error('Error loading bills:', error);
    } finally {
      setLoading(false);
    }
  };

  // Tri des factures par date
  interface SortBillsByDate {
    (billsToSort: Bill[], order?: 'desc' | 'asc' | 'none'): Bill[];
  }

  const sortBillsByDate: SortBillsByDate = (billsToSort, order = 'desc') => {
    if (order === 'none') return billsToSort;

    return [...billsToSort].sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return order === 'desc' ? dateB - dateA : dateA - dateB;
    });
  };

  // Recherche dans les factures
  const handleSearch = (text: String) => {
    if (!text.trim()) {
      setFilteredBills(sortBillsByDate(bills, sortOrder));
      return;
    }

    const lowerCaseText = text.toLowerCase();
    const filtered = bills.filter(bill => {
      const tableName = bill.tableName || `Table ${bill.tableNumber}`;
      const amount = bill.amount.toString();

      return (
        tableName.toLowerCase().includes(lowerCaseText) ||
        amount.includes(lowerCaseText) ||
        (bill.section && bill.section.toLowerCase().includes(lowerCaseText))
      );
    });

    setFilteredBills(sortBillsByDate(filtered, sortOrder));
  };

  // Filtre par date
  interface DateFilterHandler {
    (date: Date | null): void;
  }

  const handleDateFilter: DateFilterHandler = (date) => {
    if (!date) {
      setFilteredBills(sortBillsByDate(bills, sortOrder));
      return;
    }

    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(selectedDate);
    nextDay.setDate(selectedDate.getDate() + 1);

    const filtered = bills.filter(bill => {
      const billDate = new Date(bill.timestamp);
      return billDate >= selectedDate && billDate < nextDay;
    });

    setFilteredBills(sortBillsByDate(filtered, sortOrder));
  };

  // Changement de l'ordre de tri
  interface SortChangeHandler {
    (newSortOrder: 'desc' | 'asc' | 'none'): void;
  }

  const handleSortChange: SortChangeHandler = (newSortOrder) => {
    setSortOrder(newSortOrder);
    setFilteredBills(sortBillsByDate(filteredBills, newSortOrder));
  };

  const getStatusColor = (status: Bill['status']) => {
    switch (status) {
      case 'pending':
        return '#FFC107';
      case 'paid':
        return '#4CAF50';
      case 'split':
        return '#2196F3';
      default:
        return '#E0E0E0';
    }
  };

  const handleSelectBill = (bill: Bill) => {
    setSelectedBill(bill);
  };

  const handleView = () => {
    if (selectedBill) {
      setViewModalVisible(true);
    } else {
      Alert.alert('Information', 'Veuillez sélectionner une facture à visualiser.');
    }
  };


  const handleDeleteAll = async () => {
    Alert.alert(
      "Supprimer toutes les factures",
      "Êtes-vous sûr de vouloir supprimer toutes les factures ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              setProcessingAction(true);

              // Mettre à jour le stockage
              await saveBills([]);

              // Mettre à jour l'état local
              setBills([]);
              setFilteredBills([]);
              setSelectedBill(null);

              Alert.alert('Succès', 'Toutes les factures ont été supprimées avec succès.');
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert('Erreur', 'Impossible de supprimer les factures.');
            } finally {
              setProcessingAction(false);
            }
          }
        }
      ]
    );
  };

  // Suppression d'une facture
  const handleDeleteBill = async () => {
    if (!selectedBill) return;

    try {
      setProcessingAction(true);

      // Filtrer la facture à supprimer
      const updatedBills = bills.filter(bill => bill.id !== selectedBill.id);

      // Mettre à jour le stockage
      await saveBills(updatedBills);

      // Mettre à jour l'état local
      setBills(updatedBills);
      setFilteredBills(sortBillsByDate(updatedBills, sortOrder));

      // Si la facture supprimée était sélectionnée, sélectionner la première facture si disponible
      if (updatedBills.length > 0) {
        setSelectedBill(updatedBills[0]);
      } else {
        setSelectedBill(null);
      }

      // Fermer le modal
      setViewModalVisible(false);

      Alert.alert('Succès', 'Facture supprimée avec succès.');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      Alert.alert('Erreur', 'Impossible de supprimer la facture.');
    } finally {
      setProcessingAction(false);
    }
  };

  const generateHTML = (bill: Bill) => {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .info { margin-bottom: 20px; }
            .items { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .totals { text-align: right; }
            .payment-info { margin-top: 20px; padding: 10px; border: 1px dashed #ccc; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Restaurant Manjo Carn</h1>
            <p>Route de la Corniche, 82140 Saint Antonin Noble Val</p>
            <p>05 63 68 25 85</p>
          </div>
          
          <div class="info">
            <p>${bill.tableName || `Table ${bill.tableNumber}`}</p>
            <p>Date: ${new Date(bill.timestamp).toLocaleString()}</p>
            ${bill.section ? `<p>Section: ${bill.section}</p>` : ''}
          </div>

          <div class="totals">
            <p>Articles: ${bill.items}</p>
            <h2>Total: $${bill.amount.toFixed(2)}</h2>
            <p>Statut: ${bill.status}</p>
            ${bill.paymentMethod ? `<p>Paiement: ${bill.paymentMethod === 'card' ? 'Carte bancaire' : 'Espèces'}</p>` : ''}
          </div>

          <div class="payment-info">
            <p>Merci de votre visite!<br>
              A bientôt<br>
              Virginie<br></p>
          </div>
        </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    if (!selectedBill) {
      Alert.alert('Information', 'Veuillez sélectionner une facture à imprimer.');
      return;
    }

    setProcessingAction(true);
    try {
      await Print.printAsync({
        html: generateHTML(selectedBill),
      });
      Alert.alert('Succès', 'Reçu envoyé à l\'imprimante.');
    } catch (error) {
      console.error('Erreur d\'impression:', error);
      Alert.alert('Erreur', 'Impossible d\'imprimer le reçu. Vérifiez que votre imprimante est connectée.');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleShare = async () => {
    if (!selectedBill) {
      Alert.alert('Information', 'Veuillez sélectionner une facture à partager.');
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
      Alert.alert('Erreur', 'Impossible de partager le reçu.');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleExport = async () => {
    if (!selectedBill) {
      Alert.alert('Information', 'Veuillez sélectionner une facture à exporter.');
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

      Alert.alert('Succès', 'Reçu exporté avec succès.');
    } catch (error) {
      console.error('Erreur d\'export:', error);
      Alert.alert('Erreur', 'Impossible d\'exporter le reçu.');
    } finally {
      setProcessingAction(false);
    }
  };

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
          <Text style={styles.emptySubtext}>Les factures apparaîtront ici après les paiements</Text>
        </View>
      ) : (
        <View style={styles.mainContainer}>
          {/* Barre de filtrage et recherche */}
          <FilterBar
            onSearch={handleSearch}
            onDateChange={handleDateFilter}
            onFilter={() => { }}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            onDeleteAll={handleDeleteAll}
          />

          <View style={styles.content}>
            {/* Liste des factures à gauche */}
            <View style={styles.billsList}>
              <Text style={styles.listTitle}>Historique des Factures</Text>
              <Text style={styles.billCount}>
                {filteredBills.length} facture(s) {filteredBills.length !== bills.length ? `(sur ${bills.length} total)` : ''}
              </Text>
              <ScrollView>
                {filteredBills.length === 0 ? (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>Aucune facture ne correspond à votre recherche</Text>
                  </View>
                ) : (
                  filteredBills.map((bill) => (
                    <Pressable
                      key={bill.id}
                      style={[
                        styles.billListItem,
                        selectedBill?.id === bill.id && styles.selectedBillItem
                      ]}
                      onPress={() => handleSelectBill(bill)}
                    >
                      <Text style={styles.billItemTable}>{bill.tableName || `Table ${bill.tableNumber}`}</Text>
                      <View style={styles.billItemDetails}>
                        <Text style={styles.billItemAmount}>${bill.amount.toFixed(2)}</Text>
                        <Text style={[
                          styles.billItemStatus,
                          { color: getStatusColor(bill.status) }
                        ]}>
                          {bill.status}
                        </Text>
                      </View>
                      <Text style={styles.billItemDate}>
                        {new Date(bill.timestamp).toLocaleDateString()} {new Date(bill.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Détails de la facture sélectionnée */}
            <View style={styles.billDetails}>
              {selectedBill ? (
                <>
                  <View style={styles.selectedBillHeader}>
                    <View style={{ flexDirection: 'row' }}>
                      <Text style={styles.selectedBillTitle}>
                        {selectedBill.tableName || `Table ${selectedBill.tableNumber}`}
                      </Text>
                      {selectedBill.section && (
                        <View style={styles.sectionBadge}>
                          <Text style={styles.sectionText}>{selectedBill.section}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[
                      styles.selectedBillStatus,
                      { color: getStatusColor(selectedBill.status) }
                    ]}>
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
                      <Text style={styles.detailAmount}>${selectedBill.amount.toFixed(2)}</Text>
                    </View>
                    {/* <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Articles:</Text>
                      <Text style={styles.detailValue}>{selectedBill.items} articles</Text>
                    </View> */}
                    {selectedBill.paymentMethod && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Mode de paiement:</Text>
                        <Text style={styles.detailValue}>
                          {selectedBill.paymentMethod === 'card' ? 'Carte bancaire' : 'Espèces'}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.actionsContainer}>
                    <Pressable style={styles.actionButton} onPress={handleView}>
                      <Eye size={20} color="#2196F3" />
                      <Text style={[styles.actionText, { color: '#2196F3' }]}>Voir</Text>
                    </Pressable>
                    <Pressable style={styles.actionButton} onPress={handlePrint}>
                      <Printer size={20} color="#4CAF50" />
                      <Text style={[styles.actionText, { color: '#4CAF50' }]}>Imprimer</Text>
                    </Pressable>
                    <Pressable style={styles.actionButton} onPress={handleExport}>
                      <Download size={20} color="#FF9800" />
                      <Text style={[styles.actionText, { color: '#FF9800' }]}>Exporter</Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionButton}
                      onPress={() => {
                        Alert.alert(
                          "Supprimer la facture",
                          "Êtes-vous sûr de vouloir supprimer cette facture ?",
                          [
                            { text: "Annuler", style: "cancel" },
                            {
                              text: "Supprimer",
                              style: "destructive",
                              onPress: handleDeleteBill
                            }
                          ]
                        );
                      }}
                    >
                      <Trash2 size={20} color="#F44336" />
                      <Text style={[styles.actionText, { color: '#F44336' }]}>Supprimer</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <View style={styles.noBillSelected}>
                  <Text style={styles.noBillText}>Sélectionnez une facture pour voir les détails</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Modal pour voir le reçu */}
      <ViewReceiptModal
        visible={viewModalVisible}
        bill={selectedBill}
        onClose={() => setViewModalVisible(false)}
        onPrint={handlePrint}
        onShare={handleShare}
        onDelete={handleDeleteBill}
      />

      {/* Indicateur de chargement pour les actions */}
      {processingAction && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.processingText}>Traitement en cours...</Text>
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
  // Barre de filtres
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
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
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
  }
});