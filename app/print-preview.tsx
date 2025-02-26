// app/print-preview.tsx - Updated to display table name

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Printer, Download, Share, Home } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function PrintPreviewScreen() {
  const { tableId, total, items, paymentMethod, isPartial, remaining, tableName } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const tableIdNum = parseInt(tableId as string, 10);
  const totalAmount = parseFloat(total as string);
  const orderItems = items ? JSON.parse(items as string) : [];
  const isPartialPayment = isPartial === 'true';
  const remainingAmount = remaining ? parseFloat(remaining as string) : 0;
  const displayName = tableName || `Table ${tableIdNum}`;
  
  const restaurantInfo = {
    name: 'Sample Restaurant',
    address: '123 Main Street',
    phone: '(555) 123-4567',
    email: 'info@samplerestaurant.com',
  };

  const order = {
    tableNumber: tableIdNum,
    tableName: displayName,
    guests: 4,
    items: orderItems,
    subtotal: totalAmount * 0.9, // Assuming 10% tax for demo
    tax: totalAmount * 0.1,
    total: totalAmount,
    remaining: remainingAmount,
    isPartial: isPartialPayment,
    paymentMethod: paymentMethod || 'card',
    timestamp: new Date().toLocaleString(),
  };

  const generateHTML = () => {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .info { margin-bottom: 20px; }
            .items { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .items th, .items td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            .totals { text-align: right; }
            .payment-info { margin-top: 20px; padding: 10px; border: 1px dashed #ccc; text-align: center; }
            .partial { color: #f44336; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${restaurantInfo.name}</h1>
            <p>${restaurantInfo.address}</p>
            <p>${restaurantInfo.phone}</p>
          </div>
          
          <div class="info">
            <p>${order.tableName}</p>
            <p>Date: ${order.timestamp}</p>
            ${order.isPartial ? `<p class="partial">PARTIAL PAYMENT</p>` : ''}
          </div>

          <table class="items">
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
            ${order.items.map((item: { name: string; quantity: number; price: number }) => `
              <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>$${item.price.toFixed(2)}</td>
                <td>$${(item.quantity * item.price).toFixed(2)}</td>
              </tr>
            `).join('')}
          </table>

          <div class="totals">
            <p>Subtotal: $${order.subtotal.toFixed(2)}</p>
            <p>Tax: $${order.tax.toFixed(2)}</p>
            <h2>Total: $${order.total.toFixed(2)}</h2>
            ${order.isPartial ? `<p class="partial">Remaining Balance: $${order.remaining.toFixed(2)}</p>` : ''}
          </div>

          <div class="payment-info">
            <p>Payment Method: ${order.paymentMethod === 'card' ? 'Credit Card' : 'Cash'}</p>
            <p>Payment Amount: $${order.total.toFixed(2)}</p>
            <p>Status: ${order.isPartial ? 'Partial Payment' : 'Paid in Full'}</p>
          </div>

          <div class="header">
            <p>Thank you for dining with us!</p>
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
      console.error('Failed to print:', error);
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
      console.error('Failed to share:', error);
      setLoading(false);
    }
  };

  const handleDone = () => {
    if (isPartialPayment) {
      router.push(`/table/${tableId}`);
    } else {
      router.push('/');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Receipt - {displayName}</Text>
        {isPartialPayment && (
          <Text style={styles.partialBadge}>Partial Payment</Text>
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
          {order.items.map((item: { name: string; quantity: number; price: number }, index: number) => (
            <View key={index} style={styles.item}>
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQuantity}>x{item.quantity}</Text>
              </View>
              <Text style={styles.itemTotal}>
                ${(item.quantity * item.price).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>${order.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax</Text>
            <Text style={styles.totalValue}>${order.tax.toFixed(2)}</Text>
          </View>
          <View style={[styles.totalRow, styles.finalTotal]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${order.total.toFixed(2)}</Text>
          </View>
          
          {isPartialPayment && (
            <View style={[styles.totalRow, styles.remainingRow]}>
              <Text style={styles.remainingLabel}>Remaining Balance</Text>
              <Text style={styles.remainingValue}>${order.remaining.toFixed(2)}</Text>
            </View>
          )}
        </View>

        <View style={styles.paymentInfo}>
          <Text style={styles.paymentMethod}>
            Payment Method: {order.paymentMethod === 'card' ? 'Credit Card' : 'Cash'}
          </Text>
          <Text style={styles.paymentStatus}>
            Status: {isPartialPayment ? 'Partial Payment' : 'Paid in Full'}
          </Text>
        </View>

        <Text style={styles.thankYou}>Thank you for dining with us!</Text>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
          onPress={handlePrint}
          disabled={loading}>
          <Printer size={24} color="white" />
          <Text style={styles.actionText}>Print</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
          onPress={handleShare}
          disabled={loading}>
          <Share size={24} color="white" />
          <Text style={styles.actionText}>Share</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
          onPress={handleDone}>
          <Home size={24} color="white" />
          <Text style={styles.actionText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  // Existing styles from improved-print-preview
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
});