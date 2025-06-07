// utils/ToastContext.tsx
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

export const ToastProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timeoutRefs = useRef<{ [id: number]: number }>({});
  const animationRefs = useRef<{ [id: number]: Animated.CompositeAnimation }>(
    {}
  );

  useEffect(() => {
    return () => {
      // Nettoyer TOUS les timers et animations
      Object.values(timeoutRefs.current).forEach(clearTimeout);
      Object.values(animationRefs.current).forEach((animation) => {
        animation.stop();
      });
      timeoutRefs.current = {};
      animationRefs.current = {};
      setToasts([]);
    };
  }, []);
  const removeToast = useCallback((id: number) => {
    console.log(`🍞 [MEMORY] Suppression toast ${id}`);

    setToasts((prevToasts) => {
      const toastIndex = prevToasts.findIndex((t) => t.id === id);
      if (toastIndex === -1 || prevToasts[toastIndex].isRemoving) {
        console.log(`🍞 [MEMORY] Toast ${id} déjà supprimé ou en cours`);
        return prevToasts;
      }

      // ✅ Nettoyer IMMÉDIATEMENT les refs pour éviter l'accumulation
      if (timeoutRefs.current[id]) {
        clearTimeout(timeoutRefs.current[id]);
        delete timeoutRefs.current[id];
        console.log(`🍞 [MEMORY] Timeout ${id} nettoyé`);
      }

      if (animationRefs.current[id]) {
        animationRefs.current[id].stop();
        delete animationRefs.current[id];
        console.log(`🍞 [MEMORY] Animation ${id} stoppée`);
      }

      const updatedToasts = [...prevToasts];
      updatedToasts[toastIndex] = {
        ...updatedToasts[toastIndex],
        isRemoving: true,
      };

      const toast = prevToasts[toastIndex];
      const animation = Animated.timing(toast.opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      });

      animation.start(() => {
        console.log(`🍞 [MEMORY] Animation ${id} terminée`);
        setToasts((currentToasts) => currentToasts.filter((t) => t.id !== id));
      });

      return updatedToasts;
    });
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      console.log(`🍞 [TOAST] Nouveau toast: ${message.substring(0, 30)}...`);

      const id = Date.now();
      const opacity = new Animated.Value(0);

      setToasts((prevToasts) => {
        console.log(`🍞 [TOAST] Toasts avant ajout: ${prevToasts.length}`);

        let newToasts = [...prevToasts];

        // ✅ LIMITE STRICTE : Maximum 1 toast à la fois
        if (newToasts.length >= 1) {
          console.log(
            `🍞 [TOAST] Suppression forcée de ${newToasts.length} toast(s) existant(s)`
          );

          // Nettoyer TOUS les toasts existants immédiatement
          newToasts.forEach((toast) => {
            if (timeoutRefs.current[toast.id]) {
              clearTimeout(timeoutRefs.current[toast.id]);
              delete timeoutRefs.current[toast.id];
            }
            if (animationRefs.current[toast.id]) {
              animationRefs.current[toast.id].stop();
              delete animationRefs.current[toast.id];
            }
          });

          newToasts = []; // ✅ Vider complètement
        }

        const newToast = { id, message, type, opacity, isRemoving: false };
        console.log(`🍞 [TOAST] Toast ajouté, total: 1`);

        return [newToast];
      });

      // Animation et timer pour le nouveau toast
      requestAnimationFrame(() => {
        const animation = Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        });

        animationRefs.current[id] = animation;
        animation.start();

        const timeout = setTimeout(() => {
          removeToast(id);
        }, 2000); // ✅ Réduit de 3000ms à 2000ms

        timeoutRefs.current[id] = timeout;
      });
    },
    [removeToast]
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
                <Text style={styles.toastText}>{toast.message}</Text>
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
    alignSelf: 'center', // Centre le container
    zIndex: 9999,
    // Retiré left: 0, right: 0 pour ne pas bloquer les côtés
  },
  toastWrapper: {
    // Nouveau style pour le wrapper du toast
    width: 320, // Largeur fixe au lieu de pourcentage
    maxWidth: 400,
  },
  toast: {
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    width: '100%', // Prend toute la largeur du wrapper
  },
  toastText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
