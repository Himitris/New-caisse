// app/components/PaymentHistoryModal.tsx

import React from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    Pressable,
    ScrollView,
    ActivityIndicator
} from 'react-native';
import { X, CreditCard, Wallet, Edit3, Split, Receipt } from 'lucide-react-native';
import { Bill } from '../../utils/storage';

interface PaymentHistoryModalProps {
    visible: boolean;
    onClose: () => void;
    tableHistory: Bill[];
    tableName: string;
    tableTotal?: number;
    refreshing: boolean;
    onRefresh: () => void;
}

// Fonction utilitaire pour formater la date
const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Fonction pour obtenir l'icône du mode de paiement
const PaymentMethodIcon = ({ method }: { method?: 'card' | 'cash' | 'check' }) => {
    switch (method) {
        case 'card':
            return <CreditCard size={18} color="#2196F3" />;
        case 'cash':
            return <Wallet size={18} color="#4CAF50" />;
        case 'check':
            return <Edit3 size={18} color="#9C27B0" />;
        default:
            return null;
    }
};

// Fonction pour obtenir l'icône du type de paiement
const PaymentTypeIcon = ({ type }: { type?: 'full' | 'split' | 'custom' }) => {
    switch (type) {
        case 'full':
            return <CreditCard size={18} color="#F44336" />;
        case 'split':
            return <Split size={18} color="#FF9800" />;
        case 'custom':
            return <Receipt size={18} color="#673AB7" />;
        default:
            return null;
    }
};

