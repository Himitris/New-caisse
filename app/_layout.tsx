// app/_layout.tsx - VERSION SIMPLIFIÉE

import { TableProvider } from '@/utils/TableContext';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { menuManager } from '../utils/MenuManager';
import { SettingsProvider } from '../utils/SettingsContext';
import { initializeTables, performBillsMaintenance } from '../utils/storage';
import { ToastProvider } from '../utils/ToastContext';

export default function RootLayout() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const setupApp = async () => {
      try {
        // Initialisation parallèle simple
        await Promise.all([initializeTables(), menuManager.ensureLoaded()]);

        // Maintenance légère
        await performBillsMaintenance();

        setInitialized(true);
      } catch (error) {
        console.error("Erreur lors de l'initialisation:", error);
        setInitialized(true);
      }
    };

    setupApp();
  }, []);

  // Nettoyage périodique simple
  useEffect(() => {
    if (!initialized) return;

    const cleanupInterval = setInterval(() => {
      performBillsMaintenance();
    }, 5 * 60 * 1000); // 5 minutes

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
          Initialisation...
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
                freezeOnBlur: true,
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="table/[id]"
                options={{
                  presentation: 'card',
                  freezeOnBlur: true,
                  gestureEnabled: true,
                }}
              />
              <Stack.Screen
                name="payment/full"
                options={{
                  presentation: 'card',
                  freezeOnBlur: true,
                  gestureEnabled: true,
                }}
              />
              <Stack.Screen
                name="payment/split"
                options={{
                  presentation: 'card',
                  freezeOnBlur: true,
                  gestureEnabled: true,
                }}
              />
              <Stack.Screen
                name="payment/custom"
                options={{
                  presentation: 'card',
                  freezeOnBlur: true,
                  gestureEnabled: true,
                }}
              />
              <Stack.Screen
                name="payment/items"
                options={{
                  presentation: 'card',
                  freezeOnBlur: true,
                  gestureEnabled: true,
                }}
              />
              <Stack.Screen
                name="print-preview"
                options={{
                  presentation: 'card',
                  freezeOnBlur: true,
                  gestureEnabled: true,
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
