// app/_layout.tsx - Version simplifiée

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text, ActivityIndicator } from 'react-native';
import { getBills, getTables, initializeTables, performPeriodicCleanup } from '../utils/storage';
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
    const setupApp = async () => {
      try {
        await initializeTables();

        // 🆕 Nettoyage au démarrage
        await performPeriodicCleanup();

        setInitialized(true);
      } catch (error) {
        console.error('Error initializing app:', error);
        setInitialized(true);
      }
    };

    setupApp();
  }, []);

  // 🆕 Nettoyage toutes les heures
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const lastCleanup = await AsyncStorage.getItem('last_cleanup_date');
        if (!lastCleanup) return;

        const lastCleanupDate = new Date(lastCleanup);
        const now = new Date();

        // Nettoyer toutes les heures
        if (now.getTime() - lastCleanupDate.getTime() > 60 * 60 * 1000) {
          await performPeriodicCleanup();
        }
      } catch (error) {
        console.error('Erreur nettoyage périodique:', error);
      }
    }, 60 * 60 * 1000); // Chaque heure

    return () => clearInterval(interval);
  }, []);

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text>Initialisation...</Text>
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
