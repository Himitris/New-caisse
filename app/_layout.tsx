// app/_layout.tsx - INTÉGRATION SIMPLIFIÉE

import { TableProvider } from '@/utils/TableContext';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { menuManager } from '../utils/MenuManager';
import { SettingsProvider } from '../utils/SettingsContext';
import {
  initializeTables,
  performPeriodicCleanup
} from '../utils/storage';
import { ToastProvider } from '../utils/ToastContext';

// ✅ Constantes simplifiées
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes au lieu de 3
const BACKGROUND_CLEANUP_DELAY = 60 * 1000; // 1 minute au lieu de 30s

export default function RootLayout() {
  const [initialized, setInitialized] = useState(false);
  const [appReady, setAppReady] = useState(false);

  // ✅ Setup simplifié de l'app
  useEffect(() => {
    const setupApp = async () => {
      try {
        console.log("🚀 Initialisation de l'app...");

        // ✅ Initialisation parallèle pour plus de rapidité
        await Promise.all([
          initializeTables(),
          menuManager.ensureLoaded(), // ✅ Chargement du menu via le manager
        ]);

        // Nettoyage léger initial
        await performPeriodicCleanup();

        setInitialized(true);

        // Délai réduit pour la réactivité
        setTimeout(() => {
          setAppReady(true);
          console.log('✅ App prête et optimisée');
        }, 200); // Réduit de 500ms à 200ms
      } catch (error) {
        console.error("❌ Erreur lors de l'initialisation:", error);
        setInitialized(true);
        setAppReady(true);
      }
    };

    setupApp();
  }, []);

  // ✅ Nettoyage automatique simplifié
  useEffect(() => {
    if (!appReady) return;

    console.log('⏰ Setup nettoyage automatique');

    const cleanupInterval = setInterval(() => {
      performPeriodicCleanup();
    }, CLEANUP_INTERVAL);

    return () => {
      clearInterval(cleanupInterval);
    };
  }, [appReady]);

  // ✅ Gestion simplifiée des changements d'état de l'app
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log(`📱 État de l'app: ${nextAppState}`);

      if (nextAppState === 'background') {
        // Nettoyage différé en arrière-plan
        setTimeout(() => {
          console.log('🧹 Nettoyage arrière-plan');
          performPeriodicCleanup();
        }, BACKGROUND_CLEANUP_DELAY);
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );
    return () => subscription?.remove();
  }, []);

  if (!initialized || !appReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f5f5f5',
        }}
      >
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
          {!initialized ? 'Initialisation...' : 'Préparation...'}
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
