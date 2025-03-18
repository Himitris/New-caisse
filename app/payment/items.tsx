// app/payment/items.tsx - Écran de paiement par article (version améliorée avec deux colonnes)
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CreditCard, Wallet, ArrowLeft, Edit3, Check, Plus, Minus, ShoppingCart, ArrowRight } from 'lucide-react-native';
import { getTable, updateTable, addBill, resetTable, OrderItem } from '../../utils/storage';
import { events, EVENT_TYPES } from '../../utils/events';

interface MenuItem {
    id: number;
    name: string;
    quantity: number;
    price: number;
    total: number;
    notes?: string;
}

interface SelectedMenuItem extends MenuItem {
    selectedQuantity: number;
}

export default function ItemsPaymentScreen() {
    const { tableId } = useLocalSearchParams();
    const router = useRouter();
    const tableIdNum = parseInt(tableId as string, 10);

    const [table, setTable] = useState<any>(null);
    const [availableItems, setAvailableItems] = useState<MenuItem[]>([]);
    const [selectedItems, setSelectedItems] = useState<SelectedMenuItem[]>([]);
    const [tableName, setTableName] = useState("");
    const [tableSection, setTableSection] = useState("");
    const [processing, setProcessing] = useState(false);
    const [totalOrder, setTotalOrder] = useState(0);
    const [totalSelected, setTotalSelected] = useState(0);
    // Nouvel état pour stocker tous les articles originaux, y compris ceux à quantité zéro
    const [allOriginalItems, setAllOriginalItems] = useState<MenuItem[]>([]);

    // Définir loadTable en dehors de useEffect pour pouvoir l'utiliser ailleurs
    const loadTable = async () => {
        const tableData = await getTable(tableIdNum);
        if (tableData) {
            setTable(tableData);
            setTableName(tableData.name);
            setTableSection(tableData.section);

            // Convertir les articles en format pour l'affichage
            if (tableData.order && tableData.order.items) {
                const items = tableData.order.items.map((item: OrderItem) => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    total: item.price * item.quantity,
                    notes: item.notes
                }));
                setAvailableItems(items);

                // Stocker TOUS les articles originaux dans l'état séparé
                setAllOriginalItems(items);

                // Calculer le total de la commande
                const orderTotal = items.reduce((sum, item) => sum + item.total, 0);
                setTotalOrder(orderTotal);
            }
        }
    };

    // Charger les données de la table
    useEffect(() => {
        loadTable();
    }, [tableIdNum]);

    // Calculer le total sélectionné quand la sélection change
    useEffect(() => {
        const newTotal = selectedItems.reduce(
            (sum, item) => sum + (item.price * item.selectedQuantity),
            0
        );
        setTotalSelected(newTotal);
    }, [selectedItems]);

    // Ajouter un article à la sélection
    const addItemToSelection = (item: MenuItem) => {
        // Vérifier si la quantité disponible > 0
        if (item.quantity <= 0) {
            return;
        }

        // Vérifier si l'article est déjà dans la sélection
        const existingIndex = selectedItems.findIndex(selected => selected.id === item.id);

        if (existingIndex >= 0) {
            // Si l'article existe déjà, augmenter la quantité sélectionnée
            const updatedSelectedItems = [...selectedItems];
            const currentItem = updatedSelectedItems[existingIndex];

            updatedSelectedItems[existingIndex] = {
                ...currentItem,
                selectedQuantity: currentItem.selectedQuantity + 1
            };
            setSelectedItems(updatedSelectedItems);
        } else {
            // Si l'article n'existe pas encore dans la sélection, l'ajouter
            const newSelectedItem: SelectedMenuItem = {
                ...item,
                selectedQuantity: 1
            };
            setSelectedItems([...selectedItems, newSelectedItem]);
        }

        // Mettre à jour les articles disponibles en réduisant la quantité
        const updatedAvailableItems = [...availableItems];
        const availableItemIndex = updatedAvailableItems.findIndex(availItem => availItem.id === item.id);

        if (availableItemIndex >= 0) {
            const availItem = updatedAvailableItems[availableItemIndex];
            const newQuantity = availItem.quantity - 1;

            if (newQuantity <= 0) {
                // On retire l'item de la liste des disponibles mais on conserve une référence
                // pour pouvoir le restaurer plus tard si nécessaire
                updatedAvailableItems.splice(availableItemIndex, 1);
            } else {
                // Mettre à jour la quantité
                updatedAvailableItems[availableItemIndex] = {
                    ...availItem,
                    quantity: newQuantity,
                    total: availItem.price * newQuantity
                };
            }
        }

        setAvailableItems(updatedAvailableItems);
    };

    // Retirer un article de la sélection
    const removeItemFromSelection = (itemId: number) => {
        const itemToRemove = selectedItems.find(item => item.id === itemId);

        if (!itemToRemove) return;

        if (itemToRemove.selectedQuantity > 1) {
            // Si la quantité > 1, diminuer la quantité
            const updatedItems = selectedItems.map(item =>
                item.id === itemId
                    ? { ...item, selectedQuantity: item.selectedQuantity - 1 }
                    : item
            );
            setSelectedItems(updatedItems);
        } else {
            // Si la quantité = 1, retirer l'article
            setSelectedItems(selectedItems.filter(item => item.id !== itemId));
        }

        // Mettre à jour les articles disponibles
        updateAvailableItemsQuantity(itemId, 1);
    };

    // Supprimer complètement un article de la sélection
    const removeItemCompletely = (itemId: number) => {
        const itemToRemove = selectedItems.find(item => item.id === itemId);

        if (!itemToRemove) return;

        // Retirer l'article de la sélection
        setSelectedItems(selectedItems.filter(item => item.id !== itemId));

        // Vérifier si l'article existe dans les articles disponibles
        const existingItemIndex = availableItems.findIndex(item => item.id === itemId);

        if (existingItemIndex >= 0) {
            // Si l'article existe, augmenter sa quantité
            const updatedAvailableItems = [...availableItems];
            const availableItem = updatedAvailableItems[existingItemIndex];
            updatedAvailableItems[existingItemIndex] = {
                ...availableItem,
                quantity: availableItem.quantity + itemToRemove.selectedQuantity,
                total: availableItem.price * (availableItem.quantity + itemToRemove.selectedQuantity)
            };
            setAvailableItems(updatedAvailableItems);
        } else {
            // Si l'article n'existe pas, chercher dans les articles originaux
            const originalItem = allOriginalItems.find(item => item.id === itemId);

            if (originalItem) {
                // Ajouter l'article à la liste des disponibles
                setAvailableItems([
                    ...availableItems,
                    {
                        id: originalItem.id,
                        name: originalItem.name,
                        quantity: itemToRemove.selectedQuantity,
                        price: originalItem.price,
                        total: originalItem.price * itemToRemove.selectedQuantity,
                        notes: originalItem.notes
                    }
                ]);
            }
        }
    };

    // Mettre à jour la quantité d'un article disponible
    const updateAvailableItemsQuantity = (itemId: number, change: number) => {
        setAvailableItems(prevItems => {
            const existingItemIndex = prevItems.findIndex(item => item.id === itemId);

            if (existingItemIndex >= 0) {
                // Si l'article existe déjà, mettre à jour sa quantité
                const updatedItems = [...prevItems];
                const item = updatedItems[existingItemIndex];
                const newQuantity = item.quantity + change;

                updatedItems[existingItemIndex] = {
                    ...item,
                    quantity: newQuantity,
                    total: item.price * newQuantity
                };

                return updatedItems;
            } else {
                // Si l'article n'existe pas, l'ajouter aux articles disponibles
                const itemToAdd = selectedItems.find(item => item.id === itemId);
                if (itemToAdd) {
                    return [
                        ...prevItems,
                        {
                            id: itemToAdd.id,
                            name: itemToAdd.name,
                            quantity: change,
                            price: itemToAdd.price,
                            total: itemToAdd.price * change,
                            notes: itemToAdd.notes
                        }
                    ];
                }
            }

            return prevItems;
        });
    };

    // Traiter le paiement des articles sélectionnés
    const handlePayment = async (method: 'card' | 'cash' | 'check') => {
        // Vérifier qu'au moins un article est sélectionné
        if (selectedItems.length === 0) {
            Alert.alert('Aucun article sélectionné', 'Veuillez sélectionner au moins un article à payer.');
            return;
        }

        setProcessing(true);

        try {
            // Récupérer les données actuelles de la table
            const currentTable = await getTable(tableIdNum);
            if (!currentTable || !currentTable.order) {
                Alert.alert('Erreur', 'Impossible de récupérer les informations de la table.');
                setProcessing(false);
                return;
            }

            // Préparer la liste des articles payés pour la facture
            const paidItems = selectedItems.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.selectedQuantity,
                price: item.price
            }));

            // Créer une facture pour les articles payés
            const bill = {
                id: Date.now(),
                tableNumber: tableIdNum,
                tableName: tableName,
                section: tableSection,
                amount: totalSelected,
                items: paidItems.length,
                status: 'paid' as 'paid',
                timestamp: new Date().toISOString(),
                paymentMethod: method,
                paymentType: 'items' as any,
                paidItems: paidItems
            };

            // Ajouter la facture à l'historique
            await addBill(bill);

            // Mettre à jour la commande de la table en retirant les articles payés
            let updatedOrderItems = [...currentTable.order.items]; // Copie des articles actuels

            // Pour chaque article payé, réduire sa quantité ou le supprimer
            for (const selectedItem of selectedItems) {
                const orderItemIndex = updatedOrderItems.findIndex(
                    item => item.id === selectedItem.id
                );

                if (orderItemIndex >= 0) {
                    const orderItem = updatedOrderItems[orderItemIndex];
                    const remainingQuantity = orderItem.quantity - selectedItem.selectedQuantity;

                    if (remainingQuantity <= 0) {
                        // Si plus aucune quantité, retirer l'article
                        updatedOrderItems.splice(orderItemIndex, 1);
                    } else {
                        // Sinon, mettre à jour la quantité
                        updatedOrderItems[orderItemIndex] = {
                            ...orderItem,
                            quantity: remainingQuantity
                        };
                    }
                }
            }

            // Calculer le nouveau total
            const newTotal = updatedOrderItems.reduce(
                (sum, item) => sum + (item.price * item.quantity),
                0
            );

            // Si tous les articles ont été payés
            if (updatedOrderItems.length === 0 || newTotal <= 0) {
                // Réinitialiser la table
                await resetTable(tableIdNum);

                // Émettre un événement de mise à jour
                events.emit(EVENT_TYPES.TABLE_UPDATED, tableIdNum);

                Alert.alert(
                    'Paiement réussi',
                    'Tous les articles ont été payés.',
                    [
                        {
                            text: 'OK',
                            onPress: () => router.push('/')
                        }
                    ]
                );
            } else {
                // Mettre à jour la table avec les articles restants
                const updatedTable = {
                    ...currentTable,
                    order: {
                        ...currentTable.order,
                        items: updatedOrderItems,
                        total: newTotal
                    }
                };

                await updateTable(updatedTable);

                // Émettre un événement pour que la table soit actualisée si l'utilisateur revient à cet écran
                events.emit(EVENT_TYPES.TABLE_UPDATED, tableIdNum);

                Alert.alert(
                    'Paiement partiel réussi',
                    `Articles payés: ${totalSelected.toFixed(2)}€\nRestant à payer: ${newTotal.toFixed(2)}€`,
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                // Recharger la page avec les articles restants au lieu de revenir à la page de table
                                setSelectedItems([]);
                                loadTable();
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('Erreur lors du paiement:', error);
            Alert.alert('Erreur', 'Une erreur est survenue lors du traitement du paiement.');
        } finally {
            setProcessing(false);
        }
    };

    if (!table) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Chargement des informations de la table...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable
                    style={styles.backButton}
                    onPress={() => {
                        // Vérifier s'il reste des articles sélectionnés avant de quitter
                        if (selectedItems.length > 0) {
                            Alert.alert(
                                "Articles en attente de paiement",
                                "Attention, vous avez des articles sélectionnés qui n'ont pas été payés. Voulez-vous vraiment quitter cette page?",
                                [
                                    {
                                        text: "Annuler",
                                        style: "cancel"
                                    },
                                    {
                                        text: "Quitter quand même",
                                        onPress: () => router.back()
                                    }
                                ]
                            );
                        } else {
                            router.back();
                        }
                    }}
                >
                    <ArrowLeft size={24} color="#333" />
                </Pressable>
                <View>
                    <Text style={styles.title}>Paiement par article - {tableName}</Text>
                    {tableSection && (
                        <View style={styles.sectionBadge}>
                            <Text style={styles.sectionText}>{tableSection}</Text>
                        </View>
                    )}
                </View>
                {selectedItems.length > 0 && (
                    <View style={styles.warningBadge}>
                        <Text style={styles.warningText}>{selectedItems.length} article(s) en attente</Text>
                    </View>
                )}
            </View>

            <View style={styles.summaryCard}>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total de la commande:</Text>
                    <Text style={styles.totalAmount}>{totalOrder.toFixed(2)} €</Text>
                </View>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Articles sélectionnés:</Text>
                    <Text style={styles.selectedAmount}>{totalSelected.toFixed(2)} €</Text>
                </View>
            </View>

            <View style={styles.columnsContainer}>
                {/* Colonne de gauche - Articles disponibles */}
                <View style={styles.column}>
                    <View style={styles.columnHeader}>
                        <Text style={styles.columnTitle}>Articles disponibles</Text>
                        <ShoppingCart size={20} color="#666" />
                    </View>

                    <ScrollView style={styles.itemsList}>
                        {availableItems.length === 0 ? (
                            <Text style={styles.emptyText}>Tous les articles ont été sélectionnés</Text>
                        ) : (
                            availableItems.map(item => (
                                <View key={item.id} style={styles.itemCard}>
                                    <View style={styles.itemHeader}>
                                        <Text style={styles.itemName}>{item.name}</Text>
                                        <Text style={styles.itemPrice}>{item.price.toFixed(2)} €</Text>
                                    </View>

                                    <View style={styles.itemActions}>
                                        <Text style={styles.quantityText}>Quantité: {item.quantity}</Text>

                                        <View style={styles.actionButtons}>
                                            <Pressable
                                                style={styles.addButton}
                                                onPress={() => addItemToSelection(item)}
                                            >
                                                <Plus size={16} color="white" />
                                                <Text style={styles.addButtonText}>Ajouter</Text>
                                            </Pressable>

                                            {item.quantity > 1 && (
                                                <Pressable
                                                    style={[styles.addButton, styles.addAllButton]}
                                                    onPress={() => {
                                                        // Stocker la quantité originale car elle va changer pendant la boucle
                                                        const originalQuantity = item.quantity;
                                                        // Créer une copie temporaire de l'item
                                                        const tempItem = { ...item };

                                                        // Ajouter tous les articles en une fois sans utiliser la boucle
                                                        // qui causerait des problèmes de mise à jour d'état
                                                        const existingIndex = selectedItems.findIndex(selected => selected.id === item.id);

                                                        if (existingIndex >= 0) {
                                                            // Si l'article existe déjà, augmenter sa quantité
                                                            const updatedSelectedItems = [...selectedItems];
                                                            const currentSelectedQty = updatedSelectedItems[existingIndex].selectedQuantity;
                                                            const newSelectedQty = currentSelectedQty + originalQuantity;

                                                            updatedSelectedItems[existingIndex] = {
                                                                ...updatedSelectedItems[existingIndex],
                                                                selectedQuantity: newSelectedQty
                                                            };

                                                            setSelectedItems(updatedSelectedItems);
                                                        } else {
                                                            // Sinon ajouter un nouvel article
                                                            const newSelectedItem: SelectedMenuItem = {
                                                                ...tempItem,
                                                                selectedQuantity: originalQuantity
                                                            };

                                                            setSelectedItems([...selectedItems, newSelectedItem]);
                                                        }

                                                        // Mettre à jour la quantité disponible
                                                        setAvailableItems(prevItems =>
                                                            prevItems.map(availItem => {
                                                                if (availItem.id === item.id) {
                                                                    return {
                                                                        ...availItem,
                                                                        quantity: 0,
                                                                        total: 0
                                                                    };
                                                                }
                                                                return availItem;
                                                            }).filter(availItem => availItem.quantity > 0) // Retirer l'item de la liste si quantité = 0
                                                        );
                                                    }}
                                                >
                                                    <ShoppingCart size={16} color="white" />
                                                    <Text style={styles.addButtonText}>Tout</Text>
                                                </Pressable>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </View>

                {/* Colonne de droite - Articles sélectionnés */}
                <View style={styles.column}>
                    <View style={styles.columnHeader}>
                        <Text style={styles.columnTitle}>Articles sélectionnés</Text>
                        <ShoppingCart size={20} color="#4CAF50" />
                    </View>

                    <ScrollView style={styles.itemsList}>
                        {selectedItems.length === 0 ? (
                            <Text style={styles.emptyText}>Aucun article sélectionné</Text>
                        ) : (
                            selectedItems.map(item => (
                                <View key={item.id} style={[styles.itemCard, styles.selectedItemCard]}>
                                    <View style={styles.itemHeader}>
                                        <Text style={styles.itemName}>{item.name}</Text>
                                        <Text style={styles.selectedItemPrice}>{item.price.toFixed(2)} €</Text>
                                    </View>

                                    <View style={styles.selectedItemDetails}>
                                        <View style={styles.quantityControl}>
                                            <Pressable
                                                style={styles.quantityButton}
                                                onPress={() => removeItemFromSelection(item.id)}
                                            >
                                                <Minus size={16} color="#666" />
                                            </Pressable>

                                            <Text style={styles.quantityValue}>{item.selectedQuantity}</Text>

                                            <Pressable
                                                style={styles.quantityButton}
                                                onPress={() => {
                                                    const availableItem = availableItems.find(avail => avail.id === item.id);
                                                    if (availableItem && availableItem.quantity > 0) {
                                                        addItemToSelection(availableItem);
                                                    }
                                                }}
                                            >
                                                <Plus size={16} color="#666" />
                                            </Pressable>
                                        </View>

                                        <View style={styles.selectedItemActions}>
                                            <Text style={styles.subtotalText}>
                                                {(item.price * item.selectedQuantity).toFixed(2)} €
                                            </Text>

                                            <Pressable
                                                style={styles.removeButton}
                                                onPress={() => removeItemCompletely(item.id)}
                                            >
                                                <Text style={styles.removeButtonText}>Retirer</Text>
                                            </Pressable>
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </View>
            </View>

            <View style={styles.paymentMethods}>
                <Text style={styles.paymentTitle}>Méthode de paiement</Text>

                <View style={styles.paymentButtons}>
                    <Pressable
                        style={[styles.paymentButton, { backgroundColor: '#4CAF50' }]}
                        onPress={() => handlePayment('card')}
                        disabled={processing || selectedItems.length === 0}
                    >
                        <CreditCard size={24} color="white" />
                        <Text style={styles.paymentButtonText}>Carte</Text>
                    </Pressable>

                    <Pressable
                        style={[styles.paymentButton, { backgroundColor: '#2196F3' }]}
                        onPress={() => handlePayment('cash')}
                        disabled={processing || selectedItems.length === 0}
                    >
                        <Wallet size={24} color="white" />
                        <Text style={styles.paymentButtonText}>Espèces</Text>
                    </Pressable>

                    <Pressable
                        style={[styles.paymentButton, { backgroundColor: '#9C27B0' }]}
                        onPress={() => handlePayment('check')}
                        disabled={processing || selectedItems.length === 0}
                    >
                        <Edit3 size={24} color="white" />
                        <Text style={styles.paymentButtonText}>Chèque</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        marginRight: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    sectionBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#E1F5FE',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 16,
        marginTop: 4,
    },
    sectionText: {
        color: '#0288D1',
        fontWeight: '600',
        fontSize: 12,
    },
    summaryCard: {
        backgroundColor: 'white',
        margin: 12,
        padding: 12,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    totalLabel: {
        fontSize: 16,
        color: '#666',
    },
    totalAmount: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    selectedAmount: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#4CAF50',
    },
    columnsContainer: {
        flex: 1,
        flexDirection: 'row',
        padding: 8,
        gap: 8,
    },
    column: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 8,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    columnHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f9f9f9',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    columnTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    itemsList: {
        flex: 1,
    },
    itemCard: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    selectedItemCard: {
        backgroundColor: '#f9fff9',
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
        marginRight: 8,
    },
    itemPrice: {
        fontSize: 14,
        fontWeight: '600',
    },
    selectedItemPrice: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4CAF50',
    },
    emptyText: {
        textAlign: 'center',
        color: '#999',
        marginTop: 20,
        fontStyle: 'italic',
    },
    itemActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 6,
    },
    quantityText: {
        fontSize: 14,
        color: '#666',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4CAF50',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 4,
        gap: 4,
    },
    addAllButton: {
        backgroundColor: '#2196F3',
    },
    addButtonText: {
        color: 'white',
        fontWeight: '500',
        fontSize: 12,
    },
    selectedItemDetails: {
        gap: 8,
    },
    selectedItemActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    quantityControl: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#f0f0f0',
        borderRadius: 4,
        overflow: 'hidden',
    },
    quantityButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityValue: {
        width: 36,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '600',
    },
    subtotalText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4CAF50',
    },
    removeButton: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: '#f8f8f8',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 4,
    },
    removeButtonText: {
        fontSize: 12,
        color: '#F44336',
    },
    paymentMethods: {
        backgroundColor: 'white',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    paymentTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    paymentButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    paymentButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 8,
        marginHorizontal: 6,
        gap: 8,
    },
    paymentButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
});