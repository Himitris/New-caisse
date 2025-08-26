// app/components/SecretPasswordModal.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { Eye, EyeOff, Copy, X } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SecretPasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

const SecretPasswordModal: React.FC<SecretPasswordModalProps> = ({
  visible,
  onClose,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // 🔐 Charger le vrai mot de passe depuis le stockage
  useEffect(() => {
    const loadCurrentPassword = async () => {
      if (!visible) return;
      
      setLoading(true);
      try {
        // Clé utilisée par le système de mot de passe (à adapter selon votre implémentation)
        const storedPassword = await AsyncStorage.getItem('manjo_carn_admin_password');
        
        if (storedPassword) {
          setCurrentPassword(storedPassword);
        } else {
          // Mot de passe par défaut si aucun n'est défini
          setCurrentPassword('tototo');
        }
      } catch (error) {
        console.error('Erreur lors du chargement du mot de passe:', error);
        setCurrentPassword('tototo'); // Fallback
      } finally {
        setLoading(false);
      }
    };

    loadCurrentPassword();
  }, [visible]);

  const handleCopy = async () => {
    try {
      // Pour React Native avec Expo, on peut utiliser expo-clipboard
      // import * as Clipboard from 'expo-clipboard';
      // await Clipboard.setStringAsync(currentPassword);
      
      // Pour l'instant, on simule juste l'action
      setCopied(true);
      Alert.alert('Copié!', 'Le mot de passe a été copié dans le presse-papier');
      
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de copier le mot de passe');
    }
  };

  const handleClose = () => {
    setShowPassword(false);
    setCopied(false);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🔐 Accès Secret Développeur</Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <X size={24} color="#666" />
            </Pressable>
          </View>

          <View style={styles.warningSection}>
            <Text style={styles.warningText}>
              ⚠️ Informations sensibles - Usage administrateur uniquement
            </Text>
          </View>

          <View style={styles.passwordSection}>
            <Text style={styles.passwordLabel}>
              Mot de passe administrateur actuel :
            </Text>
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Chargement...</Text>
              </View>
            ) : (
              <View style={styles.passwordContainer}>
                <View style={styles.passwordDisplay}>
                  <Text style={[styles.passwordText, !showPassword && styles.hiddenPassword]}>
                    {showPassword ? currentPassword : '•'.repeat(currentPassword.length)}
                  </Text>
                </View>
                
                <View style={styles.passwordActions}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color="#666" />
                    ) : (
                      <Eye size={20} color="#666" />
                    )}
                  </Pressable>
                  
                  <Pressable
                    style={[styles.actionButton, copied && styles.copiedButton]}
                    onPress={handleCopy}
                  >
                    <Copy size={20} color={copied ? "#4CAF50" : "#666"} />
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.infoText}>
              💡 Ce mot de passe donne accès aux rapports Z et fonctions avancées
            </Text>
            <Text style={styles.activationText}>
              🤫 Activé en tapant 10x sur la version (en bas de l'écran)
            </Text>
            <Text style={styles.modifyText}>
              ⚙️ Modifiable dans Paramètres - Sécurité - Changer le mot de passe
            </Text>
          </View>

          <View style={styles.usageSection}>
            <Text style={styles.usageSectionTitle}>📋 Utilisations :</Text>
            <Text style={styles.usageItem}>• Accès aux rapports Z</Text>
            <Text style={styles.usageItem}>• Réinitialisation système</Text>
            <Text style={styles.usageItem}>• Configuration avancée</Text>
            <Text style={styles.usageItem}>• Mode développeur</Text>
          </View>

          <View style={styles.footerSection}>
            <Text style={styles.footerText}>
              Développé avec ❤️ pour Manjo Carn
            </Text>
            <Text style={styles.devNote}>
              "L'œuf de Pâques du développeur ! 🥚✨"
            </Text>
            <Text style={styles.versionNote}>
              v2.3.0 - Build 165 - Mode Secret
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  warningSection: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningText: {
    fontSize: 13,
    color: '#856404',
    fontWeight: '600',
    textAlign: 'center',
  },
  passwordSection: {
    marginBottom: 20,
  },
  passwordLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  passwordDisplay: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
    minHeight: 52,
    justifyContent: 'center',
  },
  passwordText: {
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: '600',
    color: '#2196F3',
    textAlign: 'center',
  },
  hiddenPassword: {
    color: '#999',
    fontSize: 18,
    letterSpacing: 3,
  },
  passwordActions: {
    flexDirection: 'column',
    gap: 8,
  },
  actionButton: {
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  copiedButton: {
    backgroundColor: '#E8F5E8',
    borderColor: '#4CAF50',
  },
  infoSection: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoText: {
    fontSize: 13,
    color: '#1976D2',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 4,
  },
  activationText: {
    fontSize: 12,
    color: '#1976D2',
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.8,
    marginBottom: 4,
  },
  modifyText: {
    fontSize: 11,
    color: '#1976D2',
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.7,
  },
  loadingContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  usageSection: {
    backgroundColor: '#F3E5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
  },
  usageSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7B1FA2',
    marginBottom: 8,
  },
  usageItem: {
    fontSize: 12,
    color: '#7B1FA2',
    marginBottom: 2,
    paddingLeft: 4,
  },
  footerSection: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  devNote: {
    fontSize: 11,
    color: '#9C27B0',
    fontStyle: 'italic',
    marginBottom: 2,
  },
  versionNote: {
    fontSize: 10,
    color: '#999',
    opacity: 0.7,
  },
});

export default SecretPasswordModal;