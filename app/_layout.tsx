import { useEffect, useState, useRef, useCallback } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  View,
  Text,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from 'react-native';
import {
  BillManager,
  getBills,
  getTables,
  initializeTables,
  performPeriodicCleanup,
  StorageManager,
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

// ✅ Constantes pour le nettoyage automatique
const CLEANUP_INTERVAL = 3 * 60 * 1000; // Nettoyage toutes les 3 minutes
const BACKGROUND_CLEANUP_DELAY = 30 * 1000; // Nettoyage après 30s en arrière-plan
const FOREGROUND_CLEANUP_DELAY = 5 * 1000; // Nettoyage après 5s au premier plan

export default function RootLayout() {
  const [initialized, setInitialized] = useState(false);
  const [appReady, setAppReady] = useState(false);

  // ✅ Refs pour gérer les timers et éviter les fuites
  const cleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backgroundCleanupRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const foregroundCleanupRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const lastCleanupRef = useRef(Date.now());

  // ✅ Fonction de nettoyage intelligente
  const performIntelligentCleanup = useCallback(async (force = false) => {
    if (!mountedRef.current) return;

    const now = Date.now();
    const timeSinceLastCleanup = now - lastCleanupRef.current;

    // Éviter les nettoyages trop fréquents (minimum 1 minute)
    if (!force && timeSinceLastCleanup < 60 * 1000) {
      console.log('🧹 Nettoyage ignoré (trop récent)');
      return;
    }

    try {
      console.log('🧹 Démarrage nettoyage intelligent...');

      // Nettoyage périodique du storage
      await performPeriodicCleanup();

      // Maintenance du storage
      await StorageManager.performMaintenance();

      // Statistiques pour surveillance
      const stats = await StorageManager.getStorageStats();
      console.log(
        `📊 Stats storage: ${stats.billsCount} bills, santé: ${stats.storageHealth}`
      );

      // Si l'état est critique, forcer un nettoyage supplémentaire
      if (stats.storageHealth === 'critical') {
        console.warn('⚠️ État critique détecté, nettoyage forcé');
        await BillManager.smartCleanup();
      }

      lastCleanupRef.current = now;
      console.log('✅ Nettoyage intelligent terminé');
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage intelligent:', error);
    }
  }, []);

  // ✅ Setup initial de l'app avec nettoyage
  useEffect(() => {
    const setupApp = async () => {
      try {
        console.log("🚀 Initialisation de l'app...");

        // Initialisation de base
        await initializeTables();

        // Nettoyage initial
        await performIntelligentCleanup(true);

        setInitialized(true);

        // Délai pour s'assurer que tout est prêt
        setTimeout(() => {
          if (mountedRef.current) {
            setAppReady(true);
            console.log('✅ App prête et optimisée');
          }
        }, 500);
      } catch (error) {
        console.error("❌ Erreur lors de l'initialisation:", error);
        setInitialized(true);
        setAppReady(true);
      }
    };

    setupApp();
  }, [performIntelligentCleanup]);

  // ✅ Nettoyage automatique périodique
  useEffect(() => {
    if (!appReady) return;

    console.log('⏰ Setup nettoyage automatique périodique');

    cleanupIntervalRef.current = setInterval(() => {
      performIntelligentCleanup();
    }, CLEANUP_INTERVAL);

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [appReady, performIntelligentCleanup]);

  // ✅ Gestion des changements d'état de l'app (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log(`📱 État de l'app: ${nextAppState}`);

      if (nextAppState === 'background') {
        // Nettoyage différé quand l'app passe en arrière-plan
        backgroundCleanupRef.current = setTimeout(() => {
          console.log('🧹 Nettoyage arrière-plan');
          performIntelligentCleanup();
        }, BACKGROUND_CLEANUP_DELAY);
      } else if (nextAppState === 'active') {
        // Annuler le nettoyage d'arrière-plan si l'app revient au premier plan
        if (backgroundCleanupRef.current) {
          clearTimeout(backgroundCleanupRef.current);
          backgroundCleanupRef.current = null;
        }

        // Nettoyage léger au retour au premier plan
        foregroundCleanupRef.current = setTimeout(() => {
          console.log('🧹 Nettoyage premier plan');
          performIntelligentCleanup();
        }, FOREGROUND_CLEANUP_DELAY);
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    return () => {
      subscription?.remove();

      if (backgroundCleanupRef.current) {
        clearTimeout(backgroundCleanupRef.current);
      }
      if (foregroundCleanupRef.current) {
        clearTimeout(foregroundCleanupRef.current);
      }
    };
  }, [performIntelligentCleanup]);

  // ✅ Nettoyage final à la destruction
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      console.log('🧹 Nettoyage final du layout');

      // Nettoyer tous les timers
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
      if (backgroundCleanupRef.current) {
        clearTimeout(backgroundCleanupRef.current);
      }
      if (foregroundCleanupRef.current) {
        clearTimeout(foregroundCleanupRef.current);
      }
    };
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
          {!initialized ? 'Initialisation...' : 'Optimisation...'}
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
