// app/print-preview.tsx - Mis à jour pour enlever la TVA

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Printer, Share, Home, Gift } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useSettings } from '@/utils/useSettings';

export default function PrintPreviewScreen() {
  const {
    tableId,
    total,
    items,
    paymentMethod,
    isPartial,
    remaining,
    tableName,
    isPreview,
  } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // Suppression des états liés à la TVA
  const tableIdNum = parseInt(tableId as string, 10);
  const totalAmount = parseFloat(total as string);
  // Suppression du calcul des valeurs liées à la TVA
  const orderItems = items ? JSON.parse(items as string) : [];
  const isPartialPayment = isPartial === 'true';
  const remainingAmount = remaining ? parseFloat(remaining as string) : 0;
  const displayName = tableName || `Table ${tableIdNum}`;
  const isPreviewMode = isPreview === 'true';

  const { restaurantInfo } = useSettings();

  // Suppression du chargement des paramètres de TVA

  const order = {
    tableNumber: tableIdNum,
    tableName: displayName,
    guests: 4,
    items: orderItems,
    // Suppression des valeurs liées à la TVA
    total: totalAmount,
    remaining: remainingAmount,
    isPartial: isPartialPayment,
    paymentMethod: paymentMethod || 'Carte',
    timestamp: new Date().toLocaleString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Europe/Paris',
    }),
  };

  // Fonction modifiée generateHTML pour un format d'impression 80mm
  const generateHTML = () => {
    let totalPrice = 0;
    let offeredTotal = 0;

    interface OrderItem {
      name: string;
      quantity: number;
      price: number;
      offered?: boolean;
    }

    const itemsHTML: string = order.items
      .map((item: OrderItem) => {
        const itemTotal: number = item.quantity * item.price;

        if (!item.offered) {
          totalPrice += itemTotal;
        } else {
          offeredTotal += itemTotal;
        }

        // Format simplifié en colonnes pour papier 80mm
        return `
    <tr class="${item.offered ? 'offered-item' : ''}">
      <td>${item.quantity}x</td>
      <td>${item.name}${item.offered ? ' (Offert)' : ''}</td>
      <td>${itemTotal.toFixed(2)}€</td>
    </tr>
    `;
      })
      .join('');

    // Information sur la TVA (maintenant toujours la même)
    const taxInfo = 'TVA non applicable - art.293B du CGI';

    return `
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
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          text-align: left;
          padding: 1mm 0;
          font-size: 9pt;
        }
        th:last-child, td:last-child {
          text-align: right;
        }
        td:first-child {
          width: 15%;
        }
        td:nth-child(2) {
          width: 60%;
        }
        td:last-child {
          width: 25%;
        }
        .totals {
          margin: 2mm 0;
          text-align: right;
        }
        .total-line {
          display: flex;
          justify-content: space-between;
          margin: 1mm 0;
        }
        .total-final {
          font-weight: bold;
          font-size: 12pt;
          margin: 2mm 0;
        }
        .payment-info {
          text-align: center;
          margin: 3mm 0;
        }
        .offered-item { font-style: italic; }
        .preview-notice {
          text-align: center;
          font-weight: bold;
          border: 1px solid #000;
          padding: 2mm;
          margin: 2mm 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${restaurantInfo.name}</h1>
        <p>${restaurantInfo.address}</p>
        <p>${restaurantInfo.phone}</p>
      </div>

      <div class="divider"></div>
      
      <p><strong>${order.tableName}</strong> - ${
      order.timestamp.split(',')[0]
    }</p>
      <p>${order.timestamp.split(',')[1]}</p>
      
      ${
        isPreviewMode
          ? '<div class="preview-notice">PRÉVISUALISATION</div>'
          : order.isPartial
          ? '<div class="preview-notice">PAIEMENT PARTIEL</div>'
          : ''
      }

      <div class="divider"></div>

      <table>
        <tr>
          <th>Qté</th>
          <th>Article</th>
          <th>Total</th>
        </tr>
        ${itemsHTML}
      </table>

      <div class="divider"></div>

      <div class="totals">
        ${
          offeredTotal > 0
            ? `<div class="total-line">
                 <span>Offerts:</span>
                 <span>${offeredTotal.toFixed(2)}€</span>
               </div>`
            : ''
        }
        <div class="total-line total-final">
          <span>TOTAL:</span>
          <span>${order.total.toFixed(2)}€</span>
        </div>
        ${
          order.isPartial && !isPreviewMode
            ? `<div class="total-line">
                 <span>Reste à payer:</span>
                 <span>${order.remaining.toFixed(2)}€</span>
               </div>`
            : ''
        }
      </div>

      <div class="divider"></div>

      <div class="payment-info">
        ${
          isPreviewMode
            ? `<p><strong>NOTE NON PAYÉE</strong></p>`
            : `<p>Paiement: ${
                order.paymentMethod === 'card'
                  ? 'Carte bancaire'
                  : order.paymentMethod === 'cash'
                  ? 'Espèces'
                  : 'Chèque'
              }</p>
              ${
                order.isPartial
                  ? `<p>Payé: ${(order.total - order.remaining).toFixed(
                      2
                    )}€</p>`
                  : ''
              }`
        }
      </div>

      <div class="footer">
        <p>${taxInfo}</p>
        <p>Merci de votre visite!</p>
        <p>À bientôt, ${restaurantInfo.owner}</p>
      </div>
    </body>
  </html>
`;
  };

  const handlePrint = async () => {
    try {
      setLoading(true);
      await Print.printAsync({
        html: generateHTML(),
      });
      setLoading(false);
    } catch (error) {
      console.error("Échec de l'impression:", error);
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      setLoading(true);
      const { uri } = await Print.printToFileAsync({
        html: generateHTML(),
      });
      await Sharing.shareAsync(uri);
      setLoading(false);
    } catch (error) {
      console.error('Échec du partage:', error);
      setLoading(false);
    }
  };

  const handleDone = () => {
    if (isPreviewMode) {
      // En mode prévisualisation, retourner simplement à la table
      router.push(`/table/${tableId}`);
    } else if (isPartialPayment) {
      router.push(`/table/${tableId}`);
    } else {
      router.push('/');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {isPreviewMode ? 'Prévisualisation - ' : 'Reçu - '}
          {displayName}
        </Text>
        {isPartialPayment && !isPreviewMode && (
          <Text style={styles.partialBadge}>Paiement partiel</Text>
        )}
        {isPreviewMode && (
          <Text style={styles.previewBadge}>PRÉVISUALISATION</Text>
        )}
      </View>

      <ScrollView style={styles.preview}>
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName}>{restaurantInfo.name}</Text>
          <Text style={styles.restaurantDetails}>{restaurantInfo.address}</Text>
          <Text style={styles.restaurantDetails}>{restaurantInfo.phone}</Text>
        </View>

        <View style={styles.orderInfo}>
          <Text style={styles.infoText}>{displayName}</Text>
          <Text style={styles.infoText}>Date: {order.timestamp}</Text>
        </View>

        <View style={styles.itemsSection}>
          {order.items.map(
            (
              item: {
                name: string;
                quantity: number;
                price: number;
                offered?: boolean;
              },
              index: number
            ) => (
              <View
                key={index}
                style={[styles.item, item.offered && styles.offeredItem]}
              >
                <View style={styles.itemDetails}>
                  <View style={styles.itemNameRow}>
                    {item.offered && (
                      <Gift size={14} color="#FF9800" style={styles.giftIcon} />
                    )}
                    <Text
                      style={[
                        styles.itemName,
                        item.offered && styles.offeredItemText,
                      ]}
                    >
                      {item.name} {item.offered ? '(Offert)' : ''}
                    </Text>
                  </View>
                  <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                </View>
                <Text
                  style={[
                    styles.itemTotal,
                    item.offered && styles.offeredItemPrice,
                  ]}
                >
                  {(item.quantity * item.price).toFixed(2)} €
                </Text>
              </View>
            )
          )}
        </View>

        <View style={styles.totals}>
          <View style={[styles.totalRow, styles.finalTotal]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{order.total.toFixed(2)} €</Text>
          </View>

          {isPartialPayment && !isPreviewMode && (
            <View style={[styles.totalRow, styles.remainingRow]}>
              <Text style={styles.remainingLabel}>Solde restant</Text>
              <Text style={styles.remainingValue}>
                {order.remaining.toFixed(2)} €
              </Text>
            </View>
          )}
        </View>

        <View style={styles.paymentInfo}>
          {isPreviewMode ? (
            <Text style={[styles.paymentStatus, styles.previewText]}>
              Statut: PRÉVISUALISATION - NON PAYÉ
            </Text>
          ) : (
            <>
              <Text style={styles.paymentMethod}>
                Méthode de paiement:{' '}
                {order.paymentMethod === 'card'
                  ? 'Carte bancaire'
                  : order.paymentMethod === 'cash'
                  ? 'Espèces'
                  : 'Chèque'}
              </Text>
              <Text style={styles.paymentStatus}>
                Statut:{' '}
                {isPartialPayment ? 'Paiement partiel' : 'Payé en totalité'}
              </Text>
            </>
          )}
        </View>

        <Text style={styles.thankYou}>Merci d'avoir mangé avec nous !</Text>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
          onPress={handlePrint}
          disabled={loading}
        >
          <Printer size={24} color="white" />
          <Text style={styles.actionText}>Imprimer</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
          onPress={handleShare}
          disabled={loading}
        >
          <Share size={24} color="white" />
          <Text style={styles.actionText}>Partager</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
          onPress={handleDone}
        >
          <Home size={24} color="white" />
          <Text style={styles.actionText}>
            {isPreviewMode ? 'Retour à la Table' : 'Terminé'}
          </Text>
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
    padding: 20,
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
  partialBadge: {
    backgroundColor: '#FFF3CD',
    color: '#856404',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    fontWeight: '600',
    fontSize: 14,
  },
  preview: {
    flex: 1,
    padding: 20,
  },
  restaurantInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  restaurantName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  restaurantDetails: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  orderInfo: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 16,
    marginBottom: 4,
  },
  itemsSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: '600',
  },
  totals: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: '#666',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  finalTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 8,
    paddingTop: 8,
  },
  remainingRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f44336',
    borderStyle: 'dashed',
  },
  remainingLabel: {
    fontSize: 16,
    color: '#f44336',
    fontWeight: '600',
  },
  remainingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f44336',
  },
  paymentInfo: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  paymentMethod: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  paymentStatus: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  previewText: {
    color: '#9C27B0',
    fontWeight: 'bold',
    fontSize: 18,
  },
  thankYou: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  previewBadge: {
    backgroundColor: '#9C27B0',
    color: 'white',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 10,
  },
  offeredItem: {
    backgroundColor: '#FFF8E1',
    borderLeftWidth: 2,
    borderLeftColor: '#FF9800',
  },
  offeredItemText: {
    fontStyle: 'italic',
    color: '#FF9800',
  },
  offeredItemPrice: {
    textDecorationLine: 'line-through',
    color: '#FF9800',
  },
  giftIcon: {
    marginRight: 4,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offeredTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FFD54F',
    borderStyle: 'dashed',
  },
  offeredTotalLabel: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '500',
  },
  offeredTotalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9800',
  },
});
