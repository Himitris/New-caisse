// app/components/SplitSelectionModal.tsx
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  StyleSheet, 
  Pressable, 
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView
} from 'react-native';

interface SplitSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (parts: number) => void;
  defaultPartsCount: number;
  tableName: string;
}

// Valeurs prédéfinies pour le nombre de parts
const PRESET_PARTS = [2, 3, 4, 5, 6, 8, 10];

const SplitSelectionModal = ({ 
  visible, 
  onClose, 
  onConfirm, 
  defaultPartsCount,
  tableName 
}: SplitSelectionModalProps) => {
  const [partsCount, setPartsCount] = useState(defaultPartsCount.toString());
  const [error, setError] = useState('');

  // Fonction pour sélectionner rapidement un nombre prédéfini
  const handleQuickSelect = (number: number) => {
    setPartsCount(number.toString());
    setError('');
  };

  const handleConfirm = () => {
    // Vérifier si le nombre est valide
    const parts = parseInt(partsCount, 10);
    if (isNaN(parts) || parts <= 0 || parts > 50) {
      setError('Veuillez entrer un nombre valide de parts (1-50)');
      return;
    }

    // Appeler la fonction de confirmation
    onConfirm(parts);
    
    // Réinitialiser le modal
    setError('');
    onClose();
  };

  const handleReset = () => {
    setPartsCount(defaultPartsCount.toString());
    setError('');
  };

  const handleClose = () => {
    // Réinitialiser le modal
    setPartsCount(defaultPartsCount.toString());
    setError('');
    onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Nombre de parts pour le partage</Text>
            <Text style={styles.tableInfo}>Table: {tableName}</Text>
            
            <Text style={styles.infoText}>
              Choisissez en combien de parts égales vous souhaitez diviser l'addition
            </Text>
            
            {/* Section des valeurs prédéfinies */}
            <View style={styles.presetContainer}>
              <Text style={styles.presetLabel}>Sélection rapide :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
                <View style={styles.presetButtons}>
                  {PRESET_PARTS.map(number => (
                    <Pressable
                      key={number}
                      style={[
                        styles.presetButton,
                        parseInt(partsCount) === number && styles.presetButtonActive
                      ]}
                      onPress={() => handleQuickSelect(number)}
                    >
                      <Text 
                        style={[
                          styles.presetButtonText,
                          parseInt(partsCount) === number && styles.presetButtonTextActive
                        ]}
                      >
                        {number}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
            
            <Text style={styles.customLabel}>Ou entrez un nombre personnalisé :</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              placeholder="Nombre de parts"
              value={partsCount}
              onChangeText={(text) => {
                setPartsCount(text);
                setError('');
              }}
              maxLength={2}
            />
            
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            
            <View style={styles.buttonsContainer}>
              <Pressable style={styles.resetButton} onPress={handleReset}>
                <Text style={styles.resetButtonText}>Réinitialiser ({defaultPartsCount})</Text>
              </Pressable>
              <Pressable style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </Pressable>
              <Pressable 
                style={styles.confirmButton} 
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonText}>Confirmer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
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
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  tableInfo: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  // Styles pour les boutons prédéfinis
  presetContainer: {
    marginBottom: 16,
  },
  presetLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  presetScroll: {
    maxHeight: 50,
  },
  presetButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  presetButton: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetButtonActive: {
    backgroundColor: '#2196F3',
  },
  presetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  presetButtonTextActive: {
    color: 'white',
  },
  customLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#F44336',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resetButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  cancelButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    fontWeight: 'bold',
    color: '#F44336',
  },
  confirmButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
  },
  confirmButtonText: {
    fontWeight: 'bold',
    color: 'white',
  },
  resetButtonText: {
    fontWeight: '500',
    color: '#333',
  }
});

export default SplitSelectionModal;