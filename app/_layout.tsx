// app/_layout.tsx - VERSION ULTRA-SIMPLE
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { menuManager } from '../utils/MenuManager';
import { View, Text, ActivityIndicator } from 'react-native';
import { initializeTables } from '../utils/storage';
import { ToastProvider } from '../utils/ToastContext';
import { SettingsProvider } from '../utils/SettingsContext';
import { TableProvider } from '@/utils/TableContext';

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);

  // ✅ Setup ultra-simple
  useEffect(() => {
    const setupApp = async () => {
      try {
        console.log("🚀 Initialisation de l'app...");

        // ✅ Initialisation simple et parallèle
        await Promise.all([initializeTables(), menuManager.ensureLoaded()]);

        console.log('✅ App initialisée');
        setAppReady(true);
      } catch (error) {
        console.error("❌ Erreur lors de l'initialisation:", error);
        // ✅ Même en cas d'erreur, on démarre l'app
        setAppReady(true);
      }
    };

    setupApp();
  }, []);

  // ✅ Écran de chargement simple
  if (!appReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Initialisation...</Text>
      </View>
    );
  }

  // ✅ App structure simple
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <TableProvider>
          <ToastProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'white' },
                animation: 'fade_from_bottom',
                presentation: 'card',
                gestureEnabled: true,
                gestureDirection: 'horizontal',
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="table/[id]"
                options={{ presentation: 'card' }}
              />
              <Stack.Screen
                name="payment/full"
                options={{ presentation: 'card' }}
              />
              <Stack.Screen
                name="payment/split"
                options={{ presentation: 'card' }}
              />
              <Stack.Screen
                name="payment/custom"
                options={{ presentation: 'card' }}
              />
              <Stack.Screen
                name="payment/items"
                options={{ presentation: 'card' }}
              />
              <Stack.Screen
                name="print-preview"
                options={{ presentation: 'card' }}
              />
            </Stack>
            <StatusBar style="auto" />
          </ToastProvider>
        </TableProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}

// ✅ Styles simples
const styles = {
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
};
