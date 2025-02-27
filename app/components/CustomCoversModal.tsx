// components/CustomCoversModal.tsx
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  StyleSheet, 
  Pressable, 
  TextInput,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';

interface CustomCoversModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (covers: number) => void;
  tableName: string;
}

const CustomCoversModal = ({ visible, onClose, onConfirm, tableName }: CustomCoversModalProps) => {
  const [covers, setCovers] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    // Vérifier si le nombre est valide
    const coversNum = parseInt(covers, 10);
    if (isNaN(coversNum) || coversNum <= 0 || coversNum > 50) {
      setError('Veuillez entrer un nombre valide de couverts (1-50)');
      return;
    }

    // Appeler la fonction de confirmation
    onConfirm(coversNum);
    
    // Réinitialiser le modal
    setCovers('');
    setError('');
    onClose();
  };

  const handleClose = () => {
    // Réinitialiser le modal
    setCovers('');
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
            <Text style={styles.modalTitle}>Nombre de couverts personnalisé</Text>
            <Text style={styles.tableInfo}>Table: {tableName}</Text>
            
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              placeholder="Nombre de couverts"
              value={covers}
              onChangeText={(text) => {
                setCovers(text);
                setError('');
              }}
              maxLength={2}
            />
            
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            
            <View style={styles.buttonsContainer}>
              <Pressable style={[styles.button, styles.cancelButton]} onPress={handleClose}>
                <Text style={styles.buttonText}>Annuler</Text>
              </Pressable>
              <Pressable 
                style={[styles.button, styles.confirmButton]} 
                onPress={handleConfirm}
              >
                <Text style={styles.buttonText}>Confirmer</Text>
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
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
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
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    fontWeight: 'bold',
    color: '#333',
  },
});

export default CustomCoversModal;