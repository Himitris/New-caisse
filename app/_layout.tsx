// app/_layout.tsx - VERSION OPTIMISÉE POUR LA VITESSE

import { TableProvider } from '@/utils/TableContext';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { menuManager } from '../utils/MenuManager';
import { SettingsProvider } from '../utils/SettingsContext';
import {
  initializeTables,
  performBillsMaintenance,
  initializeDatabase,
} from '../utils/storage';
import { ToastProvider } from '../utils/ToastContext';

export default function RootLayout() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const setupApp = async () => {
      try {
        // ✅ Initialisation parallèle TOTALE pour max vitesse
        await Promise.all([
          initializeDatabase(),
          initializeTables(),
          menuManager.ensureLoaded(),
        ]);

        setInitialized(true);

        // Maintenance en arrière-plan (après affichage)
        setTimeout(() => {
          performBillsMaintenance().catch(console.error);
        }, 2000);
      } catch (error) {
        console.error("Erreur lors de l'initialisation:", error);
        setInitialized(true);
      }
    };

    setupApp();
  }, []);

  // Nettoyage périodique - moins fréquent
  useEffect(() => {
    if (!initialized) return;

    const cleanupInterval = setInterval(() => {
      performBillsMaintenance().catch(console.error);
    }, 10 * 60 * 1000); // 10 minutes au lieu de 5

    return () => clearInterval(cleanupInterval);
  }, [initialized]);

  if (!initialized) {
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
          Chargement...
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
                // ✅ Animation ultra-rapide
                animation: 'fade',
                animationDuration: 150,
                presentation: 'card',
                gestureEnabled: true,
                gestureDirection: 'horizontal',
                freezeOnBlur: true,
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="table/[id]"
                options={{
                  presentation: 'card',
                  animation: 'slide_from_right',
                  animationDuration: 200,
                  freezeOnBlur: true,
                  gestureEnabled: true,
                }}
              />
              <Stack.Screen
                name="payment/full"
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  animationDuration: 200,
                  freezeOnBlur: true,
                }}
              />
              <Stack.Screen
                name="payment/split"
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  animationDuration: 200,
                  freezeOnBlur: true,
                }}
              />
              <Stack.Screen
                name="payment/custom"
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  animationDuration: 200,
                  freezeOnBlur: true,
                }}
              />
              <Stack.Screen
                name="payment/items"
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  animationDuration: 200,
                  freezeOnBlur: true,
                }}
              />
              <Stack.Screen
                name="print-preview"
                options={{
                  presentation: 'modal',
                  animation: 'fade',
                  animationDuration: 150,
                  freezeOnBlur: true,
                }}
              />
            </Stack>
            <StatusBar style="auto" />
          </ToastProvider>
        </TableProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}
