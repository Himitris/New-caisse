// app/(tabs)/table-plan.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Switch,
} from 'react-native';
import {
  Printer,
  Share,
  RefreshCw,
  Check,
  Settings,
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getTables, Table } from '../../utils/storage';
import { useToast } from '../../utils/ToastContext';

export default function TablePlanScreen() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [smallService, setSmallService] = useState(false);
  const toast = useToast();

  // Ordre complet des tables pour service normal
  const fullTableOrder = [
    'Doc 1',
    'Doc 2',
    'Doc 3',
    'Vue 1',
    'Vue 2',
    'R1',
    'R2',
    'R3',
    'R4',
    'Poteau',
    'Ext 1',
    'Ext 2',
    'Ext Rge',
    'Bas 0',
    'Bas 1',
    'Arbre 1',
    'Arbre 2',
    'Tronc',
    'Caillou',
    'Escalier 1',
    'Escalier 2',
    'Transfo',
    'Bache 1',
    'Bache 2',
    'Bache 3',
    'Che 1',
    'Che 2',
    'PDC 1',
    'PDC 2',
    'Eve Rgb',
    'Eve Bois',
    'HDB',
    'Lukas 1',
    'Lukas 2',
    'Route 1',
    'Route 2',
    'Sous Cabane',
  ];

  // Ordre réduit des tables pour petit service
  const smallTableOrder = [
    'Doc 1',
    'Doc 2',
    'Doc 3',
    'Vue 1',
    'R1',
    'R2',
    'R3',
    'R4',
    'Poteau',
    'Ext 1',
    'Ext 2',
    'Bas 0',
    'Bas 1',
    'Arbre 1',
    'Arbre 2',
    'Tronc',
    'Caillou',
    'Escalier 1',
    'Escalier 2',
    'Transfo',
    'Bache 1',
    'Bache 2',
    'Bache 3',
    'Che 1',
    'Che 2',
    'PDC 1',
    'PDC 2',
    'Eve Rgb',
    'Eve Bois',
    'HDB',
  ];

  // Tables à afficher selon le mode sélectionné (petit service ou normal)
  const getActiveTableOrder = () => {
    return smallService ? smallTableOrder : fullTableOrder;
  };

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    setLoading(true);
    try {
      const loadedTables = await getTables();
      setTables(loadedTables);
    } catch (error) {
      console.error('Error loading tables:', error);
      toast.showToast('Impossible de charger les tables.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fonction modifiée pour générer le HTML du ticket d'impression avec section "redresse" conditionnelle
  const generateTablePlanHTML = () => {
    const activeTableOrder = getActiveTableOrder();

    // Créer les lignes de table pour chaque section
    let sectionHautRows = '';
    let sectionBasRows = '';

    // Trier les tables par section et dans l'ordre spécifié
    activeTableOrder.forEach((tableName) => {
      // Trouver la table dans notre liste complète
      const table = tables.find((t) => t.name === tableName);
      if (table) {
        const rowHtml = `<tr><td class="table-name">${tableName}</td></tr>`;
        // Déterminer la section et ajouter la ligne dans la section appropriée
        if (table.section === 'Eau') {
          sectionHautRows += rowHtml;
        } else {
          sectionBasRows += rowHtml;
        }
      }
    });

    // En-têtes de section avec style amélioré
    const sectionEauHeader = `<tr><td class="section-header">SECTION EAU</td></tr>`;
    const sectionBuisHeader = `<tr><td class="section-header">SECTION BUIS</td></tr>`;

    // Combiner les sections avec des titres distincts
    const tableRows = `
    ${sectionHautRows ? `${sectionEauHeader}${sectionHautRows}` : ''}
    ${sectionBasRows ? `${sectionBuisHeader}${sectionBasRows}` : ''}
  `;

    // Date et heure actuelles
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    // Section REDRESSE - uniquement en mode service complet
    const redresseSection = !smallService
      ? `
    <div class="redresse-section">
      <div class="redresse-title">REDRESSE</div>
      <div class="note-space"></div>
    </div>
  `
      : '';

    // Format pour le ticket avec sections distinctes et liste agrandie
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page {
            size: portrait;
            margin: 3mm; /* Marge légèrement augmentée */
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            width: 74mm; 
            font-size: 12pt; 
          }
          .header {
            text-align: center;
            margin-bottom: 6mm;
            border-bottom: 1px solid #000;
            padding-bottom: 4mm;
          }
          .title {
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 2mm;
          }
          .date-time {
            font-size: 10pt;
            color: #333;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4mm;
          }
          .section-header {
            font-size: 14pt;
            font-weight: bold;
            text-align: center;
            padding: 4mm 0;
            border-bottom: 2px solid #000;
          }
          .table-name {
            font-size: 13pt; /* Taille augmentée */
            padding: 3mm 2mm; /* Plus d'espace vertical */
            border-bottom: 1px dotted #999;
          }
          .redresse-section {
            margin-top: 6mm;
            padding-top: 4mm;
          }
          .redresse-title {
            font-size: 13pt;
            font-weight: bold;
            text-align: center;
            margin-bottom: 3mm;
          }
          .note-space {
            height: 50mm; /* Espace agrandi pour les notes manuscrites */
            margin: 3mm 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">PLAN DES TABLES</div>
          <div class="date-time">${dateStr} à ${timeStr}</div>
        </div>
        
        <table>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        ${redresseSection}
      </body>
    </html>
  `;
  };

  const handlePrint = async () => {
    setProcessing(true);
    try {
      await Print.printAsync({
        html: generateTablePlanHTML(),
        width: 100,
        height: undefined, // Hauteur automatique
        orientation: 'portrait',
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      toast.showToast("Plan des tables envoyé à l'imprimante", 'success');
    } catch (error) {
      console.error("Échec de l'impression:", error);
      toast.showToast("Impossible d'imprimer le plan", 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleShare = async () => {
    setProcessing(true);
    try {
      const { uri } = await Print.printToFileAsync({
        html: generateTablePlanHTML(),
        width: 100,
        height: undefined, // Hauteur automatique
        base64: false,
      });
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      toast.showToast('Plan des tables partagé avec succès', 'success');
    } catch (error) {
      console.error('Échec du partage:', error);
      toast.showToast('Impossible de partager le plan', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Fonction pour obtenir les tables dans l'ordre spécifié avec leurs sections
  const getOrderedTables = () => {
    const orderedTables: Table[] = [];
    const activeTableOrder = getActiveTableOrder();

    // Pour chaque nom de table dans l'ordre défini
    activeTableOrder.forEach((tableName) => {
      // Rechercher la table correspondante dans notre liste de tables
      const table = tables.find((t) => t.name === tableName);
      if (table) {
        orderedTables.push(table);
      }
    });

    return orderedTables;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement des tables...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* NOUVEAU LAYOUT PAYSAGE - Options à gauche, tables à droite */}
      <View style={styles.landscapeContainer}>
        {/* Colonne de gauche - Options */}
        <View style={styles.leftColumn}>
          <View style={styles.sidebarHeader}>
            <Settings size={20} color="#2196F3" />
            <Text style={styles.sidebarHeaderText}>Options</Text>
          </View>

          <View style={styles.sidebarSection}>
            <Text style={styles.sidebarSectionTitle}>Service</Text>
            <View style={styles.filterOptionSidebar}>
              <Text style={styles.filterText}>Petit Service</Text>
              <Switch
                value={smallService}
                onValueChange={setSmallService}
                trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
              />
            </View>
            <Text style={styles.filterDescription}>
              {smallService
                ? 'Mode petit service : nombre réduit de tables'
                : 'Mode service complet : toutes les tables'}
            </Text>
          </View>

          <View style={styles.sidebarSection}>
            <Text style={styles.sidebarSectionTitle}>Actions</Text>
            <Pressable style={styles.sidebarButton} onPress={loadTables}>
              <RefreshCw size={18} color="#2196F3" />
              <Text style={styles.sidebarButtonText}>
                Rafraîchir les tables
              </Text>
            </Pressable>
          </View>

          {/* Zone pour ajouter d'autres options dans le futur */}
          <View style={styles.sidebarSection}>
            <Text style={styles.sidebarSectionTitle}>Aide</Text>
            <Text style={styles.helpText}>
              Utilisez le switch "Petit Service" pour basculer entre les modes
              de service. Le plan de table imprimé sera organisé selon les
              sections.
            </Text>
          </View>
        </View>

        {/* Colonne de droite - Tables */}
        <View style={styles.rightColumn}>
          <View style={styles.mainHeader}>
            <Text style={styles.mainTitle}>Plan des Tables</Text>
            <Text style={styles.mainSubtitle}>
              {smallService ? 'Mode petit service' : 'Mode service complet'}
            </Text>
          </View>

          <View style={styles.tablesContainer}>
            <ScrollView style={styles.tableListContainer}>
              {/* Section Eau */}
              <Text style={styles.sectionHeader}>Section Eau</Text>
              {getOrderedTables()
                .filter((table) => table.section === 'Eau')
                .map((table) => (
                  <View key={table.id} style={styles.tableItem}>
                    <Text style={styles.tableName}>{table.name}</Text>
                    <Text
                      style={[
                        styles.tableSection,
                        { backgroundColor: '#E3F2FD' },
                      ]}
                    >
                      EAU
                    </Text>
                  </View>
                ))}

              {/* Section Buis */}
              <Text style={styles.sectionHeader}>Section Buis</Text>
              {getOrderedTables()
                .filter((table) => table.section === 'Buis')
                .map((table) => (
                  <View key={table.id} style={styles.tableItem}>
                    <Text style={styles.tableName}>{table.name}</Text>
                    <Text
                      style={[
                        styles.tableSection,
                        { backgroundColor: '#E8F5E9' },
                      ]}
                    >
                      BUIS
                    </Text>
                  </View>
                ))}
            </ScrollView>
          </View>
        </View>
      </View>

      {/* Boutons d'action en bas (inchangés) */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionButton, styles.printButton]}
          onPress={handlePrint}
          disabled={processing}
        >
          {success ? (
            <Check size={24} color="white" />
          ) : (
            <Printer size={24} color="white" />
          )}
          <Text style={styles.actionText}>
            {processing ? 'Impression en cours...' : 'Imprimer le plan'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.shareButton]}
          onPress={handleShare}
          disabled={processing}
        >
          <Share size={24} color="white" />
          <Text style={styles.actionText}>Partager en PDF</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  // Nouveaux styles pour le layout paysage avec sidebar
  landscapeContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  leftColumn: {
    width: 250,
    backgroundColor: '#f9f9f9',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    padding: 16,
  },
  rightColumn: {
    flex: 1,
    backgroundColor: 'white',
  },
  // Styles pour la sidebar
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 20,
  },
  sidebarHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  sidebarSection: {
    marginBottom: 24,
  },
  sidebarSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  filterOptionSidebar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sidebarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    marginTop: 8,
  },
  sidebarButtonText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  // Styles pour la partie droite
  mainHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  mainSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  tablesContainer: {
    flex: 1,
    padding: 16,
  },

  // Styles existants
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  filterText: {
    fontSize: 16,
  },
  filterDescription: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 12,
  },
  tableListContainer: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tableItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  tableName: {
    fontSize: 16,
    fontWeight: '500',
  },
  tableSection: {
    fontSize: 12,
    color: '#666',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: 'white',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 12,
  },
  printButton: {
    backgroundColor: '#4CAF50',
  },
  shareButton: {
    backgroundColor: '#2196F3',
  },
  actionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
