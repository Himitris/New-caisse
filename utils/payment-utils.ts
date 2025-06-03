// utils/payment-utils.ts - Version simplifiée sans événements

import { getTable, updateTable, resetTable } from './storage';

/**
 * Fonction simplifiée pour traiter un paiement partiel
 */
export const processPartialPayment = async (
  tableId: number,
  amountToPay: number
) => {
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
    const newItems = [...currentTable.order.items];

    // Trier par prix croissant pour optimiser le paiement
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

    // Si le restant est très petit (< 0.01€), on considère que c'est payé
    if (remainingAmount < 0.01 && remainingAmount > 0) {
      remainingAmount = 0;
    }

    // Gestion des "restes" si le montant restant est significatif
    if (remainingAmount > 0.01) {
      // Chercher l'article le moins cher
      const originalSorted = [...currentTable.order.items]
        .filter((item) => !item.offered)
        .sort((a, b) => a.price - b.price);

      const cheapestItem = originalSorted.length > 0 ? originalSorted[0] : null;

      if (cheapestItem && cheapestItem.price > remainingAmount) {
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
      // Réinitialiser la table
      await resetTable(tableId);

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

      return {
        success: true,
        newTotal: roundedNewTotal,
        updatedTable,
        paidItems: currentTable.order.items,
      };
    }
  } catch (error) {
    console.error('Erreur lors du traitement du paiement partiel:', error);
    return { success: false, error };
  }
};
