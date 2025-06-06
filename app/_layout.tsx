// app/_layout.tsx - VERSION ULTRA-SIMPLE
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text, ActivityIndicator } from 'react-native';
import { initializeTables } from '../utils/storage';
import { menuManager } from '../utils/MenuManager';
import { ToastProvider } from '../utils/ToastContext';
import { SettingsProvider } from '../utils/SettingsContext';
import { TableProvider } from '@/utils/TableContext';

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);

  // Initialisation ultra-simple
  useEffect(() => {
    const initApp = async () => {
      try {
        console.log("🚀 Initialisation de l'app...");

        // Initialisation en parallèle et simple
        await Promise.all([initializeTables(), menuManager.load()]);

        console.log('✅ App prête');
        setAppReady(true);
      } catch (error) {
        console.error("❌ Erreur d'initialisation:", error);
        // Même en cas d'erreur, on démarre l'app
        setAppReady(true);
      }
    };

    initApp();
  }, []);

  // Écran de chargement simple
  if (!appReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Manjo Carn</Text>
        <Text style={styles.loadingSubtext}>Initialisation...</Text>
      </View>
    );
  }

  // Structure app simple
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <TableProvider>
          <ToastProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'white' },
                animation: 'fade',
                presentation: 'card',
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="table/[id]" />
              <Stack.Screen name="payment/full" />
              <Stack.Screen name="payment/split" />
              <Stack.Screen name="payment/custom" />
              <Stack.Screen name="payment/items" />
              <Stack.Screen name="print-preview" />
            </Stack>
            <StatusBar style="auto" />
          </ToastProvider>
        </TableProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}

// Styles simples
const styles = {
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: '#333',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 16,
    color: '#666',
  },
};
