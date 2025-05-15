// components/SettingsModals.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Save, X, Plus } from 'lucide-react-native';
import { ConfigData, OpeningHours, PaymentMethod, RestaurantInfo } from '@/utils/settingsTypes';


// Props pour les différents modals
interface InfoModalProps {
  visible: boolean;
  onClose: () => void;
  restaurantInfo: RestaurantInfo;
  onSave: (info: RestaurantInfo) => void;
}

interface HoursModalProps {
  visible: boolean;
  onClose: () => void;
  openingHours: OpeningHours;
  onSave: (hours: OpeningHours) => void;
}

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  paymentMethods: PaymentMethod[];
  onSave: (methods: PaymentMethod[]) => void;
}
export const RestaurantInfoModal: React.FC<InfoModalProps> = ({
  visible,
  onClose,
  restaurantInfo,
  onSave,
}) => {
  // Initialisation des états avec une vérification supplémentaire
  const [name, setName] = useState(restaurantInfo?.name || 'Manjo Carn');
  const [address, setAddress] = useState(
    restaurantInfo?.address ||
      'Route de la Corniche, 82140 Saint Antonin Noble Val'
  );
  const [phone, setPhone] = useState(
    restaurantInfo?.phone || 'Tel : 0563682585'
  );
  const [email, setEmail] = useState(
    restaurantInfo?.email || 'contact@manjos.fr'
  );
  const [siret, setSiret] = useState(
    restaurantInfo?.siret || 'Siret N° 803 520 998 00011'
  );
  const [taxInfo, setTaxInfo] = useState(
    restaurantInfo?.taxInfo || 'TVA non applicable - art.293B du CGI'
  );
  const [owner, setOwner] = useState(restaurantInfo?.owner || 'Virginie');

  // Fonction de sauvegarde
  const handleSave = () => {
    onSave({
      name,
      address,
      phone,
      email,
      siret,
      taxInfo,
      owner,
    });
    onClose();
  };

  // Au lieu de retourner null, utilisons la prop visible du composant Modal
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: '80%',
            maxHeight: '80%',
            backgroundColor: 'white',
            borderRadius: 8,
            padding: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}
        >
          {/* Titre et bouton fermer */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
              borderBottomWidth: 1,
              borderBottomColor: '#e0e0e0',
              paddingBottom: 10,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>
              Informations du Restaurant
            </Text>
            <Pressable onPress={onClose} style={{ padding: 5 }}>
              <X size={24} color="#666" />
            </Pressable>
          </View>

          {/* Contenu du formulaire - Utilisons directement une ScrollView */}
          <ScrollView style={{ maxHeight: '70%' }}>
            {/* Nom */}
            <View style={{ marginBottom: 15 }}>
              <Text
                style={{ fontSize: 16, fontWeight: '500', marginBottom: 5 }}
              >
                Nom du restaurant
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 5,
                  padding: 10,
                  backgroundColor: '#f9f9f9',
                }}
                placeholder="Nom du restaurant"
              />
            </View>

            {/* Adresse */}
            <View style={{ marginBottom: 15 }}>
              <Text
                style={{ fontSize: 16, fontWeight: '500', marginBottom: 5 }}
              >
                Adresse
              </Text>
              <TextInput
                value={address}
                onChangeText={setAddress}
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 5,
                  padding: 10,
                  backgroundColor: '#f9f9f9',
                }}
                placeholder="Adresse complète"
                multiline
              />
            </View>

            {/* Téléphone */}
            <View style={{ marginBottom: 15 }}>
              <Text
                style={{ fontSize: 16, fontWeight: '500', marginBottom: 5 }}
              >
                Téléphone
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 5,
                  padding: 10,
                  backgroundColor: '#f9f9f9',
                }}
                placeholder="Numéro de téléphone"
                keyboardType="phone-pad"
              />
            </View>

            {/* Email */}
            <View style={{ marginBottom: 15 }}>
              <Text
                style={{ fontSize: 16, fontWeight: '500', marginBottom: 5 }}
              >
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 5,
                  padding: 10,
                  backgroundColor: '#f9f9f9',
                }}
                placeholder="Adresse email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* SIRET */}
            <View style={{ marginBottom: 15 }}>
              <Text
                style={{ fontSize: 16, fontWeight: '500', marginBottom: 5 }}
              >
                SIRET
              </Text>
              <TextInput
                value={siret}
                onChangeText={setSiret}
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 5,
                  padding: 10,
                  backgroundColor: '#f9f9f9',
                }}
                placeholder="Numéro SIRET"
              />
            </View>

            {/* Informations TVA */}
            <View style={{ marginBottom: 15 }}>
              <Text
                style={{ fontSize: 16, fontWeight: '500', marginBottom: 5 }}
              >
                Informations TVA
              </Text>
              <TextInput
                value={taxInfo}
                onChangeText={setTaxInfo}
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 5,
                  padding: 10,
                  backgroundColor: '#f9f9f9',
                }}
                placeholder="Informations de TVA"
                multiline
              />
            </View>

            {/* Propriétaire */}
            <View style={{ marginBottom: 15 }}>
              <Text
                style={{ fontSize: 16, fontWeight: '500', marginBottom: 5 }}
              >
                Propriétaire
              </Text>
              <TextInput
                value={owner}
                onChangeText={setOwner}
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 5,
                  padding: 10,
                  backgroundColor: '#f9f9f9',
                }}
                placeholder="Nom du propriétaire"
              />
            </View>
          </ScrollView>

          {/* Bouton Enregistrer */}
          <Pressable
            onPress={handleSave}
            style={{
              backgroundColor: '#4CAF50',
              borderRadius: 5,
              padding: 12,
              alignItems: 'center',
              marginTop: 15,
              flexDirection: 'row',
              justifyContent: 'center',
            }}
          >
            <Save size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
              Enregistrer
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

