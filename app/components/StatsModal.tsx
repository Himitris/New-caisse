// StatsModal.tsx - Composant pour le modal de statistiques des ventes
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { X, Calendar, ChevronRight, AlertCircle, TrendingUp, BarChart3, DollarSign, Users, Gift } from 'lucide-react-native';
import { getBills, Bill } from '../../utils/storage';
import DateTimePicker from '@react-native-community/datetimepicker';

interface StatsModalProps {
  visible: boolean;
  onClose: () => void;
}

// Fonction utilitaire pour formater la date
const formatDate = (date: Date, format: 'short' | 'long' = 'short'): string => {
  if (format === 'short') {
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  } else {
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }
};

// Fonction utilitaire pour comparer si deux dates sont le même jour
const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear();
};

// Fonction pour obtenir les derniers jours
const getLastNDays = (n: number): Date[] => {
  const days = [];
  for (let i = 0; i < n; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    days.push(date);
  }
  return days;
};

// Interface pour les statistiques par jour
interface DayStats {
  date: Date;
  totalSales: number;
  paymentCount: number;
  averageTicket: number;
  paymentMethods: {
    card: number;
    cash: number;
    check: number;
    unknown: number;
  };
  paymentTypes: {
    full: number;
    split: number;
    custom: number;
    unknown: number;
  };
  offeredTotal: number; // Nouveau champ pour le total des articles offerts
  offeredCount: number; // Nouveau champ pour le nombre d'articles offerts
}

// Interface pour les statistiques par période
interface PeriodStats {
  startDate: Date;
  endDate: Date;
  totalSales: number;
  paymentCount: number;
  averageTicket: number;
  dailyAverage: number;
  busyTables: { tableNumber: number; tableName: string; amount: number }[];
  offeredTotal: number; // Nouveau champ pour le total des articles offerts
  offeredCount: number; // Nouveau champ pour le nombre de factures avec des articles offerts
  offeredPercentage: number; // Nouveau champ pour le pourcentage des ventes "offert"
}

