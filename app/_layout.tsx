// app/_layout.tsx - Make sure the root layout includes all screens

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text, ActivityIndicator } from 'react-native';
import { initializeTables } from '../utils/storage';

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
        // Initialize tables with default values if it's the first launch
        await initializeTables();
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
        <Text style={{ marginTop: 16, fontSize: 16 }}>Initializing app...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'white' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="table/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="payment/full" options={{ presentation: 'card' }} />
        <Stack.Screen name="payment/split" options={{ presentation: 'card' }} />
        <Stack.Screen name="payment/custom" options={{ presentation: 'card' }} />
        <Stack.Screen name="print-preview" options={{ presentation: 'card' }} />
      </Stack>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}