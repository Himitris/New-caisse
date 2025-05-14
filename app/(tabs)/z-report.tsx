// app/(tabs)/z-report.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Printer,
  Share,
  CalendarDays,
  RefreshCw,
  Download,
  Archive,
  Plus,
  Minus,
  Receipt,
  PieChart,
  DollarSign,
  CreditCard,
  Wallet,
  Edit3,
  Clock,
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useToast } from '../../utils/ToastContext';
import { getBills, Bill } from '../../utils/storage';
import {
  generateZReportData,
  formatMoney,
  formatDate,
  getPaymentMethodLabel,
  getPaymentTypeLabel,
} from '../../utils/report-utils';

export default function ZReportScreen() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [bills, setBills] = useState<Bill[]>([]);
  const [filterDate, setFilterDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const toast = useToast();

  // Rapport Z généré à partir des factures
  const [reportData, setReportData] = useState(generateZReportData([]));

  // Load bills for the selected date
  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      const allBills = await getBills();

      // Filter bills for the selected date
      const selectedDate = new Date(filterDate);
      selectedDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(selectedDate);
      nextDay.setDate(selectedDate.getDate() + 1);

      const filteredBills = allBills.filter((bill) => {
        const billDate = new Date(bill.timestamp);
        return billDate >= selectedDate && billDate < nextDay;
      });

      setBills(filteredBills);

      // Générer les données de rapport
      const report = generateZReportData(filteredBills);
      setReportData(report);
    } catch (error) {
      console.error('Error loading bills:', error);
      toast.showToast('Impossible de charger les factures.', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterDate, toast]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFilterDate(selectedDate);
    }
  };

  // Function to generate the Z report HTML
  const generateZReportHTML = () => {
    const dateFormatted = formatDate(filterDate);

    // Format payment methods section
    let paymentMethodsHTML = '';
    Object.entries(reportData.salesByMethod).forEach(([method, amount]) => {
      paymentMethodsHTML += `
        <tr>
          <td>${getPaymentMethodLabel(method)}</td>
          <td style="text-align: right;">${amount.toFixed(2)}€</td>
        </tr>
      `;
    });

    // Format sections sales
    let sectionSalesHTML = '';
    Object.entries(reportData.salesBySection).forEach(([section, amount]) => {
      sectionSalesHTML += `
        <tr>
          <td>${section}</td>
          <td style="text-align: right;">${amount.toFixed(2)}€</td>
        </tr>
      `;
    });

    // Format payment types section
    let paymentTypesHTML = '';
    Object.entries(reportData.salesByType).forEach(([type, amount]) => {
      paymentTypesHTML += `
        <tr>
          <td>${getPaymentTypeLabel(type)}</td>
          <td style="text-align: right;">${amount.toFixed(2)}€</td>
        </tr>
      `;
    });

    // Ajouter la plage horaire si disponible
    let timeRangeHTML = '';
    if (reportData.startTime && reportData.endTime) {
      timeRangeHTML = `<p style="text-align: center;">Plage horaire: ${reportData.dateRange}</p>`;
    }

    return `
      <!DOCTYPE html>
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
              font-size: 10pt;
            }
            .header, .footer { 
              text-align: center; 
              margin-bottom: 5mm;
            }
            .header h1 {
              font-size: 14pt;
              margin: 0 0 2mm 0;
            }
            .header p, .footer p {
              margin: 0 0 1mm 0;
              font-size: 9pt;
            }
            .divider {
              border-bottom: 1px dashed #000;
              margin: 3mm 0;
            }
            .section-title {
              font-weight: bold;
              text-align: center;
              margin: 3mm 0;
              font-size: 10pt;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 3mm;
            }
            th, td {
              padding: 1mm 0;
              font-size: 9pt;
            }
            tr.total-row td {
              border-top: 1px solid #000;
              font-weight: bold;
              padding-top: 2mm;
            }
            .timestamp {
              font-size: 8pt;
              text-align: center;
              margin-top: 5mm;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Manjo Carn</h1>
            <p>Route de la Corniche, 82140 Saint Antonin Noble Val</p>
            <p>Tel : 0563682585</p>
          </div>
  
          <div class="section-title">RAPPORT Z JOURNALIER</div>
          <p style="text-align: center; font-weight: bold;">Date: ${dateFormatted}</p>
          ${timeRangeHTML}
          
          <div class="divider"></div>
          
          <div class="section-title">RÉSUMÉ DES VENTES</div>
          <table>
            <tr>
              <td>Total CA</td>
              <td style="text-align: right;">${reportData.totalSales.toFixed(
                2
              )}€</td>
            </tr>
            <tr>
              <td>Nombre de transactions</td>
              <td style="text-align: right;">${
                reportData.totalTransactions
              }</td>
            </tr>
            <tr>
              <td>Ticket moyen</td>
              <td style="text-align: right;">${reportData.averageTicket.toFixed(
                2
              )}€</td>
            </tr>
            <tr>
              <td>Articles vendus</td>
              <td style="text-align: right;">${reportData.totalItems}</td>
            </tr>
            ${
              reportData.offeredTotal > 0
                ? `
            <tr>
              <td>Articles offerts</td>
              <td style="text-align: right;">${reportData.offeredTotal.toFixed(
                2
              )}€</td>
            </tr>
            `
                : ''
            }
          </table>
          
          <div class="divider"></div>
          
          <div class="section-title">VENTES PAR MOYEN DE PAIEMENT</div>
          <table>
            ${paymentMethodsHTML}
            <tr class="total-row">
              <td>Total</td>
              <td style="text-align: right;">${reportData.totalSales.toFixed(
                2
              )}€</td>
            </tr>
          </table>
          
          <div class="divider"></div>
          
          <div class="footer">
            <p>TVA non applicable - art.293B du CGI</p>
            <p>${reportData.totalTransactions} transactions</p>
          </div>
          
          <div class="timestamp">
            Édité le ${new Date().toLocaleString('fr-FR')}
          </div>
        </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    setProcessing(true);
    try {
      await Print.printAsync({
        html: generateZReportHTML(),
        width: 80,
      });
      toast.showToast('Rapport Z imprimé avec succès', 'success');
    } catch (error) {
      console.error("Erreur lors de l'impression:", error);
      toast.showToast("Erreur lors de l'impression", 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleShare = async () => {
    setProcessing(true);
    try {
      const { uri } = await Print.printToFileAsync({
        html: generateZReportHTML(),
        width: 80,
      });
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
      });
      toast.showToast('Rapport Z partagé avec succès', 'success');
    } catch (error) {
      console.error('Erreur lors du partage:', error);
      toast.showToast('Erreur lors du partage', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = async () => {
    setProcessing(true);
    try {
      const { uri } = await Print.printToFileAsync({
        html: generateZReportHTML(),
        width: 80,
      });
      await Sharing.shareAsync(uri, {
        dialogTitle: 'Enregistrer le rapport Z',
        UTI: '.pdf',
        mimeType: 'application/pdf',
      });
      toast.showToast('Rapport Z téléchargé avec succès', 'success');
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      toast.showToast('Erreur lors du téléchargement', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.processingText}>Traitement en cours...</Text>
        </View>
      )}
      <View style={styles.header}>
        <Text style={styles.title}>Rapport Z Journalier</Text>
        <View style={styles.dateSelector}>
          <Pressable
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <CalendarDays size={20} color="#2196F3" />
            <Text style={styles.dateButtonText}>{formatDate(filterDate)}</Text>
          </Pressable>

          {showDatePicker && (
            <DateTimePicker
              value={filterDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
            />
          )}

          <Pressable style={styles.refreshButton} onPress={loadBills}>
            <RefreshCw size={20} color="#4CAF50" />
            <Text style={styles.refreshButtonText}>Actualiser</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Chargement des données...</Text>
        </View>
      ) : bills.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Receipt size={60} color="#cccccc" />
          <Text style={styles.emptyText}>
            Aucune facture trouvée pour cette date
          </Text>
          <Text style={styles.emptySubtext}>
            Sélectionnez une autre date ou vérifiez vos factures
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {/* Period Info */}
          {reportData.startTime && reportData.endTime && (
            <View style={styles.periodCard}>
              <View style={styles.periodRow}>
                <Clock size={20} color="#2196F3" />
                <Text style={styles.periodText}>
                  Plage horaire : {reportData.dateRange}
                </Text>
              </View>
            </View>
          )}

          {/* Summary Stats */}
          <View style={styles.summaryCard}>
            <Text style={styles.cardTitle}>Résumé des Ventes</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <PieChart size={24} color="#2196F3" />
                <Text style={styles.summaryLabel}>Total CA</Text>
                <Text style={styles.summaryValue}>
                  {formatMoney(reportData.totalSales)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <DollarSign size={24} color="#4CAF50" />
                <Text style={styles.summaryLabel}>Ticket Moyen</Text>
                <Text style={styles.summaryValue}>
                  {formatMoney(reportData.averageTicket)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Archive size={24} color="#FF9800" />
                <Text style={styles.summaryLabel}>Transactions</Text>
                <Text style={styles.summaryValue}>
                  {reportData.totalTransactions}
                </Text>
              </View>
            </View>

            {reportData.offeredTotal > 0 && (
              <View style={styles.offeredContainer}>
                <Text style={styles.offeredLabel}>Total articles offerts:</Text>
                <Text style={styles.offeredValue}>
                  {formatMoney(reportData.offeredTotal)}
                </Text>
              </View>
            )}
          </View>

          {/* Payment Methods */}
          <View style={styles.detailCard}>
            <Text style={styles.cardTitle}>
              Répartition par Moyen de Paiement
            </Text>
            {Object.entries(reportData.salesByMethod).map(
              ([method, amount]) => (
                <View key={`method-${method}`} style={styles.detailRow}>
                  <View style={styles.detailLabelContainer}>
                    {method === 'card' ? (
                      <CreditCard size={16} color="#2196F3" />
                    ) : method === 'cash' ? (
                      <Wallet size={16} color="#4CAF50" />
                    ) : method === 'check' ? (
                      <Edit3 size={16} color="#9C27B0" />
                    ) : (
                      <DollarSign size={16} color="#757575" />
                    )}
                    <Text style={styles.detailLabel}>
                      {getPaymentMethodLabel(method)}
                    </Text>
                  </View>
                  <Text style={styles.detailValue}>{formatMoney(amount)}</Text>
                </View>
              )
            )}
            <View style={styles.detailRowTotal}>
              <Text style={styles.detailLabelTotal}>Total</Text>
              <Text style={styles.detailValueTotal}>
                {formatMoney(reportData.totalSales)}
              </Text>
            </View>
          </View>

          {/* Sections */}
          <View style={styles.detailCard}>
            <Text style={styles.cardTitle}>Ventes par Section</Text>
            {Object.entries(reportData.salesBySection).map(
              ([section, amount]) => (
                <View key={`section-${section}`} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{section}</Text>
                  <Text style={styles.detailValue}>{formatMoney(amount)}</Text>
                </View>
              )
            )}
            <View style={styles.detailRowTotal}>
              <Text style={styles.detailLabelTotal}>Total</Text>
              <Text style={styles.detailValueTotal}>
                {formatMoney(reportData.totalSales)}
              </Text>
            </View>
          </View>

          {/* Payment Types */}
          <View style={styles.detailCard}>
            <Text style={styles.cardTitle}>
              Répartition par Type de Paiement
            </Text>
            {Object.entries(reportData.salesByType).map(([type, amount]) => (
              <View key={`type-${type}`} style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  {getPaymentTypeLabel(type)}
                </Text>
                <Text style={styles.detailValue}>{formatMoney(amount)}</Text>
              </View>
            ))}
            <View style={styles.detailRowTotal}>
              <Text style={styles.detailLabelTotal}>Total</Text>
              <Text style={styles.detailValueTotal}>
                {formatMoney(reportData.totalSales)}
              </Text>
            </View>
          </View>

          {/* Categories */}
          {Object.keys(reportData.salesByCategory).length > 0 && (
            <View style={styles.detailCard}>
              <Text style={styles.cardTitle}>Ventes par Catégorie</Text>
              {Object.entries(reportData.salesByCategory).map(
                ([category, data]) => (
                  <View key={`category-${category}`} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{category}</Text>
                    <Text style={styles.detailValue}>
                      {formatMoney(data.total)}
                    </Text>
                  </View>
                )
              )}
              <View style={styles.detailRowTotal}>
                <Text style={styles.detailLabelTotal}>Total</Text>
                <Text style={styles.detailValueTotal}>
                  {formatMoney(reportData.totalSales)}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Pressable
          style={[
            styles.actionButton,
            styles.printButton,
            bills.length === 0 && styles.disabledButton,
          ]}
          onPress={handlePrint}
          disabled={bills.length === 0 || processing}
        >
          <Printer size={24} color="white" />
          <Text style={styles.actionButtonText}>Imprimer le rapport Z</Text>
        </Pressable>

        <Pressable
          style={[
            styles.actionButton,
            styles.shareButton,
            bills.length === 0 && styles.disabledButton,
          ]}
          onPress={handleShare}
          disabled={bills.length === 0 || processing}
        >
          <Share size={24} color="white" />
          <Text style={styles.actionButtonText}>Partager en PDF</Text>
        </Pressable>

        <Pressable
          style={[
            styles.actionButton,
            styles.downloadButton,
            bills.length === 0 && styles.disabledButton,
          ]}
          onPress={handleDownload}
          disabled={bills.length === 0 || processing}
        >
          <Download size={24} color="white" />
          <Text style={styles.actionButtonText}>Télécharger</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbdefb',
    gap: 8,
  },
  dateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c8e6c9',
    gap: 8,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  content: {
    flex: 1,
    padding: 16,
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
  periodCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  periodText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  detailCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  detailRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  detailLabelTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  detailValueTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  printButton: {
    backgroundColor: '#4CAF50',
  },
  shareButton: {
    backgroundColor: '#2196F3',
  },
  downloadButton: {
    backgroundColor: '#FF9800',
  },
  disabledButton: {
    opacity: 0.5,
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
    zIndex: 1000,
  },
  processingText: {
    color: 'white',
    marginTop: 12,
    fontSize: 16,
  },
  offeredContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD54F',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offeredLabel: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '500',
  },
  offeredValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9800',
  },
});