const StatsModal: React.FC<StatsModalProps> = ({ visible, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState<DayStats[]>([]);
  const [periodStats, setPeriodStats] = useState<PeriodStats | null>(null);
  const [activeView, setActiveView] = useState<'daily' | 'period' | 'custom'>('daily');
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [expandedDay, setExpandedDay] = useState<Date | null>(null);

  // Modifier pour afficher différentes périodes
  const [selectedPeriod, setSelectedPeriod] = useState<'3days' | '7days' | '30days' | 'custom'>('3days');

  // Chargement des données
  useEffect(() => {
    if (visible) {
      loadStats();
    }
  }, [visible, selectedPeriod, customStartDate, customEndDate]);

  // Charger les statistiques
  const loadStats = async () => {
    setLoading(true);
    try {
      // Charger toutes les factures
      const bills = await getBills();

      // Déterminer la période sélectionnée
      let startDate: Date;
      let endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      if (selectedPeriod === 'custom') {
        startDate = new Date(customStartDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999);
      } else {
        const daysToLookBack =
          selectedPeriod === '3days' ? 3 : selectedPeriod === '7days' ? 7 : 30;
        startDate = new Date();
        startDate.setDate(startDate.getDate() - (daysToLookBack - 1));
        startDate.setHours(0, 0, 0, 0);
      }

      // Filtrer les factures pour la période
      const filteredBills = bills.filter((bill) => {
        const billDate = new Date(bill.timestamp);
        return billDate >= startDate && billDate <= endDate;
      });

      // Générer les statistiques quotidiennes
      const days = [];
      let currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dayBills = filteredBills.filter((bill) => {
          const billDate = new Date(bill.timestamp);
          return isSameDay(billDate, currentDate);
        });

        const totalSales = dayBills.reduce((sum, bill) => sum + bill.amount, 0);
        const paymentCount = dayBills.length;

        // Compter les méthodes de paiement
        const paymentMethods = {
          card: dayBills.filter((bill) => bill.paymentMethod === 'card').length,
          cash: dayBills.filter((bill) => bill.paymentMethod === 'cash').length,
          check: dayBills.filter((bill) => bill.paymentMethod === 'check')
            .length,
          unknown: dayBills.filter((bill) => !bill.paymentMethod).length,
        };

        // Compter les types de paiement
        const paymentTypes = {
          full: dayBills.filter((bill) => bill.paymentType === 'full').length,
          split: dayBills.filter((bill) => bill.paymentType === 'split').length,
          custom: dayBills.filter((bill) => bill.paymentType === 'custom')
            .length,
          unknown: dayBills.filter((bill) => !bill.paymentType).length,
        };

        // Calculer le total des articles offerts pour ce jour
        const offeredTotal = dayBills.reduce((sum, bill) => {
          // Si la facture a un champ offeredAmount, l'utiliser
          if (typeof bill.offeredAmount === 'number') {
            return sum + bill.offeredAmount;
          }

          // Sinon, essayer de calculer à partir des articles
          if (bill.paidItems && Array.isArray(bill.paidItems)) {
            return (
              sum +
              bill.paidItems.reduce((itemSum, item) => {
                if (item.offered) {
                  return itemSum + item.price * item.quantity;
                }
                return itemSum;
              }, 0)
            );
          }

          return sum;
        }, 0);

        // Compter le nombre de factures avec des articles offerts
        const offeredCount = dayBills.filter((bill) => {
          // Si bill.offeredAmount existe et est supérieur à 0
          if (
            typeof bill.offeredAmount === 'number' &&
            bill.offeredAmount > 0
          ) {
            return true;
          }

          // Ou si au moins un article est marqué comme offert
          if (bill.paidItems && Array.isArray(bill.paidItems)) {
            return bill.paidItems.some((item) => item.offered);
          }

          return false;
        }).length;

        days.push({
          date: new Date(currentDate),
          totalSales,
          paymentCount,
          averageTicket: paymentCount > 0 ? totalSales / paymentCount : 0,
          paymentMethods,
          paymentTypes,
          offeredTotal,
          offeredCount,
        });

        // Passer au jour suivant
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
      }

      setDailyStats(days);

      // Calculer les statistiques de la période
      const totalSales = filteredBills.reduce(
        (sum, bill) => sum + bill.amount,
        0
      );
      const paymentCount = filteredBills.length;

      // Trouver les tables les plus occupées
      const tableMap = new Map<
        number,
        { tableNumber: number; tableName: string; amount: number }
      >();

      filteredBills.forEach((bill) => {
        if (!tableMap.has(bill.tableNumber)) {
          tableMap.set(bill.tableNumber, {
            tableNumber: bill.tableNumber,
            tableName: bill.tableName || `Table ${bill.tableNumber}`,
            amount: 0,
          });
        }

        const tableData = tableMap.get(bill.tableNumber)!;
        tableData.amount += bill.amount;
      });

      const busyTables = Array.from(tableMap.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      // Calculer le nombre de jours dans la période
      const daysDiff = Math.max(
        1,
        Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      );

      // Calculer le total des articles offerts pour toute la période
      const periodOfferedTotal = filteredBills.reduce((sum, bill) => {
        // Si la facture a un champ offeredAmount, l'utiliser
        if (typeof bill.offeredAmount === 'number') {
          return sum + bill.offeredAmount;
        }

        // Sinon, essayer de calculer à partir des articles
        if (bill.paidItems && Array.isArray(bill.paidItems)) {
          return (
            sum +
            bill.paidItems.reduce((itemSum, item) => {
              if (item.offered) {
                return itemSum + item.price * item.quantity;
              }
              return itemSum;
            }, 0)
          );
        }

        return sum;
      }, 0);

      // Compter le nombre de factures avec des articles offerts
      const periodOfferedCount = filteredBills.filter((bill) => {
        // Si bill.offeredAmount existe et est supérieur à 0
        if (typeof bill.offeredAmount === 'number' && bill.offeredAmount > 0) {
          return true;
        }

        // Ou si au moins un article est marqué comme offert
        if (bill.paidItems && Array.isArray(bill.paidItems)) {
          return bill.paidItems.some((item) => item.offered);
        }

        return false;
      }).length;

      // Calculer le pourcentage des ventes "offert"
      const periodOfferedPercentage =
        totalSales > 0
          ? (periodOfferedTotal / (totalSales + periodOfferedTotal)) * 100
          : 0;

      setPeriodStats({
        startDate,
        endDate,
        totalSales,
        paymentCount,
        averageTicket: paymentCount > 0 ? totalSales / paymentCount : 0,
        dailyAverage: totalSales / daysDiff,
        busyTables,
        offeredTotal: periodOfferedTotal,
        offeredCount: periodOfferedCount,
        offeredPercentage: periodOfferedPercentage,
      });
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    } finally {
      setLoading(false);
    }
  };

  // Gestionnaire de changement de date
  const handleDateChange = (event: any, selectedDate: Date | undefined, isStartDate: boolean) => {
    if (selectedDate) {
      if (isStartDate) {
        setShowStartDatePicker(false);
        setCustomStartDate(selectedDate);
      } else {
        setShowEndDatePicker(false);
        setCustomEndDate(selectedDate);
      }
    } else {
      setShowStartDatePicker(false);
      setShowEndDatePicker(false);
    }
  };

  // Gestionnaire pour changer la période
  const handlePeriodChange = (period: '3days' | '7days' | '30days' | 'custom') => {
    setSelectedPeriod(period);
    if (period === 'custom') {
      // Initialiser les dates personnalisées si nécessaire
      if (!customStartDate) {
        const start = new Date();
        start.setDate(start.getDate() - 6);
        setCustomStartDate(start);
      }
      if (!customEndDate) {
        setCustomEndDate(new Date());
      }
    }
  };

  // Toggle l'expansion d'un jour
  const toggleDayExpansion = (date: Date) => {
    if (expandedDay && isSameDay(expandedDay, date)) {
      setExpandedDay(null);
    } else {
      setExpandedDay(date);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* En-tête du modal */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Statistiques de vente</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#666" />
            </Pressable>
          </View>

          {/* Onglets de navigation */}
          <View style={styles.tabsContainer}>
            <Pressable
              style={[
                styles.tab,
                selectedPeriod === '3days' && styles.activeTab,
              ]}
              onPress={() => handlePeriodChange('3days')}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedPeriod === '3days' && styles.activeTabText,
                ]}
              >
                3 derniers jours
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.tab,
                selectedPeriod === '7days' && styles.activeTab,
              ]}
              onPress={() => handlePeriodChange('7days')}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedPeriod === '7days' && styles.activeTabText,
                ]}
              >
                7 jours
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.tab,
                selectedPeriod === '30days' && styles.activeTab,
              ]}
              onPress={() => handlePeriodChange('30days')}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedPeriod === '30days' && styles.activeTabText,
                ]}
              >
                30 jours
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.tab,
                selectedPeriod === 'custom' && styles.activeTab,
              ]}
              onPress={() => handlePeriodChange('custom')}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedPeriod === 'custom' && styles.activeTabText,
                ]}
              >
                Personnalisé
              </Text>
            </Pressable>
          </View>

          {/* Sélecteurs de date pour la période personnalisée */}
          {selectedPeriod === 'custom' && (
            <View style={styles.datePickersContainer}>
              <View style={styles.datePickerRow}>
                <Text style={styles.datePickerLabel}>Du:</Text>
                <Pressable
                  style={styles.datePickerButton}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <Text style={styles.datePickerButtonText}>
                    {formatDate(customStartDate, 'long')}
                  </Text>
                  <Calendar size={18} color="#2196F3" />
                </Pressable>
                {showStartDatePicker && (
                  <DateTimePicker
                    value={customStartDate}
                    mode="date"
                    display="default"
                    onChange={(event, date) =>
                      handleDateChange(event, date, true)
                    }
                  />
                )}
              </View>

              <View style={styles.datePickerRow}>
                <Text style={styles.datePickerLabel}>Au:</Text>
                <Pressable
                  style={styles.datePickerButton}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Text style={styles.datePickerButtonText}>
                    {formatDate(customEndDate, 'long')}
                  </Text>
                  <Calendar size={18} color="#2196F3" />
                </Pressable>
                {showEndDatePicker && (
                  <DateTimePicker
                    value={customEndDate}
                    mode="date"
                    display="default"
                    onChange={(event, date) =>
                      handleDateChange(event, date, false)
                    }
                  />
                )}
              </View>
            </View>
          )}

          {/* Onglets pour les différentes vues */}
          <View style={styles.viewTabsContainer}>
            <Pressable
              style={[
                styles.viewTab,
                activeView === 'daily' && styles.activeViewTab,
              ]}
              onPress={() => setActiveView('daily')}
            >
              <BarChart3
                size={16}
                color={activeView === 'daily' ? '#2196F3' : '#666'}
              />
              <Text
                style={[
                  styles.viewTabText,
                  activeView === 'daily' && styles.activeViewTabText,
                ]}
              >
                Jours
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.viewTab,
                activeView === 'period' && styles.activeViewTab,
              ]}
              onPress={() => setActiveView('period')}
            >
              <TrendingUp
                size={16}
                color={activeView === 'period' ? '#2196F3' : '#666'}
              />
              <Text
                style={[
                  styles.viewTabText,
                  activeView === 'period' && styles.activeViewTabText,
                ]}
              >
                Résumé
              </Text>
            </Pressable>
          </View>

          {/* Contenu principal */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.loadingText}>
                Chargement des statistiques...
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.contentContainer}>
              {activeView === 'daily' ? (
                <>
                  {dailyStats.length === 0 ? (
                    <View style={styles.noDataContainer}>
                      <AlertCircle size={40} color="#FFC107" />
                      <Text style={styles.noDataText}>
                        Aucune donnée disponible pour cette période
                      </Text>
                    </View>
                  ) : (
                    dailyStats.map((dayStat, index) => (
                      <View key={index} style={styles.dayCard}>
                        <TouchableOpacity
                          style={[
                            styles.dayCardHeader,
                            expandedDay ? styles.dayCardHeaderExpanded : null,
                          ]}
                          onPress={() => toggleDayExpansion(dayStat.date)}
                        >
                          <View style={styles.dayCardHeaderLeft}>
                            <Text style={styles.dayCardDate}>
                              {formatDate(dayStat.date, 'long')}
                            </Text>
                            <View style={styles.dayCardSummary}>
                              <View style={styles.daySummaryItem}>
                                <DollarSign size={14} color="#4CAF50" />
                                <Text style={styles.daySummaryText}>
                                  {dayStat.totalSales.toFixed(2)} €
                                </Text>
                              </View>
                              <View style={styles.daySummaryItem}>
                                <Users size={14} color="#2196F3" />
                                <Text style={styles.daySummaryText}>
                                  {dayStat.paymentCount} paiements
                                </Text>
                              </View>
                            </View>
                          </View>
                          <ChevronRight
                            size={20}
                            color="#666"
                            style={{
                              transform: [
                                {
                                  rotate:
                                    expandedDay &&
                                    isSameDay(expandedDay, dayStat.date)
                                      ? '90deg'
                                      : '0deg',
                                },
                              ],
                            }}
                          />
                        </TouchableOpacity>

                        {expandedDay &&
                          isSameDay(expandedDay, dayStat.date) && (
                            <View style={styles.dayCardDetails}>
                              <View style={styles.detailSection}>
                                <Text style={styles.detailSectionTitle}>
                                  Statistiques
                                </Text>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>
                                    Total des ventes
                                  </Text>
                                  <Text style={styles.detailValue}>
                                    {dayStat.totalSales.toFixed(2)} €
                                  </Text>
                                </View>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>
                                    Nombre de transactions
                                  </Text>
                                  <Text style={styles.detailValue}>
                                    {dayStat.paymentCount}
                                  </Text>
                                </View>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>
                                    Ticket moyen
                                  </Text>
                                  <Text style={styles.detailValue}>
                                    {dayStat.averageTicket > 0
                                      ? dayStat.averageTicket.toFixed(2)
                                      : '0.00'}{' '}
                                    €
                                  </Text>
                                </View>
                              </View>
                              {dayStat.offeredCount > 0 && (
                                <View style={styles.detailSection}>
                                  <Text style={styles.detailSectionTitle}>
                                    Articles Offerts
                                  </Text>
                                  <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>
                                      Montant total offert
                                    </Text>
                                    <Text style={styles.offeredValue}>
                                      {dayStat.offeredTotal.toFixed(2)} €
                                    </Text>
                                  </View>
                                  <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>
                                      Nombre de cadeaux
                                    </Text>
                                    <Text style={styles.detailValue}>
                                      {dayStat.offeredCount}
                                    </Text>
                                  </View>
                                  <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>
                                      % des ventes
                                    </Text>
                                    <Text style={styles.offeredValue}>
                                      {(
                                        (dayStat.offeredTotal /
                                          (dayStat.totalSales +
                                            dayStat.offeredTotal)) *
                                        100
                                      ).toFixed(1)}{' '}
                                      %
                                    </Text>
                                  </View>
                                </View>
                              )}

                              <View style={styles.detailSection}>
                                <Text style={styles.detailSectionTitle}>
                                  Méthodes de paiement
                                </Text>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>
                                    Carte bancaire
                                  </Text>
                                  <Text style={styles.detailValue}>
                                    {dayStat.paymentMethods.card}
                                  </Text>
                                </View>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>
                                    Espèces
                                  </Text>
                                  <Text style={styles.detailValue}>
                                    {dayStat.paymentMethods.cash}
                                  </Text>
                                </View>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>Chèque</Text>
                                  <Text style={styles.detailValue}>
                                    {dayStat.paymentMethods.check}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.detailSection}>
                                <Text style={styles.detailSectionTitle}>
                                  Types de paiement
                                </Text>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>
                                    Paiement complet
                                  </Text>
                                  <Text style={styles.detailValue}>
                                    {dayStat.paymentTypes.full}
                                  </Text>
                                </View>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>
                                    Paiement partagé
                                  </Text>
                                  <Text style={styles.detailValue}>
                                    {dayStat.paymentTypes.split}
                                  </Text>
                                </View>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>
                                    Paiement personnalisé
                                  </Text>
                                  <Text style={styles.detailValue}>
                                    {dayStat.paymentTypes.custom}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          )}
                      </View>
                    ))
                  )}
                </>
              ) : (
                <>
                  {periodStats ? (
                    <View style={styles.periodStatsContainer}>
                      <View style={styles.periodHeader}>
                        <Text style={styles.periodTitle}>
                          Rapport du {formatDate(periodStats.startDate, 'long')}{' '}
                          au {formatDate(periodStats.endDate, 'long')}
                        </Text>
                      </View>

                      <View style={styles.periodCardGrid}>
                        <View style={styles.periodCard}>
                          <DollarSign size={24} color="#4CAF50" />
                          <Text style={styles.periodCardValue}>
                            {periodStats.totalSales.toFixed(2)} €
                          </Text>
                          <Text style={styles.periodCardLabel}>
                            Ventes totales
                          </Text>
                        </View>

                        <View style={styles.periodCard}>
                          <Users size={24} color="#2196F3" />
                          <Text style={styles.periodCardValue}>
                            {periodStats.paymentCount}
                          </Text>
                          <Text style={styles.periodCardLabel}>
                            Transactions
                          </Text>
                        </View>
                        {periodStats.offeredTotal > 0 && (
                          <View style={styles.periodCard}>
                            <Gift size={24} color="#FF9800" />
                            <Text style={styles.periodCardValue}>
                              {periodStats.offeredTotal.toFixed(2)} €
                            </Text>
                            <Text style={styles.periodCardLabel}>
                              Articles offerts
                            </Text>
                            <Text style={styles.periodCardSubLabel}>
                              ({periodStats.offeredPercentage.toFixed(1)}% des
                              ventes)
                            </Text>
                          </View>
                        )}

                        <View style={styles.periodCard}>
                          <BarChart3 size={24} color="#9C27B0" />
                          <Text style={styles.periodCardValue}>
                            {periodStats.averageTicket > 0
                              ? periodStats.averageTicket.toFixed(2)
                              : '0.00'}{' '}
                            €
                          </Text>
                          <Text style={styles.periodCardLabel}>
                            Ticket moyen
                          </Text>
                        </View>

                        <View style={styles.periodCard}>
                          <TrendingUp size={24} color="#FF9800" />
                          <Text style={styles.periodCardValue}>
                            {periodStats.dailyAverage.toFixed(2)} €
                          </Text>
                          <Text style={styles.periodCardLabel}>
                            Moyenne quotidienne
                          </Text>
                        </View>
                      </View>

                      <View style={styles.topTablesSection}>
                        <Text style={styles.topTablesTitle}>
                          Top 5 des tables
                        </Text>
                        {periodStats.busyTables.length > 0 ? (
                          <View style={styles.topTablesContainer}>
                            {periodStats.busyTables.map((table, index) => (
                              <View key={index} style={styles.topTableRow}>
                                <View style={styles.topTableInfo}>
                                  <Text style={styles.topTableRank}>
                                    #{index + 1}
                                  </Text>
                                  <Text style={styles.topTableName}>
                                    {table.tableName}
                                  </Text>
                                </View>
                                <Text style={styles.topTableAmount}>
                                  {table.amount.toFixed(2)} €
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.noDataText}>
                            Aucune donnée disponible
                          </Text>
                        )}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.noDataContainer}>
                      <AlertCircle size={40} color="#FFC107" />
                      <Text style={styles.noDataText}>
                        Aucune donnée disponible pour cette période
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          )}

          {/* Bouton de fermeture en bas */}
          <View style={styles.modalFooter}>
            <Pressable style={styles.closeModalButton} onPress={onClose}>
              <Text style={styles.closeModalButtonText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    width: '90%',
    maxWidth: 800,
    height: '90%',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
  },
  activeTab: {
    backgroundColor: '#E3F2FD',
  },
  tabText: {
    color: '#666',
    fontWeight: '500',
    fontSize: 14,
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  viewTabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
  },
  viewTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  activeViewTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  viewTabText: {
    color: '#666',
    fontWeight: '500',
  },
  activeViewTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  datePickersContainer: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  datePickerLabel: {
    width: 40,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  datePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
  },
  datePickerButtonText: {
    fontSize: 14,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
    minHeight: 200,
    backgroundColor: '#f5f5f5',
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noDataText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  dayCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomColor: '#f0f0f0',
  },
  dayCardHeaderExpanded: {
    borderBottomWidth: 1,
  },

  dayCardHeaderLeft: {
    flex: 1,
  },
  dayCardDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  dayCardSummary: {
    flexDirection: 'row',
    gap: 16,
  },
  daySummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  daySummaryText: {
    fontSize: 14,
    color: '#666',
  },
  dayCardDetails: {
    padding: 16,
    backgroundColor: '#f9f9f9',
  },
  detailSection: {
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  periodStatsContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
  },
  periodHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  periodCardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    justifyContent: 'space-between',
  },
  periodCard: {
    width: '48%',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  periodCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 8,
  },
  periodCardLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  topTablesSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  topTablesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  topTablesContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  topTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  topTableInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topTableRank: {
    width: 30,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  topTableName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  topTableAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  offeredValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FF9800',
  },
  periodCardSubLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
  
});


export default StatsModal;