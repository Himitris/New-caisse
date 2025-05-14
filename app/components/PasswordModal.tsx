import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, Lock, Eye, EyeOff } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

interface PasswordModalProps {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void; 
  type: 'verify' | 'change';
}

const PASSWORD_STORAGE_KEY = 'manjo_carn_admin_password';
const DEFAULT_PASSWORD = 'tototo';

export const getStoredPassword = async (): Promise<string> => {
  try {
    const password = await AsyncStorage.getItem(PASSWORD_STORAGE_KEY);
    return password || DEFAULT_PASSWORD;
  } catch (error) {
    console.error('Erreur lors de la récupération du mot de passe:', error);
    return DEFAULT_PASSWORD;
  }
};

export const setStoredPassword = async (
  newPassword: string
): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(PASSWORD_STORAGE_KEY, newPassword);
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du mot de passe:', error);
    return false;
  }
};

const PasswordModal: React.FC<PasswordModalProps> = ({
  visible,
  onSuccess,
  onCancel, // Utilisation de la nouvelle prop
  type,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setLoading(false);
    }
  }, [visible]);

  const handleVerifyPassword = async () => {
    if (!currentPassword) {
      setError('Veuillez entrer le mot de passe');
      return;
    }

    setLoading(true);
    try {
      const storedPassword = await getStoredPassword();

      if (currentPassword === storedPassword) {
        setLoading(false);
        onSuccess();
      } else {
        setError('Mot de passe incorrect');
        setLoading(false);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du mot de passe:', error);
      setError('Une erreur est survenue');
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      setError('Veuillez entrer le mot de passe actuel');
      return;
    }

    if (!newPassword) {
      setError('Veuillez entrer un nouveau mot de passe');
      return;
    }

    if (newPassword.length < 4) {
      setError('Le nouveau mot de passe doit contenir au moins 4 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      const storedPassword = await getStoredPassword();

      if (currentPassword !== storedPassword) {
        setError('Mot de passe actuel incorrect');
        setLoading(false);
        return;
      }

      const success = await setStoredPassword(newPassword);

      if (success) {
        setLoading(false);
        Alert.alert('Succès', 'Le mot de passe a été modifié avec succès', [
          { text: 'OK', onPress: onSuccess },
        ]);
      } else {
        setError('Impossible de sauvegarder le nouveau mot de passe');
        setLoading(false);
      }
    } catch (error) {
      console.error('Erreur lors du changement de mot de passe:', error);
      setError('Une erreur est survenue');
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (type === 'verify') {
      handleVerifyPassword();
    } else {
      handleChangePassword();
    }
  };

  const handleCancel = () => {
    if (type === 'verify') {
      router.push('/'); // Retour à l'accueil
    } else if (type === 'change') {
      onCancel(); // Ferme le modal
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Lock size={24} color="#2196F3" />
            <Text style={styles.modalTitle}>
              {type === 'verify'
                ? 'Accès sécurisé'
                : 'Modifier le mot de passe'}
            </Text>
            <Pressable onPress={handleCancel} style={styles.closeButton}>
              <X size={24} color="#666" />
            </Pressable>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {type === 'verify' ? 'Mot de passe' : 'Mot de passe actuel'}
            </Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Entrez le mot de passe"
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? (
                  <EyeOff size={20} color="#666" />
                ) : (
                  <Eye size={20} color="#666" />
                )}
              </Pressable>
            </View>
          </View>

          {type === 'change' && (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Nouveau mot de passe</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Entrez le nouveau mot de passe"
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                  />
                  <Pressable
                    style={styles.eyeButton}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff size={20} color="#666" />
                    ) : (
                      <Eye size={20} color="#666" />
                    )}
                  </Pressable>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Confirmer le mot de passe</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirmez le nouveau mot de passe"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                  />
                  <Pressable
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} color="#666" />
                    ) : (
                      <Eye size={20} color="#666" />
                    )}
                  </Pressable>
                </View>
              </View>
            </>
          )}

          <View style={styles.buttonsContainer}>
            <Pressable style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {type === 'verify' ? 'Valider' : 'Enregistrer'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  eyeButton: {
    padding: 12,
  },
  errorText: {
    color: '#F44336',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default PasswordModal;
