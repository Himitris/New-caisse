// app/(tabs)/bills.tsx - Version complètement fonctionnelle

import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal, ActivityIndicator, Share } from 'react-native';
import { useState, useEffect } from 'react';
import { Receipt, Printer, Download, Share as ShareIcon, Eye, X } from 'lucide-react-native';
import { getBills } from '../../utils/storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

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
}

// Modal pour voir le reçu
const ViewReceiptModal: React.FC<ViewReceiptModalProps> = ({
  visible,
  bill,
  onClose,
  onPrint,
  onShare
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
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default function BillsScreen() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  // Load bills on component mount
  useEffect(() => {
    loadBills();
  }, []);

  // Function to load bills from storage
  const loadBills = async () => {
    try {
      setLoading(true);
      const loadedBills = await getBills();
      // Sort bills by timestamp (newest first)
      const sortedBills = loadedBills.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setBills(sortedBills);

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
            <h1>Restaurant Manjos</h1>
            <p>123 Route du Sud</p>
            <p>05 55 55 55 55</p>
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
            <p>Merci de votre visite!</p>
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
        <View style={styles.content}>
          {/* Liste des factures à gauche */}
          <View style={styles.billsList}>
            <Text style={styles.listTitle}>Historique des Factures</Text>
            <ScrollView>
              {bills.map((bill) => (
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
                    {new Date(bill.timestamp).toLocaleDateString()}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Détails de la facture sélectionnée */}
          <View style={styles.billDetails}>
            {selectedBill ? (
              <>
                <View style={styles.selectedBillHeader}>
                  <View>
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
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Articles:</Text>
                    <Text style={styles.detailValue}>{selectedBill.items} articles</Text>
                  </View>
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
                </View>
              </>
            ) : (
              <View style={styles.noBillSelected}>
                <Text style={styles.noBillText}>Sélectionnez une facture pour voir les détails</Text>
              </View>
            )}
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
  content: {
    flex: 1,
    flexDirection: 'row',
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
});