// Modal pour configurer les paramètres d'impression
export const PrintSettingsModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  printSettings: ConfigData['printSettings'];
  onSave: (settings: ConfigData['printSettings']) => void;
}> = ({ visible, onClose, printSettings, onSave }) => {
  const [settings, setSettings] = useState(printSettings);

  useEffect(() => {
    setSettings(printSettings);
  }, [printSettings]);

  const toggleSetting = (key: keyof ConfigData['printSettings']) => {
    if (typeof settings[key] === 'boolean') {
      setSettings({
        ...settings,
        [key]: !settings[key],
      });
    }
  };

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <View
        style={{
          width: '80%',
          backgroundColor: 'white',
          borderRadius: 8,
          padding: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        {/* Titre et bouton fermer */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: '#e0e0e0',
            backgroundColor: '#f5f5f5',
            padding: 15,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: 'bold' }}>
            Paramètres d'Impression
          </Text>
          <Pressable onPress={onClose} style={{ padding: 5 }}>
            <X size={24} color="#666" />
          </Pressable>
        </View>

        {/* Contenu */}
        <View style={{ padding: 15 }}>
          {/* Impression automatique */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#eee',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '500' }}>
              Impression automatique des reçus
            </Text>
            <Switch
              value={settings.autoPrint}
              onValueChange={() => toggleSetting('autoPrint')}
              trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
            />
          </View>

          {/* Imprimer le logo */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#eee',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '500' }}>
              Imprimer le logo
            </Text>
            <Switch
              value={settings.printLogo}
              onValueChange={() => toggleSetting('printLogo')}
              trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
            />
          </View>

          {/* Imprimer le pied de page */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#eee',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '500' }}>
              Imprimer le pied de page
            </Text>
            <Switch
              value={settings.printFooter}
              onValueChange={() => toggleSetting('printFooter')}
              trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
            />
          </View>

          {/* Texte du pied de page */}
          <View style={{ marginTop: 15 }}>
            <Text style={{ fontSize: 16, fontWeight: '500', marginBottom: 8 }}>
              Texte du pied de page:
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#ddd',
                borderRadius: 5,
                padding: 10,
                textAlignVertical: 'top',
                height: 100,
              }}
              value={settings.footerText}
              onChangeText={(text) =>
                setSettings({ ...settings, footerText: text })
              }
              placeholder="Texte à afficher en bas du reçu"
              multiline
            />
          </View>
        </View>

        {/* Bouton Enregistrer */}
        <View style={{ padding: 15 }}>
          <Pressable
            onPress={handleSave}
            style={{
              backgroundColor: '#4CAF50',
              borderRadius: 5,
              padding: 12,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            }}
          >
            <Save size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
              Enregistrer
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

// Modal pour configurer les méthodes de paiement
export const PaymentMethodsModal: React.FC<PaymentModalProps> = ({
  visible,
  onClose,
  paymentMethods,
  onSave,
}) => {
  // Définir des méthodes par défaut localement pour ce composant
  const defaultPaymentMethods: PaymentMethod[] = [
    { id: 'cash', name: 'Espèces', enabled: true, isDefault: true },
    { id: 'check', name: 'Chèque', enabled: true, isDefault: false },
    { id: 'card', name: 'Carte Bancaire', enabled: true, isDefault: false },
    {
      id: 'ticket',
      name: 'Ticket Restaurant',
      enabled: true,
      isDefault: false,
    },
  ];

  // S'assurer que paymentMethods est un tableau
  const safePaymentMethods = Array.isArray(paymentMethods)
    ? paymentMethods
    : defaultPaymentMethods;

  const [methods, setMethods] = useState<PaymentMethod[]>(safePaymentMethods);
  const [newMethodName, setNewMethodName] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [currentEditId, setCurrentEditId] = useState('');

  useEffect(() => {
    // Mise à jour des méthodes si les props changent
    if (Array.isArray(paymentMethods)) {
      setMethods(paymentMethods);
    } else {
      console.warn(
        "paymentMethods n'est pas un tableau, utilisation des valeurs par défaut"
      );
      setMethods(defaultPaymentMethods);
    }
  }, [paymentMethods]);

  const toggleMethod = (id: string) => {
    setMethods((prev) =>
      prev.map((method) =>
        method.id === id ? { ...method, enabled: !method.enabled } : method
      )
    );
  };

  const setDefaultMethod = (id: string) => {
    setMethods((prev) =>
      prev.map((method) => ({
        ...method,
        isDefault: method.id === id,
      }))
    );
  };

  const addNewMethod = () => {
    if (newMethodName.trim() === '') return;

    if (editMode && currentEditId) {
      // Mode édition
      setMethods((prev) =>
        prev.map((method) =>
          method.id === currentEditId
            ? { ...method, name: newMethodName }
            : method
        )
      );
      setEditMode(false);
      setCurrentEditId('');
    } else {
      // Mode ajout
      const newId = `payment_${Date.now()}`;
      const newMethod: PaymentMethod = {
        id: newId,
        name: newMethodName,
        enabled: true,
        isDefault: methods.length === 0,
      };
      setMethods([...methods, newMethod]);
    }

    setNewMethodName('');
  };

  const editMethod = (id: string, name: string) => {
    setNewMethodName(name);
    setEditMode(true);
    setCurrentEditId(id);
  };

  const removeMethod = (id: string) => {
    // Vérifier si c'est la méthode par défaut
    const isDefault = methods.find((m) => m.id === id)?.isDefault;

    // Filtrer pour supprimer la méthode
    const updatedMethods = methods.filter((method) => method.id !== id);

    // Si on vient de supprimer la méthode par défaut, en définir une nouvelle
    if (isDefault && updatedMethods.length > 0) {
      updatedMethods[0].isDefault = true;
    }

    setMethods(updatedMethods);
  };

  const handleSave = () => {
    // S'assurer qu'au moins une méthode est activée
    const hasEnabledMethod = methods.some((method) => method.enabled);

    let methodsToSave = [...methods];

    if (!hasEnabledMethod && methods.length > 0) {
      // Activer la première méthode si aucune n'est activée
      methodsToSave = methodsToSave.map((method, index) =>
        index === 0 ? { ...method, enabled: true } : method
      );
    }

    // S'assurer qu'une méthode par défaut est définie
    const hasDefaultMethod = methodsToSave.some((method) => method.isDefault);

    if (!hasDefaultMethod && methodsToSave.some((method) => method.enabled)) {
      // Trouver la première méthode activée et la définir par défaut
      const firstEnabledIndex = methodsToSave.findIndex(
        (method) => method.enabled
      );

      if (firstEnabledIndex !== -1) {
        methodsToSave = methodsToSave.map((method, index) => ({
          ...method,
          isDefault: index === firstEnabledIndex,
        }));
      }
    }

    onSave(methodsToSave);
    onClose();
  };

  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <View
        style={{
          width: '80%',
          maxHeight: '80%',
          backgroundColor: 'white',
          borderRadius: 8,
          padding: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        {/* Titre et bouton fermer */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: '#e0e0e0',
            backgroundColor: '#f5f5f5',
            padding: 15,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: 'bold' }}>
            Méthodes de Paiement
          </Text>
          <Pressable onPress={onClose} style={{ padding: 5 }}>
            <X size={24} color="#666" />
          </Pressable>
        </View>

        {/* Liste des méthodes de paiement */}
        <ScrollView style={{ maxHeight: 400 }}>
          {methods.map((method) => (
            <View
              key={method.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 15,
                borderBottomWidth: 1,
                borderBottomColor: '#e0e0e0',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '500' }}>
                  {method.name}
                </Text>
                {method.isDefault && (
                  <View
                    style={{
                      backgroundColor: '#4CAF50',
                      borderRadius: 10,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      marginLeft: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: 'white',
                        fontSize: 12,
                        fontWeight: 'bold',
                      }}
                    >
                      Par défaut
                    </Text>
                  </View>
                )}
              </View>

              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                {/* Bouton Modifier */}
                <TouchableOpacity
                  onPress={() => editMethod(method.id, method.name)}
                  style={{
                    backgroundColor: '#2196F3',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 14 }}>Modifier</Text>
                </TouchableOpacity>

                {/* Bouton Définir par défaut */}
                {!method.isDefault && (
                  <TouchableOpacity
                    onPress={() => setDefaultMethod(method.id)}
                    style={{
                      backgroundColor: '#4CAF50',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 4,
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 14 }}>
                      Par défaut
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Bouton Supprimer */}
                <TouchableOpacity
                  onPress={() => removeMethod(method.id)}
                  style={{
                    backgroundColor: '#F44336',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 14 }}>
                    Supprimer
                  </Text>
                </TouchableOpacity>

                {/* Switch Activé/Désactivé */}
                <Switch
                  value={method.enabled}
                  onValueChange={() => toggleMethod(method.id)}
                  trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
                />
              </View>
            </View>
          ))}

          {/* Ajout de nouvelle méthode */}
          <View
            style={{
              flexDirection: 'row',
              padding: 15,
              gap: 10,
            }}
          >
            <TextInput
              value={newMethodName}
              onChangeText={setNewMethodName}
              placeholder={
                editMode ? 'Modifier le nom' : 'Nouvelle méthode de paiement'
              }
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#ddd',
                borderRadius: 5,
                padding: 10,
              }}
            />
            <TouchableOpacity
              onPress={addNewMethod}
              style={{
                backgroundColor: '#4CAF50',
                paddingHorizontal: 15,
                paddingVertical: 10,
                borderRadius: 5,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {editMode ? (
                <Text style={{ color: 'white', fontSize: 16 }}>Modifier</Text>
              ) : (
                <>
                  <Plus size={16} color="white" style={{ marginRight: 5 }} />
                  <Text style={{ color: 'white', fontSize: 16 }}>Ajouter</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bouton Enregistrer */}
        <View style={{ padding: 15 }}>
          <Pressable
            onPress={handleSave}
            style={{
              backgroundColor: '#4CAF50',
              borderRadius: 5,
              padding: 12,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            }}
          >
            <Save size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
              Enregistrer
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default {
  RestaurantInfoModal,
  PrintSettingsModal,
  PaymentMethodsModal,
};