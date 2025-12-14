// utils/DatabaseService.types.ts - Types partagés pour le service de base de données

// Types pour les factures (enregistrement DB)
export interface BillRecord {
  id: number;
  tableNumber: number;
  tableName: string | null;
  section: string | null;
  amount: number;
  items: number;
  status: 'pending' | 'paid' | 'split';
  timestamp: string;
  paymentMethod: string | null;
  paymentType: string | null;
  paidItems: string | null; // JSON string
  offeredAmount: number | null;
  guests: number | null;
}

// Interface compatible avec l'ancien système
export interface Bill {
  id: number;
  tableNumber: number;
  tableName?: string;
  section?: string;
  amount: number;
  items: number;
  status: 'pending' | 'paid' | 'split';
  timestamp: string;
  paymentMethod?: 'card' | 'cash' | 'check';
  paymentType?: 'full' | 'split' | 'custom' | 'items';
  paidItems?: any[];
  offeredAmount?: number;
  guests?: number;
}

// Statistiques
export interface BillsStatistics {
  totalBills: number;
  totalAmount: number;
  averageAmount: number;
  oldestBillTimestamp: string | null;
  newestBillTimestamp: string | null;
  billsToday: number;
  billsThisWeek: number;
  billsThisMonth: number;
  amountToday: number;
  amountThisWeek: number;
  amountThisMonth: number;
}

// Interface pour le backend de stockage
export interface StorageBackend {
  initialize(): Promise<void>;
  getAllBills(): Promise<Bill[]>;
  getTotalCount(): Promise<number>;
  getBillById(id: number): Promise<Bill | null>;
  getBillsPage(page: number, pageSize: number): Promise<{ bills: Bill[]; total: number; hasMore: boolean }>;
  getRecentBills(limit: number): Promise<Bill[]>;
  getFilteredBills(filters: {
    searchText?: string;
    date?: Date;
    dateRange?: { start: Date; end: Date };
    paymentMethod?: string;
    section?: string;
  }): Promise<Bill[]>;
  getBillsForDate(date: Date): Promise<Bill[]>;
  getStatistics(): Promise<BillsStatistics>;
  addBill(bill: Bill): Promise<void>;
  deleteBill(billId: number): Promise<void>;
  deleteBills(billIds: number[]): Promise<void>;
  clearAllBills(): Promise<void>;
  setBills(bills: Bill[]): Promise<void>;
  performMaintenance(maxBills: number): Promise<number>;
}
