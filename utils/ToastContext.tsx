import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
  opacity: Animated.Value;
  isRemoving: boolean;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// ✅ Limites strictes pour éviter l'accumulation
const MAX_TOASTS = 3; // Maximum 3 toasts simultanés
const TOAST_DURATION = 2500; // RÉDUIT de 3000ms à 2500ms
const CLEANUP_INTERVAL = 5000; // Nettoyage forcé toutes les 5 secondes

export const ToastProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timeoutRefs = useRef<{ [id: number]: NodeJS.Timeout | number }>({});
  const animationRefs = useRef<{ [id: number]: Animated.CompositeAnimation }>(
    {}
  );
  const mountedRef = useRef(true);
  const cleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ✅ Nettoyage automatique agressif
  const forceCleanup = useCallback(() => {
    if (!mountedRef.current) return;

    // Nettoyer tous les timeouts orphelins
    Object.entries(timeoutRefs.current).forEach(([id, timeout]) => {
      const idNum = parseInt(id, 10);
      const toastExists = toasts.some((t) => t.id === idNum);

      if (!toastExists) {
        clearTimeout(timeout);
        delete timeoutRefs.current[idNum];
      }
    });

    // Nettoyer toutes les animations orphelines
    Object.entries(animationRefs.current).forEach(([id, animation]) => {
      const idNum = parseInt(id, 10);
      const toastExists = toasts.some((t) => t.id === idNum);

      if (!toastExists) {
        animation.stop();
        delete animationRefs.current[idNum];
      }
    });

    // Si trop de toasts, supprimer les plus anciens
    if (toasts.length > MAX_TOASTS) {
      const oldestToasts = toasts.slice(0, toasts.length - MAX_TOASTS);
      oldestToasts.forEach((toast) => {
        if (!toast.isRemoving) {
          removeToast(toast.id);
        }
      });
    }

    console.log(
      `🧹 Toast cleanup: ${Object.keys(timeoutRefs.current).length} timeouts, ${
        Object.keys(animationRefs.current).length
      } animations`
    );
  }, [toasts]);

  // ✅ Setup du nettoyage automatique
  useEffect(() => {
    cleanupIntervalRef.current = setInterval(forceCleanup, CLEANUP_INTERVAL);

    return () => {
      mountedRef.current = false;

      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }

      // Nettoyer TOUT à la destruction
      Object.values(timeoutRefs.current).forEach(clearTimeout);
      Object.values(animationRefs.current).forEach((animation) =>
        animation.stop()
      );

      timeoutRefs.current = {};
      animationRefs.current = {};
    };
  }, [forceCleanup]);

  const removeToast = useCallback((id: number) => {
    if (!mountedRef.current) return;

    setToasts((prevToasts) => {
      const toastIndex = prevToasts.findIndex((t) => t.id === id);
      if (toastIndex === -1) return prevToasts;

      const toast = prevToasts[toastIndex];
      if (toast.isRemoving) return prevToasts;

      const updatedToasts = [...prevToasts];
      updatedToasts[toastIndex] = { ...toast, isRemoving: true };

      // Animation de sortie plus rapide
      const animation = Animated.timing(toast.opacity, {
        toValue: 0,
        duration: 200, // RÉDUIT de 300ms à 200ms
        useNativeDriver: true,
      });

      animationRefs.current[id] = animation;

      animation.start(() => {
        if (!mountedRef.current) return;

        setToasts((currentToasts) => currentToasts.filter((t) => t.id !== id));

        // Nettoyer les références
        if (timeoutRefs.current[id]) {
          clearTimeout(timeoutRefs.current[id]);
          delete timeoutRefs.current[id];
        }
        delete animationRefs.current[id];
      });

      return updatedToasts;
    });
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      if (!mountedRef.current) return;

      // Si trop de toasts, supprimer le plus ancien
      if (toasts.length >= MAX_TOASTS) {
        const oldestToast = toasts[0];
        if (oldestToast && !oldestToast.isRemoving) {
          removeToast(oldestToast.id);
        }
      }

      const id = Date.now() + Math.random(); // Assurer l'unicité
      const opacity = new Animated.Value(0);

      setToasts((prevToasts) => [
        ...prevToasts.slice(-(MAX_TOASTS - 1)), // Garder seulement les plus récents
        { id, message, type, opacity, isRemoving: false },
      ]);

      // Animation d'entrée plus rapide
      requestAnimationFrame(() => {
        if (!mountedRef.current) return;

        const animation = Animated.timing(opacity, {
          toValue: 1,
          duration: 200, // RÉDUIT de 300ms à 200ms
          useNativeDriver: true,
        });

        animationRefs.current[id] = animation;
        animation.start();

        const timeout = setTimeout(() => {
          removeToast(id);
        }, TOAST_DURATION);

        timeoutRefs.current[id] = timeout;
      });
    },
    [toasts, removeToast]
  );

  const getBackgroundColor = (type: ToastType) => {
    switch (type) {
      case 'success':
        return '#4CAF50';
      case 'error':
        return '#F44336';
      case 'warning':
        return '#FF9800';
      case 'info':
      default:
        return '#2196F3';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <View style={styles.toastContainer} pointerEvents="box-none">
          {toasts.map((toast) => (
            <TouchableOpacity
              key={toast.id}
              activeOpacity={0.8}
              onPress={() => !toast.isRemoving && removeToast(toast.id)}
              style={[
                styles.toastWrapper,
                { opacity: toast.isRemoving ? 0.7 : 1 },
              ]}
            >
              <Animated.View
                style={[
                  styles.toast,
                  { backgroundColor: getBackgroundColor(toast.type) },
                  { opacity: toast.opacity },
                ]}
              >
                <Text style={styles.toastText} numberOfLines={2}>
                  {toast.message}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    zIndex: 9999,
  },
  toastWrapper: {
    width: 320,
    maxWidth: 400,
  },
  toast: {
    padding: 12, // RÉDUIT de 16 à 12
    borderRadius: 8,
    marginVertical: 4, // RÉDUIT de 8 à 4
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    width: '100%',
  },
  toastText: {
    color: 'white',
    fontSize: 14, // RÉDUIT de 16 à 14
    fontWeight: '600',
    textAlign: 'center',
  },
});
