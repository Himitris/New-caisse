// utils/payment-utils.ts

import { getTable, updateTable, resetTable, Table, OrderItem } from './storage';

/**
 * Fonction optimisée pour traiter un paiement partiel
 * Conserve exactement la même logique métier mais avec des performances améliorées
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

    // Créer une copie des articles (plus efficace que le spread operator)
    const newItems = currentTable.order.items.slice();

    // Trier une seule fois par prix croissant
    newItems.sort((a, b) => a.price - b.price);

    let remainingAmount = amountToPay;
    let i = 0;

    // Boucle principale pour le paiement des articles
    while (i < newItems.length && remainingAmount > 0) {
      const item = newItems[i];

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

    // Gestion optimisée du "reste"
    if (remainingAmount > 0.01) {
      // Recherche efficace d'un "Reste" existant
      let resteIndex = -1;
      for (let j = 0; j < newItems.length; j++) {
        if (newItems[j].name.startsWith('Reste de')) {
          resteIndex = j;
          break;
        }
      }

      if (resteIndex >= 0) {
        // Ajouter au "Reste" existant
        newItems[resteIndex].price -= remainingAmount;
      } else {
        // Chercher l'article le moins cher (déjà trié)
        // Utiliser une copie triée originale pour avoir l'article le moins cher initial
        const originalSorted = [...currentTable.order.items].sort(
          (a, b) => a.price - b.price
        );
        const cheapestItem =
          originalSorted.length > 0 ? originalSorted[0] : null;

        if (cheapestItem && cheapestItem.price > remainingAmount) {
          // Si l'article le moins cher coûte plus que ce qu'il nous reste à payer
          const itemIndex = newItems.findIndex(
            (item) => item.id === cheapestItem.id
          );

          if (itemIndex >= 0 && newItems[itemIndex].quantity > 0) {
            // Diminuer sa quantité de 1
            newItems[itemIndex].quantity -= 1;

            // Créer un nouvel article "Reste" pour la différence
            const resteAmount = cheapestItem.price - remainingAmount;
            newItems.push({
              id: Date.now() + Math.random(),
              name: `Reste de ${cheapestItem.name}`,
              price: resteAmount,
              quantity: 1,
            });
          } else {
            // Cas où l'article le moins cher n'est plus disponible
            newItems.push({
              id: Date.now() + Math.random(),
              name: `Reste partiel`,
              price: remainingAmount,
              quantity: 1,
            });
          }
        } else {
          // Si nous n'avons pas trouvé d'article approprié
          newItems.push({
            id: Date.now() + Math.random(),
            name: `Reste partiel`,
            price: remainingAmount,
            quantity: 1,
          });
        }
      }
    }

    // Calcul optimisé du nouveau total
    const newTotal = newItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // Effectuer la mise à jour une seule fois
    const updatedTable = {
      ...currentTable,
      order: {
        ...currentTable.order,
        total: newTotal,
        items: newItems,
      },
    };

    await updateTable(updatedTable);

    return {
      success: true,
      newTotal,
      updatedTable,
      paidItems: currentTable.order.items, // Pour garder une référence aux articles payés
    };
  } catch (error) {
    console.error('Erreur lors du traitement du paiement partiel:', error);
    return { success: false, error };
  } finally {
    if (setProcessing) setProcessing(false);
  }
};
