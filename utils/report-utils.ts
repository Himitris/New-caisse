// utils/report-utils.ts
import { Bill } from './storage';

interface SalesByCategory {
  [key: string]: {
    count: number;
    total: number;
    items: {
      [key: string]: {
        count: number;
        total: number;
      };
    };
  };
}

interface ZReportData {
  totalSales: number;
  totalItems: number;
  totalTransactions: number;
  averageTicket: number;
  salesByMethod: Record<string, number>;
  salesByType: Record<string, number>;
  salesBySection: Record<string, number>;
  salesByCategory: SalesByCategory;
  offeredTotal: number;
  startTime: Date | null;
  endTime: Date | null;
  dateRange: string;
}

/**
 * Génère les données de rapport Z à partir d'une liste de factures
 */
export const generateZReportData = (bills: Bill[]): ZReportData => {
  // Valeurs par défaut
  const report: ZReportData = {
    totalSales: 0,
    totalItems: 0,
    totalTransactions: bills.length,
    averageTicket: 0,
    salesByMethod: {},
    salesByType: {},
    salesBySection: {},
    salesByCategory: {},
    offeredTotal: 0,
    startTime: bills.length > 0 ? new Date(bills[0].timestamp) : null,
    endTime: bills.length > 0 ? new Date(bills[0].timestamp) : null,
    dateRange: '',
  };

  // Aucune facture
  if (bills.length === 0) {
    return report;
  }

  // Tri chronologique pour déterminer première et dernière vente
  const sortedBills = [...bills].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  report.startTime = new Date(sortedBills[0].timestamp);
  report.endTime = new Date(sortedBills[sortedBills.length - 1].timestamp);

  // Format pour l'affichage de la plage horaire
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  report.dateRange = `${formatTime(report.startTime)} - ${formatTime(
    report.endTime
  )}`;

  // Calculer les stats
  bills.forEach((bill) => {
    // Total des ventes
    report.totalSales += bill.amount;

    // Total des articles
    report.totalItems += typeof bill.items === 'number' ? bill.items : 0;

    // Ventes par méthode de paiement
    const method = bill.paymentMethod || 'inconnu';
    report.salesByMethod[method] =
      (report.salesByMethod[method] || 0) + bill.amount;

    // Ventes par type de paiement
    const type = bill.paymentType || 'inconnu';
    report.salesByType[type] = (report.salesByType[type] || 0) + bill.amount;

    // Ventes par section
    const section = bill.section || 'inconnu';
    report.salesBySection[section] =
      (report.salesBySection[section] || 0) + bill.amount;

    // Total des articles offerts
    report.offeredTotal += bill.offeredAmount || 0;

    // Analyse des articles par catégorie si disponible
    if (bill.paidItems && bill.paidItems.length > 0) {
      bill.paidItems.forEach((item) => {
        // Déterminer la catégorie en fonction du nom ou d'autres propriétés
        const category = getCategoryFromName(item.name);

        // Initialiser la catégorie si elle n'existe pas
        if (!report.salesByCategory[category]) {
          report.salesByCategory[category] = {
            count: 0,
            total: 0,
            items: {},
          };
        }

        // Ajouter les statistiques pour cette catégorie
        const itemTotal = item.price * item.quantity;
        report.salesByCategory[category].count += item.quantity;

        // Ne pas compter dans le total si offert
        if (!item.offered) {
          report.salesByCategory[category].total += itemTotal;
        }

        // Initialiser l'article dans la catégorie s'il n'existe pas
        if (!report.salesByCategory[category].items[item.name]) {
          report.salesByCategory[category].items[item.name] = {
            count: 0,
            total: 0,
          };
        }

        // Ajouter les statistiques pour cet article
        report.salesByCategory[category].items[item.name].count +=
          item.quantity;

        // Ne pas compter dans le total si offert
        if (!item.offered) {
          report.salesByCategory[category].items[item.name].total += itemTotal;
        }
      });
    }
  });

  // Calcul du ticket moyen
  report.averageTicket = report.totalSales / report.totalTransactions;

  return report;
};

/**
 * Fonction utilitaire pour catégoriser les articles
 */
const getCategoryFromName = (name: string): string => {
  const lowerName = name.toLowerCase();

  // Déterminer la catégorie en fonction du nom
  if (lowerName.includes('salade')) return 'Salades';
  if (lowerName.includes('dessert')) return 'Desserts';
  if (lowerName.includes('frites')) return 'Accompagnements';
  if (lowerName.includes('menu enfant')) return 'Menu Enfant';
  if (lowerName.includes('maxi')) return 'Plats Maxi';

  // Boissons
  if (lowerName.includes('glace')) return 'Glaces';
  if (lowerName.includes('thé') || lowerName.includes('café'))
    return 'Boissons Chaudes';
  if (
    lowerName.includes('bière') ||
    lowerName.includes('blonde') ||
    lowerName.includes('ambree')
  )
    return 'Bières';
  if (lowerName.includes('vin') || lowerName.includes('pichet')) return 'Vins';
  if (
    lowerName.includes('apero') ||
    lowerName.includes('ricard') ||
    lowerName.includes('alcool')
  )
    return 'Alcools';
  if (lowerName.includes('boisson') || lowerName.includes('soft'))
    return 'Softs';

  // Catégorie par défaut
  return 'Plats Principaux';
};

export const formatMoney = (amount: number): string => {
  return amount.toFixed(2) + ' €';
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const getPaymentMethodLabel = (method: string): string => {
  switch (method) {
    case 'card':
      return 'Carte bancaire';
    case 'cash':
      return 'Espèces';
    case 'check':
      return 'Chèque';
    default:
      return 'Autre';
  }
};

export const getPaymentTypeLabel = (type: string): string => {
  switch (type) {
    case 'full':
      return 'Paiement complet';
    case 'split':
      return 'Partage équitable';
    case 'custom':
      return 'Partage personnalisé';
    case 'items':
      return 'Paiement par articles';
    default:
      return 'Autre';
  }
};
