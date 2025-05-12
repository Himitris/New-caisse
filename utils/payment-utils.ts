// utils/payment-utils.ts

import { getTable, updateTable, resetTable, Table, OrderItem } from './storage';
import { events, EVENT_TYPES } from './events';

/**
 * Fonction optimisée pour traiter un paiement partiel
 * Avec correction des bugs liés aux restes et arrondis
 */
export const processPartialPayment = async (
  tableId: number,
  amountToPay: number,
  setProcessing?: (value: boolean) => void
) => {
  if (setProcessing) setProcessing(true);

  try {
    // Récupérer les données actuelles de la table
    const currentTable = await getTable(tableId);

    if (!currentTable || !currentTable.order) {
      return { success: false, error: 'Table ou commande non trouvée' };
    }

    // S'assurer que le montant à payer ne dépasse pas le total de la table
    const originalTotal = currentTable.order.total;
    const actualAmountToPay = Math.min(amountToPay, originalTotal);

    // Créer une copie des articles
    const newItems = currentTable.order.items.slice();

    // Trier par prix croissant
    newItems.sort((a, b) => a.price - b.price);

    let remainingAmount = actualAmountToPay;
    let i = 0;

    // Boucle principale pour le paiement des articles
    while (i < newItems.length && remainingAmount > 0) {
      const item = newItems[i];

      // Ne pas inclure les articles offerts dans le calcul de paiement
      if (item.offered) {
        i++;
        continue;
      }

      if (item.price <= remainingAmount) {
        // Combien d'unités peut-on payer complètement?
        const unitsToPay = Math.floor(remainingAmount / item.price);

        if (unitsToPay >= item.quantity) {
          // On peut payer toutes les unités de cet article
          remainingAmount -= item.price * item.quantity;
          // Supprimer l'article (il sera payé entièrement)
          newItems.splice(i, 1);
          // Ne pas incrémenter i car on a supprimé un élément
        } else {
          // On peut payer certaines unités, mais pas toutes
          remainingAmount -= item.price * unitsToPay;
          // Réduire la quantité
          newItems[i].quantity -= unitsToPay;
          i++;
        }
      } else {
        // Cet article est trop cher pour être payé complètement
        i++;
      }
    }

    // Correction pour le problème des petits restes
    // Si le restant est très petit (< 0.01€), on considère que c'est payé
    if (remainingAmount < 0.01 && remainingAmount > 0) {
      remainingAmount = 0;
    }

    // Gestion des "restes" si le montant restant est significatif
    if (remainingAmount > 0.01) {
      // Recherche d'un "Reste" existant
      let resteIndex = -1;
      for (let j = 0; j < newItems.length; j++) {
        if (newItems[j].name.startsWith('Reste de')) {
          resteIndex = j;
          break;
        }
      }

      if (resteIndex >= 0) {
        // Ajouter au "Reste" existant
        newItems[resteIndex].price = Math.max(
          0,
          newItems[resteIndex].price - remainingAmount
        );
        if (newItems[resteIndex].price <= 0.01) {
          // Supprimer l'article si son prix devient négligeable
          newItems.splice(resteIndex, 1);
        }
      } else {
        // Chercher l'article le moins cher
        const originalSorted = [...currentTable.order.items]
          .filter((item) => !item.offered) // Exclure les articles offerts
          .sort((a, b) => a.price - b.price);

        const cheapestItem =
          originalSorted.length > 0 ? originalSorted[0] : null;

        if (cheapestItem && cheapestItem.price > remainingAmount) {
          // Si l'article le moins cher coûte plus que ce qu'il nous reste à payer
          const itemIndex = newItems.findIndex(
            (item) => item.id === cheapestItem.id && !item.offered
          );

          if (itemIndex >= 0 && newItems[itemIndex].quantity > 0) {
            // Diminuer sa quantité de 1
            newItems[itemIndex].quantity -= 1;

            // Créer un nouvel article "Reste" pour la différence
            const resteAmount = cheapestItem.price - remainingAmount;
            if (resteAmount > 0.01) {
              newItems.push({
                id: Date.now() + Math.random(),
                name: `Reste de ${cheapestItem.name}`,
                price: resteAmount,
                quantity: 1,
              });
            }
          }
        }
      }
    }

    // Calculer le nouveau total en tenant compte des articles offerts
    const newTotal = newItems.reduce((sum, item) => {
      if (!item.offered) {
        return sum + item.price * item.quantity;
      }
      return sum;
    }, 0);

    // Arrondir pour éviter les problèmes de précision
    const roundedNewTotal = Math.round(newTotal * 100) / 100;

    // Si le nouveau total est très petit (< 0.01€), considérer la table comme payée
    if (roundedNewTotal < 0.01) {
      // Réinitialiser la table au lieu de juste mettre à jour
      await resetTable(tableId);

      // Émettre l'événement pour informer l'interface
      events.emit(EVENT_TYPES.TABLE_UPDATED, tableId);

      return {
        success: true,
        newTotal: 0,
        tableClosed: true,
        paidItems: currentTable.order.items,
      };
    } else {
      // Sinon, mettre à jour la table avec le nouveau total
      const updatedTable = {
        ...currentTable,
        order: {
          ...currentTable.order,
          total: roundedNewTotal,
          items: newItems,
        },
      };

      await updateTable(updatedTable);
      // Émettre l'événement pour informer l'interface
      events.emit(EVENT_TYPES.TABLE_UPDATED, tableId);

      return {
        success: true,
        newTotal: roundedNewTotal,
        updatedTable,
        paidItems: currentTable.order.items, // Pour garder une référence aux articles payés
      };
    }
  } catch (error) {
    console.error('Erreur lors du traitement du paiement partiel:', error);
    return { success: false, error };
  } finally {
    if (setProcessing) setProcessing(false);
  }
};