const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({
    visible,
    onClose,
    tableHistory,
    tableName,
    tableTotal = 0,
    refreshing,
    onRefresh
}) => {
    const hasHistory = tableHistory && tableHistory.length > 0;

    // Calculer le total des paiements partiels
    const totalPartialPayments = tableHistory.reduce((sum, bill) => sum + bill.amount, 0);

    // Grouper les paiements par méthode
    const paymentsByMethod = tableHistory.reduce((acc: Record<string, number>, bill) => {
        const method = bill.paymentMethod || 'inconnu';
        acc[method] = (acc[method] || 0) + bill.amount;
        return acc;
    }, {});

    // Grouper les paiements par type
    const paymentsByType = tableHistory.reduce((acc: Record<string, number>, bill) => {
        const type = bill.paymentType || 'inconnu';
        acc[type] = (acc[type] || 0) + bill.amount;
        return acc;
    }, {});

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* En-tête fixe */}
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Historique des paiements</Text>
                        <Text style={styles.tableName}>{tableName}</Text>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <X size={24} color="#666" />
                        </Pressable>
                    </View>

                    {/* Contenu principal avec ScrollView */}
                    <View style={styles.contentContainer}>
                        <ScrollView contentContainerStyle={styles.scrollContentContainer}>
                            {/* En-tête avec résumé */}
                            <View style={styles.summarySectionOuter}>
                                <View style={styles.summarySection}>
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Total des paiements:</Text>
                                        <Text style={styles.summaryValue}>{totalPartialPayments.toFixed(2)} €</Text>
                                    </View>
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Nombre de paiements:</Text>
                                        <Text style={styles.summaryValue}>{tableHistory.length}</Text>
                                    </View>
                                    {tableTotal > 0 && (
                                        <View style={styles.summaryRow}>
                                            <Text style={styles.summaryLabel}>Reste à payer:</Text>
                                            <Text style={[styles.summaryValue, styles.remainingValue]}>{tableTotal.toFixed(2)} €</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Répartition par méthode de paiement */}
                            {hasHistory && (
                                <View style={styles.breakdownSection}>
                                    <Text style={styles.breakdownTitle}>Répartition par mode de paiement</Text>
                                    <View style={styles.breakdownList}>
                                        {Object.entries(paymentsByMethod).map(([method, amount]) => (
                                            <View key={`method-${method}`} style={styles.breakdownItem}>
                                                <View style={styles.breakdownItemIcon}>
                                                    <PaymentMethodIcon method={method as 'card' | 'cash' | 'check'} />
                                                </View>
                                                <Text style={styles.breakdownItemLabel}>
                                                    {method === 'card' ? 'Carte bancaire' :
                                                        method === 'cash' ? 'Espèces' :
                                                            method === 'check' ? 'Chèque' : 'Autre'}:
                                                </Text>
                                                <Text style={styles.breakdownItemValue}>{amount.toFixed(2)} €</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Répartition par type de paiement */}
                            {hasHistory && (
                                <View style={styles.breakdownSection}>
                                    <Text style={styles.breakdownTitle}>Répartition par type de paiement</Text>
                                    <View style={styles.breakdownList}>
                                        {Object.entries(paymentsByType).map(([type, amount]) => (
                                            <View key={`type-${type}`} style={styles.breakdownItem}>
                                                <View style={styles.breakdownItemIcon}>
                                                    <PaymentTypeIcon type={type as 'full' | 'split' | 'custom'} />
                                                </View>
                                                <Text style={styles.breakdownItemLabel}>
                                                    {type === 'full' ? 'Paiement complet' :
                                                        type === 'split' ? 'Partage équitable' :
                                                            type === 'custom' ? 'Partage personnalisé' : 'Autre'}:
                                                </Text>
                                                <Text style={styles.breakdownItemValue}>{amount.toFixed(2)} €</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Liste détaillée des paiements */}
                            <View style={styles.paymentListSection}>
                                <Text style={styles.paymentListTitle}>Détail des paiements</Text>

                                {refreshing && (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="small" color="#2196F3" />
                                        <Text style={styles.loadingText}>Actualisation...</Text>
                                    </View>
                                )}

                                {hasHistory ? (
                                    <View>
                                        {tableHistory.map((payment) => (
                                            <View key={payment.id} style={styles.paymentCard}>
                                                <View style={styles.paymentHeader}>
                                                    <View style={styles.paymentTitleContainer}>
                                                        <Text style={styles.paymentAmount}>{payment.amount.toFixed(2)} €</Text>
                                                        <Text style={styles.paymentDate}>{formatDate(payment.timestamp)}</Text>
                                                    </View>
                                                    <View style={[styles.statusBadge,
                                                    payment.paymentType === 'full' ? styles.fullPaymentBadge :
                                                        payment.paymentType === 'split' ? styles.splitPaymentBadge :
                                                            styles.customPaymentBadge]}>
                                                        <Text style={styles.statusText}>
                                                            {payment.paymentType === 'full' ? 'Complet' :
                                                                payment.paymentType === 'split' ? 'Partagé' :
                                                                    payment.paymentType === 'custom' ? 'Personnalisé' : 'Autre'}
                                                        </Text>
                                                    </View>
                                                </View>

                                                <View style={styles.paymentDetails}>
                                                    <View style={styles.detailItem}>
                                                        <Text style={styles.detailLabel}>Mode:</Text>
                                                        <View style={styles.detailValueContainer}>
                                                            <PaymentMethodIcon method={payment.paymentMethod} />
                                                            <Text style={styles.detailValue}>
                                                                {payment.paymentMethod === 'card' ? 'Carte bancaire' :
                                                                    payment.paymentMethod === 'cash' ? 'Espèces' :
                                                                        payment.paymentMethod === 'check' ? 'Chèque' : 'Non spécifié'}
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    <View style={styles.detailItem}>
                                                        <Text style={styles.detailLabel}>Type:</Text>
                                                        <View style={styles.detailValueContainer}>
                                                            <PaymentTypeIcon type={payment.paymentType} />
                                                            <Text style={styles.detailValue}>
                                                                {payment.paymentType === 'full' ? 'Paiement complet' :
                                                                    payment.paymentType === 'split' ? 'Partage équitable' :
                                                                        payment.paymentType === 'custom' ? 'Partage personnalisé' : 'Non spécifié'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <View style={styles.emptyHistory}>
                                        <Text style={styles.emptyHistoryText}>Aucun paiement effectué pour cette table</Text>
                                    </View>
                                )}

                                {/* Espace en bas pour éviter que le dernier élément soit caché */}
                                <View style={styles.bottomSpacer} />
                            </View>
                        </ScrollView>
                    </View>

                    {/* Boutons d'action fixés en bas */}
                    <View style={styles.actionButtons}>
                        <Pressable
                            style={[styles.actionButton, styles.refreshButton]}
                            onPress={onRefresh}
                            disabled={refreshing}
                        >
                            <Text style={styles.actionButtonText}>Actualiser</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.actionButton, styles.closeModalButton]}
                            onPress={onClose}
                        >
                            <Text style={styles.actionButtonText}>Fermer</Text>
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
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        width: '80%',
        maxHeight: '90%', // Augmenté pour prendre plus d'espace
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.27,
        shadowRadius: 4.65,
        elevation: 6,
        padding: 0,
        flexDirection: 'column', // Assure une disposition correcte
    },
    modalHeader: {
        flexDirection: 'column',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        alignItems: 'center',
        position: 'relative',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
    },
    tableName: {
        fontSize: 16,
        color: '#666',
        marginTop: 4,
    },
    closeButton: {
        position: 'absolute',
        right: 16,
        top: 16,
        padding: 5,
    },
    summarySectionOuter: {
        backgroundColor: '#f9f9f9',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    summarySection: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666',
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    remainingValue: {
        color: '#F44336',
    },
    breakdownSection: {
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    breakdownTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
        color: '#333',
    },
    breakdownList: {
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        padding: 10,
    },
    breakdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    breakdownItemIcon: {
        width: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    breakdownItemLabel: {
        flex: 1,
        fontSize: 14,
        color: '#555',
    },
    breakdownItemValue: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#2196F3',
    },
    paymentListTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginVertical: 15,
        paddingHorizontal: 20,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
    },
    loadingText: {
        marginLeft: 10,
        color: '#666',
    },
    modalScrollContent: {
        flex: 1,
    },
    paymentsListContainer: {
        paddingHorizontal: 20,
    },
    emptyHistory: {
        padding: 20,
        alignItems: 'center',
    },
    emptyHistoryText: {
        color: '#999',
        fontStyle: 'italic',
    },
    paymentCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
        borderLeftWidth: 4,
        borderLeftColor: '#2196F3',
    },
    paymentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    paymentTitleContainer: {
        flexDirection: 'column',
    },
    paymentAmount: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2196F3',
    },
    paymentDate: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        backgroundColor: '#E0E0E0',
    },
    fullPaymentBadge: {
        backgroundColor: '#E8F5E9',
        borderWidth: 1,
        borderColor: '#A5D6A7',
    },
    splitPaymentBadge: {
        backgroundColor: '#FFF3E0',
        borderWidth: 1,
        borderColor: '#FFCC80',
    },
    customPaymentBadge: {
        backgroundColor: '#EDE7F6',
        borderWidth: 1,
        borderColor: '#B39DDB',
    },
    statusText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#555',
    },
    paymentDetails: {
        backgroundColor: '#f9f9f9',
        padding: 10,
        borderRadius: 8,
    },
    detailItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    detailLabel: {
        fontSize: 14,
        color: '#666',
        width: 60,
    },
    detailValueContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    detailValue: {
        fontSize: 14,
        marginLeft: 5,
        fontWeight: '500',
    },
    actionButtons: {
        flexDirection: 'row',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        justifyContent: 'space-around',
        backgroundColor: 'white', // S'assure que les boutons ont un fond
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        zIndex: 1000, // Assure que les boutons restent au-dessus
    },
    actionButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 120,
    },
    refreshButton: {
        backgroundColor: '#E3F2FD',
        borderWidth: 1,
        borderColor: '#90CAF9',
    },
    closeModalButton: {
        backgroundColor: '#EEEEEE',
        borderWidth: 1,
        borderColor: '#BDBDBD',
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#424242',
    },
    // Style pour le conteneur principal du contenu
    contentContainer: {
        backgroundColor: '#f8f8f8',
        maxHeight: '80%',
    },

    // Style pour le conteneur de ScrollView
    scrollContentContainer: {
        paddingBottom: 20,
    },

    // Style pour la section de liste des paiements
    paymentListSection: {
        paddingHorizontal: 16,
    },

    // Style pour l'espace en bas de la liste
    bottomSpacer: {
        height: 30,
    },
});

export default PaymentHistoryModal;