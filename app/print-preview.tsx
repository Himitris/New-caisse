// app/print-preview.tsx - Mis à jour pour enlever la TVA

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Printer, Share, Home } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

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

  const restaurantInfo = {
    name: 'Manjo Carn',
    address: 'Route de la Corniche, 82140 Saint Antonin Noble Val',
    siret: 'Siret N° 803 520 998 00011',
    phone: 'Tel : 0563682585',
    taxInfo: 'TVA non applicable - art.293B du CGI', // Toujours cette valeur maintenant
    owner: 'Virginie',
  };

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

  const generateHTML = () => {
    let totalPrice = 0;
    interface OrderItem {
      name: string;
      quantity: number;
      price: number;
    }

    const itemsHTML: string = order.items
      .map((item: OrderItem) => {
        const itemTotal: number = item.quantity * item.price;
        totalPrice += itemTotal;
        return `
      <tr>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>${item.price.toFixed(2)} €</td>
        <td>${itemTotal.toFixed(2)} €</td>
      </tr>
      `;
      })
      .join('');

    // Information sur la TVA (maintenant toujours la même)
    const taxInfo = 'TVA non applicable - art.293B du CGI';

    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header, .footer { text-align: center; margin-bottom: 20px; }
            .info { margin-bottom: 20px; text-align: center; }
            .items { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .items th, .items td { padding: 8px; text-align: center; border-bottom: 1px solid #ddd; }
            .totals { text-align: right; font-weight: bold; }
            .payment-info { text-align: center; margin-top: 20px; padding: 10px; border: 1px dashed #ccc; }
            .partial { color: #f44336; font-weight: bold; }
            .preview-notice { 
              background-color: #9C27B0; 
              color: white; 
              text-align: center; 
              padding: 10px; 
              font-weight: bold; 
              font-size: 18px; 
              margin-bottom: 15px; 
              border-radius: 5px;
            }
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
            <p><strong>${order.tableName}</strong></p>
            <p>Date: ${order.timestamp}</p>
            ${
              isPreviewMode
                ? '<p class="partial">NOTE NON PAYÉE</p>'
                : order.isPartial
                ? `<p class="partial">PAIEMENT PARTIEL</p>`
                : ''
            }
          </div>
  
          <table class="items">
            <tr>
              <th>Description</th>
              <th>Quantité</th>
              <th>Prix</th>
              <th>Total</th>
            </tr>
            ${itemsHTML}
          </table>
  
          <div class="totals">
            <h2>Total: ${order.total.toFixed(2)} €</h2>
            ${
              order.isPartial && !isPreviewMode
                ? `<p class="partial">Solde restant: ${order.remaining.toFixed(
                    2
                  )} €</p>`
                : ''
            }
          </div>
  
          <div class="payment-info">
            ${
              isPreviewMode
                ? `<p style="color: #9C27B0; font-weight: bold; font-size: 16px;">PRÉVISUALISATION - NOTE NON PAYÉE</p>`
                : `<p>Méthode de paiement: ${
                    order.paymentMethod === 'card'
                      ? 'Carte bancaire'
                      : order.paymentMethod === 'cash'
                      ? 'Espèces'
                      : 'Chèque'
                  }</p>
              <p>Montant payé: ${order.total.toFixed(2)} €</p>
              <p>Statut: ${
                order.isPartial ? 'Paiement partiel' : 'Payé en totalité'
              }</p>`
            }
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
              item: { name: string; quantity: number; price: number },
              index: number
            ) => (
              <View key={index} style={styles.item}>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                </View>
                <Text style={styles.itemTotal}>
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
});
