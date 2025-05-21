// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text, ActivityIndicator } from 'react-native';
import {
  initializeTables,
  STORAGE_KEYS,
  StorageManager,
  TableManager,
} from '../utils/storage';
import { ToastProvider } from '../utils/ToastContext';
import { SettingsProvider } from '../utils/SettingsContext';
import { TableProvider } from '@/utils/TableContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

declare global {
  interface Window {
    frameworkReady?: () => void;
  }
}

export default function RootLayout() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Initialize app data
    const setupApp = async () => {
      try {
        // Vérifier si c'est le premier lancement
        const isFirstLaunch = await StorageManager.isFirstLaunch();

        // Initialiser les tables seulement si nécessaire
        await initializeTables();

        // Marquer l'application comme lancée si c'est le premier lancement
        if (isFirstLaunch) {
          await StorageManager.markAppLaunched();
        }
        // Vérifier quand a eu lieu le dernier nettoyage
        const lastCleanup = await AsyncStorage.getItem('last_cleanup_date');
        const now = new Date().toISOString();

        // Si aucun nettoyage n'a été fait ou si le dernier nettoyage date de plus de 7 jours
        if (
          !lastCleanup ||
          new Date(lastCleanup).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000
        ) {
          console.log('Exécution du nettoyage automatique...');
          // Effectuer un nettoyage léger
          StorageManager.memoryCache.clear();
          await AsyncStorage.removeItem(STORAGE_KEYS.CACHE);
          await AsyncStorage.setItem('last_cleanup_date', now);
        }

        setInitialized(true);
      } catch (error) {
        console.error('Error initializing app:', error);
        // Even on error, we should proceed to avoid app getting stuck
        setInitialized(true);
      }
    };
    setupApp();

    // Framework callback
    window.frameworkReady?.();
  }, []);

  // Show loading screen while initializing
  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={{ marginTop: 16, fontSize: 16 }}>
          Initialisation de l'application...
        </Text>
      </View>
    );
  }

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
