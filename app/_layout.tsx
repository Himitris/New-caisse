// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text, ActivityIndicator } from 'react-native';
import { initializeTables, StorageManager, TableManager } from '../utils/storage';
import { ToastProvider } from '../utils/ToastContext';

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

        // Nettoyer les données orphelines
        await TableManager.cleanupOrphanedTableData();

        // Marquer l'application comme lancée si c'est le premier lancement
        if (isFirstLaunch) {
          await StorageManager.markAppLaunched();
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
      <ToastProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'white' },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="table/[id]" options={{ presentation: 'card' }} />
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
    </GestureHandlerRootView>
  );
}
