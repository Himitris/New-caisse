// app/(tabs)/bills.tsx - VERSION SIMPLE
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Calendar,
  CreditCard,
  Download,
  Eye,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Share as ShareIcon,
  Trash2,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
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
import { Bill, getBills, saveBills } from '../../utils/storage';
import { useToast } from '../../utils/ToastContext';
import { useSettings } from '@/utils/useSettings';

const STATUS_COLORS = {
  pending: '#FFC107',
  paid: '#4CAF50',
  split: '#2196F3',
  default: '#E0E0E0',
} as const;

const PAYMENT_METHOD_LABELS = {
  card: 'Carte bancaire',
  cash: 'Espèces',
  check: 'Chèque',
} as const;

export default function BillsScreen() {
  const toast = useToast();
  const { restaurantInfo, paymentMethods } = useSettings();

  // États locaux simples
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Filtres
  const [searchText, setSearchText] = useState('');
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Chargement simple
  const loadBills = useCallback(async () => {
    try {
      const allBills = await getBills();
      setBills(allBills);
    } catch (error) {
      console.error('Error loading bills:', error);
      toast.showToast('Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  // Filtrage simple
  const filteredBills = bills.filter((bill) => {
    // Filtre par date
    if (dateFilter) {
      const billDate = new Date(bill.timestamp);
      const filterDate = new Date(dateFilter);
      if (billDate.toDateString() !== filterDate.toDateString()) {
        return false;
      }
    }

    // Filtre par recherche
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      const tableName = bill.tableName || `Table ${bill.tableNumber}`;
      return (
        tableName.toLowerCase().includes(search) ||
        bill.amount.toString().includes(search)
      );
    }

    return true;
  });

  // Tri simple
  const sortedBills = [...filteredBills].sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const handleDeleteAll = useCallback(() => {
    Alert.alert('Supprimer toutes les factures', 'Êtes-vous sûr ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            setProcessing(true);
            await saveBills([]);
            setBills([]);
            setSelectedBill(null);
            toast.showToast('Toutes les factures supprimées', 'success');
          } catch (error) {
            toast.showToast('Erreur suppression', 'error');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  }, [toast]);

  const handleDeleteBill = useCallback(async () => {
    if (!selectedBill) return;

    try {
      setProcessing(true);
      const updatedBills = bills.filter((bill) => bill.id !== selectedBill.id);
      await saveBills(updatedBills);
      setBills(updatedBills);
      setSelectedBill(updatedBills.length > 0 ? updatedBills[0] : null);
      setViewModalVisible(false);
      toast.showToast('Facture supprimée', 'success');
    } catch (error) {
      toast.showToast('Erreur suppression', 'error');
    } finally {
      setProcessing(false);
    }
  }, [selectedBill, bills, toast]);

  const generateHTML = useCallback(
    (bill: Bill) => {
      const paymentLabel = bill.paymentMethod
        ? PAYMENT_METHOD_LABELS[bill.paymentMethod] || bill.paymentMethod
        : '';
      const dateObj = new Date(bill.timestamp);
      const dateFormatted = dateObj.toLocaleDateString('fr-FR');
      const timeFormatted = dateObj.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Courier New', monospace; width: 80mm; padding: 5mm; margin: 0; font-size: 14pt; }
            .header { text-align: center; margin-bottom: 5mm; }
            .header h1 { font-size: 18pt; margin: 0 0 2mm 0; }
            .divider { border-bottom: 1px dashed #000; margin: 3mm 0; }
            .total-amount { font-weight: bold; font-size: 16pt; text-align: right; margin: 2mm 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${restaurantInfo.name}</h1>
            <p>${restaurantInfo.address}</p>
            <p>${restaurantInfo.phone}</p>
          </div>
          
          <div class="divider"></div>
          
          <div>
            <p><strong>${
              bill.tableName || `Table ${bill.tableNumber}`
            }</strong></p>
            <p>Date: ${dateFormatted} ${timeFormatted}</p>
            ${bill.section ? `<p>Section: ${bill.section}</p>` : ''}
          </div>
          
          <div class="divider"></div>
          
          <div class="total-amount">TOTAL: ${bill.amount.toFixed(2)}€</div>
          
          <div class="divider"></div>
          
          <div style="text-align: center;">
            <p>Paiement: ${paymentLabel}</p>
            <p>Statut: ${bill.status}</p>
          </div>
          
          <div class="divider"></div>
          
          <div style="text-align: center;">
            <p>Merci de votre visite!</p>
            <p>À bientôt, ${restaurantInfo.owner}</p>
          </div>
        </body>
      </html>
    `;
    },
    [restaurantInfo]
  );

  const handlePrint = useCallback(async () => {
    if (!selectedBill) return;

    setProcessing(true);
    try {
      await Print.printAsync({ html: generateHTML(selectedBill) });
      toast.showToast("Reçu envoyé à l'imprimante", 'success');
    } catch (error) {
      toast.showToast("Erreur d'impression", 'error');
    } finally {
      setProcessing(false);
    }
  }, [selectedBill, generateHTML, toast]);

  const handleShare = useCallback(async () => {
    if (!selectedBill) return;

    setProcessing(true);
    try {
      const { uri } = await Print.printToFileAsync({
        html: generateHTML(selectedBill),
      });
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
      });
      toast.showToast('Reçu partagé', 'success');
    } catch (error) {
      toast.showToast('Erreur de partage', 'error');
    } finally {
      setProcessing(false);
    }
  }, [selectedBill, generateHTML, toast]);

  const renderBillItem = useCallback(
    ({ item }: { item: Bill }) => (
      <Pressable
        style={[
          styles.billItem,
          selectedBill?.id === item.id && styles.selectedBillItem,
        ]}
        onPress={() => setSelectedBill(item)}
      >
        <Text style={styles.billItemTable}>
          {item.tableName || `Table ${item.tableNumber}`}
        </Text>
        <View style={styles.billItemDetails}>
          <Text style={styles.billItemAmount}>{item.amount.toFixed(2)} €</Text>
          <Text
            style={[
              styles.billItemStatus,
              { color: STATUS_COLORS[item.status] || STATUS_COLORS.default },
            ]}
          >
            {item.status}
          </Text>
        </View>
        <Text style={styles.billItemDate}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
      </Pressable>
    ),
    [selectedBill]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.processingText}>Traitement...</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Factures & Paiements</Text>
      </View>

      {bills.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Receipt size={60} color="#cccccc" />
          <Text style={styles.emptyText}>Aucune facture</Text>
        </View>
      ) : (
        <View style={styles.mainContainer}>
          {/* Barre de filtres */}
          <View style={styles.filterBar}>
            <View style={styles.searchContainer}>
              <Search size={20} color="#666" />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher..."
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
                style={styles.filterButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={20} color="#2196F3" />
                <Text style={styles.filterButtonText}>
                  {dateFilter ? dateFilter.toLocaleDateString() : 'Date'}
                </Text>
                {dateFilter && (
                  <Pressable onPress={() => setDateFilter(null)}>
                    <X size={16} color="#F44336" />
                  </Pressable>
                )}
              </Pressable>

              <Pressable
                style={styles.filterButton}
                onPress={() =>
                  setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
                }
              >
                {sortOrder === 'desc' ? (
                  <ArrowDownAZ size={20} color="#2196F3" />
                ) : (
                  <ArrowUpAZ size={20} color="#2196F3" />
                )}
                <Text style={styles.filterButtonText}>
                  {sortOrder === 'desc' ? 'Récent→Ancien' : 'Ancien→Récent'}
                </Text>
              </Pressable>

              <Pressable style={styles.deleteButton} onPress={handleDeleteAll}>
                <Trash2 size={20} color="#F44336" />
                <Text style={styles.deleteButtonText}>Supprimer tout</Text>
              </Pressable>

              <Pressable style={styles.refreshButton} onPress={loadBills}>
                <RefreshCw size={20} color="#2196F3" />
                <Text style={styles.refreshButtonText}>Actualiser</Text>
              </Pressable>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={dateFilter || new Date()}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setDateFilter(date);
                }}
              />
            )}
          </View>

          <View style={styles.content}>
            {/* Liste des factures */}
            <View style={styles.billsList}>
              <Text style={styles.listTitle}>
                Historique ({sortedBills.length})
              </Text>
              <FlatList
                data={sortedBills}
                renderItem={renderBillItem}
                keyExtractor={(item) => item.id.toString()}
                extraData={selectedBill?.id}
              />
            </View>

            {/* Détails de la facture */}
            <View style={styles.billDetails}>
              {selectedBill ? (
                <>
                  <View style={styles.selectedBillHeader}>
                    <Text style={styles.selectedBillTitle}>
                      {selectedBill.tableName ||
                        `Table ${selectedBill.tableNumber}`}
                    </Text>
                    <Text
                      style={[
                        styles.selectedBillStatus,
                        {
                          color:
                            STATUS_COLORS[selectedBill.status] ||
                            STATUS_COLORS.default,
                        },
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
                        <Text style={styles.detailLabel}>Paiement:</Text>
                        <Text style={styles.detailValue}>
                          {PAYMENT_METHOD_LABELS[selectedBill.paymentMethod] ||
                            selectedBill.paymentMethod}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.actionsContainer}>
                    <Pressable
                      style={styles.actionButton}
                      onPress={() => setViewModalVisible(true)}
                    >
                      <Eye size={20} color="#2196F3" />
                      <Text style={styles.actionText}>Voir</Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionButton}
                      onPress={handlePrint}
                    >
                      <Printer size={20} color="#4CAF50" />
                      <Text style={styles.actionText}>Imprimer</Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionButton}
                      onPress={handleShare}
                    >
                      <Download size={20} color="#FF9800" />
                      <Text style={styles.actionText}>Partager</Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionButton}
                      onPress={handleDeleteBill}
                    >
                      <Trash2 size={20} color="#F44336" />
                      <Text style={styles.actionText}>Supprimer</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <View style={styles.noBillSelected}>
                  <Text style={styles.noBillText}>
                    Sélectionnez une facture
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Modal de visualisation */}
      <Modal visible={viewModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.receiptModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reçu</Text>
              <Pressable onPress={() => setViewModalVisible(false)}>
                <X size={24} color="#666" />
              </Pressable>
            </View>

            {selectedBill && (
              <ScrollView style={styles.receiptContent}>
                <View style={styles.restaurantInfo}>
                  <Text style={styles.restaurantName}>
                    {restaurantInfo.name}
                  </Text>
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
                    {selectedBill.tableName ||
                      `Table ${selectedBill.tableNumber}`}
                  </Text>
                  <Text style={styles.billDate}>
                    {new Date(selectedBill.timestamp).toLocaleString()}
                  </Text>
                  {selectedBill.section && (
                    <Text style={styles.billSection}>
                      Section: {selectedBill.section}
                    </Text>
                  )}
                </View>

                <View style={styles.receiptDivider} />

                <View style={styles.billSummary}>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Articles:</Text>
                    <Text style={styles.billValue}>{selectedBill.items}</Text>
                  </View>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Montant:</Text>
                    <Text style={styles.billAmount}>
                      {selectedBill.amount.toFixed(2)} €
                    </Text>
                  </View>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Statut:</Text>
                    <Text
                      style={[
                        styles.billStatus,
                        {
                          color:
                            STATUS_COLORS[selectedBill.status] ||
                            STATUS_COLORS.default,
                        },
                      ]}
                    >
                      {selectedBill.status}
                    </Text>
                  </View>
                  {selectedBill.paymentMethod && (
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Paiement:</Text>
                      <Text style={styles.billValue}>
                        {PAYMENT_METHOD_LABELS[selectedBill.paymentMethod] ||
                          selectedBill.paymentMethod}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.receiptDivider} />
                <Text style={styles.receiptFooter}>Merci de votre visite!</Text>
              </ScrollView>
            )}

            <View style={styles.receiptActions}>
              <Pressable style={styles.receiptAction} onPress={handlePrint}>
                <Printer size={20} color="#4CAF50" />
                <Text style={styles.receiptActionText}>Imprimer</Text>
              </Pressable>
              <Pressable style={styles.receiptAction} onPress={handleShare}>
                <ShareIcon size={20} color="#2196F3" />
                <Text style={styles.receiptActionText}>Partager</Text>
              </Pressable>
              <Pressable
                style={styles.receiptAction}
                onPress={handleDeleteBill}
              >
                <Trash2 size={20} color="#F44336" />
                <Text style={styles.receiptActionText}>Supprimer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Styles (conservés mais simplifiés)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 20, fontSize: 18, fontWeight: 'bold', color: '#666' },
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: { fontSize: 24, fontWeight: 'bold' },
  mainContainer: { flex: 1 },
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
  filterActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  filterButtonText: { color: '#2196F3', fontWeight: '500' },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  deleteButtonText: { color: '#F44336', fontWeight: '500' },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  refreshButtonText: { color: '#2196F3', fontWeight: '500' },
  content: { flex: 1, flexDirection: 'row' },
  billsList: {
    width: 300,
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    padding: 16,
  },
  listTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  billItem: {
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
  billItemDate: { fontSize: 12, color: '#666' },
  billDetails: {
    flex: 1,
    padding: 20,
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
  },
  noBillSelected: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noBillText: { fontSize: 16, color: '#666', fontStyle: 'italic' },
  selectedBillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectedBillTitle: { fontSize: 24, fontWeight: '600' },
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
  actionsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
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
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
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
    zIndex: 1000,
  },
  processingText: { color: 'white', marginTop: 12, fontSize: 16 },
});
