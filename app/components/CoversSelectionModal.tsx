// components/CoversSelectionModal.tsx
import React from 'react';
import { 
  View, 
  Text, 
  Modal, 
  StyleSheet, 
  Pressable,
  TouchableWithoutFeedback,
  ScrollView
} from 'react-native';

interface CoversSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCovers: (covers: number) => void;
  onCustomCovers: () => void;
  tableName: string;
}

const COVERS_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 10, 12];

const CoversSelectionModal = ({ 
  visible, 
  onClose, 
  onSelectCovers, 
  onCustomCovers, 
  tableName 
}: CoversSelectionModalProps) => {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Nombre de couverts</Text>
              <Text style={styles.tableInfo}>Table: {tableName}</Text>
              
              <ScrollView style={styles.optionsContainer}>
                {COVERS_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    style={styles.optionButton}
                    onPress={() => onSelectCovers(option)}
                  >
                    <Text style={styles.optionText}>{option} couverts</Text>
                  </Pressable>
                ))}
                
                <Pressable
                  style={[styles.optionButton, styles.customButton]}
                  onPress={onCustomCovers}
                >
                  <Text style={[styles.optionText, styles.customText]}>Personnalisé...</Text>
                </Pressable>
              </ScrollView>
              
              <Pressable 
                style={styles.cancelButton} 
                onPress={onClose}
              >
                <Text style={styles.cancelText}>Annuler</Text>
              </Pressable>
            </View>
          </TouchableWithoutFeedback>
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
    maxHeight: '70%',
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
  optionsContainer: {
    maxHeight: 300,
  },
  optionButton: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  customButton: {
    backgroundColor: '#e3f2fd',
  },
  customText: {
    color: '#2196F3',
  },
  cancelButton: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
  },
});

export default CoversSelectionModal;