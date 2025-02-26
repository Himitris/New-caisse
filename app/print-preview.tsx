import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Printer, Download, Share } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function PrintPreviewScreen() {
  const router = useRouter();
  const restaurantInfo = {
    name: 'Sample Restaurant',
    address: '123 Main Street',
    phone: '(555) 123-4567',
    email: 'info@samplerestaurant.com',
  };

  const order = {
    tableNumber: 5,
    guests: 4,
    items: [
      { name: 'Margherita Pizza', quantity: 2, price: 12.99 },
      { name: 'Caesar Salad', quantity: 1, price: 8.99 },
      { name: 'Spaghetti Carbonara', quantity: 1, price: 13.99 },
    ],
    subtotal: 48.96,
    tax: 4.90,
    total: 53.86,
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
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${restaurantInfo.name}</h1>
            <p>${restaurantInfo.address}</p>
            <p>${restaurantInfo.phone}</p>
          </div>
          
          <div class="info">
            <p>Table: ${order.tableNumber}</p>
            <p>Guests: ${order.guests}</p>
            <p>Date: ${order.timestamp}</p>
          </div>

          <table class="items">
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
            ${order.items.map(item => `
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
      await Print.printAsync({
        html: generateHTML(),
      });
    } catch (error) {
      console.error('Failed to print:', error);
    }
  };

  const handleShare = async () => {
    try {
      const { uri } = await Print.printToFileAsync({
        html: generateHTML(),
      });
      await Sharing.shareAsync(uri);
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Receipt Preview</Text>
      </View>

      <ScrollView style={styles.preview}>
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName}>{restaurantInfo.name}</Text>
          <Text style={styles.restaurantDetails}>{restaurantInfo.address}</Text>
          <Text style={styles.restaurantDetails}>{restaurantInfo.phone}</Text>
        </View>

        <View style={styles.orderInfo}>
          <Text style={styles.infoText}>Table: {order.tableNumber}</Text>
          <Text style={styles.infoText}>Guests: {order.guests}</Text>
          <Text style={styles.infoText}>Date: {order.timestamp}</Text>
        </View>

        <View style={styles.itemsSection}>
          {order.items.map((item, index) => (
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
        </View>

        <Text style={styles.thankYou}>Thank you for dining with us!</Text>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
          onPress={handlePrint}>
          <Printer size={24} color="white" />
          <Text style={styles.actionText}>Print</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
          onPress={handleShare}>
          <Share size={24} color="white" />
          <Text style={styles.actionText}>Share</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
          onPress={() => router.back()}>
          <Download size={24} color="white" />
          <Text style={styles.actionText}>Save</Text>
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
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