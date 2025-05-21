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
  isRemoving: boolean; // Flag pour indiquer qu'un toast est en cours de suppression
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

  // Nettoyer les timeouts et animations lors du démontage
  useEffect(() => {
    return () => {
      // Nettoyer les timeouts
      Object.values(timeoutRefs.current).forEach(clearTimeout);

      // Arrêter les animations en cours
      Object.values(animationRefs.current).forEach((animation) => {
        animation.stop();
      });
    };
  }, []);

  const removeToast = useCallback((id: number) => {
    // Vérifier si le toast existe et n'est pas déjà en cours de suppression
    setToasts((prevToasts) => {
      const toastIndex = prevToasts.findIndex((t) => t.id === id);
      if (toastIndex === -1 || prevToasts[toastIndex].isRemoving) {
        return prevToasts;
      }

      // Marquer le toast comme étant en cours de suppression
      const updatedToasts = [...prevToasts];
      updatedToasts[toastIndex] = {
        ...updatedToasts[toastIndex],
        isRemoving: true,
      };

      // Démarrer l'animation de fade out
      const toast = prevToasts[toastIndex];
      const animation = Animated.timing(toast.opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      });

      // Stocker la référence de l'animation
      animationRefs.current[id] = animation;

      animation.start(() => {
        // Supprimer le toast une fois l'animation terminée
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
      const id = Date.now();
      const opacity = new Animated.Value(0);

      // Ajouter le nouveau toast
      setToasts((prevToasts) => [
        ...prevToasts,
        { id, message, type, opacity, isRemoving: false },
      ]);

      // Utiliser requestAnimationFrame pour s'assurer que l'animation démarre après le rendu
      requestAnimationFrame(() => {
        // Démarrer l'animation de fade in
        const animation = Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        });

        animationRefs.current[id] = animation;
        animation.start();

        // Configurer la suppression automatique
        const timeout = setTimeout(() => {
          removeToast(id);
        }, 3000);

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
        <View style={styles.toastContainer}>
          {toasts.map((toast) => (
            <TouchableOpacity
              key={toast.id}
              activeOpacity={0.8}
              // Désactiver la pression pendant l'animation de suppression
              onPress={() => !toast.isRemoving && removeToast(toast.id)}
              // Optionnel : désactiver visuellement le toast quand il est en cours de suppression
              style={{ opacity: toast.isRemoving ? 0.7 : 1 }}
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
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
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
    width: '80%',
    maxWidth: 400,
  },
  toastText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
