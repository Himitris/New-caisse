// utils/storage.ts - Persistance SQLite (expo-sqlite)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, ensureReady } from './db';
import { logger } from '@/utils/logger';

// Types (inchangés)
export interface Table {
  id: number;
  name: string;
  section: string;
  status: 'available' | 'occupied' | 'reserved';
  seats: number;
  guests?: number;
  order?: Order;
}

export interface OrderItem {
  id: number;
  menuId?: number;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  offered?: boolean;
  type?: 'resto' | 'boisson';
}

export interface Order {
  id: number;
  items: OrderItem[];
  guests: number;
  status: 'active' | 'completed';
  timestamp: string;
  total: number;
}

export interface Bill {
  id: number;
  tableNumber: number;
  amount: number;
  items: number;
  status: 'pending' | 'paid' | 'split';
  timestamp: string;
  tableName?: string;
  section?: string;
  paymentMethod?: 'card' | 'cash' | 'check';
  paymentType?: 'full' | 'split' | 'custom' | 'items';
  paidItems?: any[];
  offeredAmount?: number;
  guests?: number;
}

export interface MenuItemAvailability {
  id: number;
  available: boolean;
  name: string;
  price: number;
}

export interface CustomMenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  type: 'resto' | 'boisson';
  available: boolean;
}

// Constantes
export const TABLE_SECTIONS = {
  EAU: 'Eau',
  BUIS: 'Buis',
} as const;

const MAX_BILLS = 1000;
const MAX_BILLS_KEEP = 800;

const calculateTotal = (items: OrderItem[]): number =>
  items.reduce((sum, item) => (item.offered ? sum : sum + item.price * item.quantity), 0);

// ---------------------------------------------------------------------------
// Row <-> modèle
// ---------------------------------------------------------------------------

type TableRow = {
  id: number;
  name: string;
  section: string;
  status: Table['status'];
  seats: number;
  guests: number | null;
};

type OrderRow = {
  id: number;
  table_id: number;
  guests: number;
  status: Order['status'];
  timestamp: string;
};

type OrderItemRow = {
  order_id: number;
  item_id: number;
  menu_id: number | null;
  name: string;
  price: number;
  quantity: number;
  offered: number | null;
  type: OrderItem['type'] | null;
  notes: string | null;
};

const rowToOrderItem = (row: OrderItemRow): OrderItem => ({
  id: row.item_id,
  menuId: row.menu_id ?? undefined,
  name: row.name,
  price: row.price,
  quantity: row.quantity,
  notes: row.notes ?? undefined,
  offered: !!row.offered,
  type: row.type ?? undefined,
});

const assembleTable = (
  tableRow: TableRow,
  orderRow: OrderRow | undefined,
  itemRows: OrderItemRow[]
): Table => {
  const table: Table = {
    id: tableRow.id,
    name: tableRow.name,
    section: tableRow.section,
    status: tableRow.status,
    seats: tableRow.seats,
    guests: tableRow.guests ?? undefined,
  };

  if (orderRow) {
    const items = itemRows.filter((i) => i.order_id === orderRow.id).map(rowToOrderItem);
    table.order = {
      id: orderRow.id,
      items,
      guests: orderRow.guests,
      status: orderRow.status,
      timestamp: orderRow.timestamp,
      total: calculateTotal(items),
    };
  }

  return table;
};

// Applique la table (y compris son order) en base. Doit être appelé dans une transaction.
const upsertTableTx = async (table: Table): Promise<void> => {
  await db.runAsync(
    `UPDATE tables SET name = ?, section = ?, status = ?, seats = ?, guests = ? WHERE id = ?`,
    [table.name, table.section, table.status, table.seats, table.guests ?? null, table.id]
  );

  await db.runAsync(`DELETE FROM orders WHERE table_id = ?`, [table.id]);

  if (table.order) {
    const order = table.order;
    await db.runAsync(
      `INSERT INTO orders (id, table_id, guests, status, timestamp) VALUES (?, ?, ?, ?, ?)`,
      [order.id, table.id, order.guests, order.status, order.timestamp]
    );

    for (const item of order.items) {
      await db.runAsync(
        `INSERT INTO order_items (order_id, item_id, menu_id, name, price, quantity, offered, type, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order.id,
          item.id,
          item.menuId ?? null,
          item.name,
          item.price,
          item.quantity,
          item.offered ? 1 : 0,
          item.type ?? null,
          item.notes ?? null,
        ]
      );
    }
  }
};

// Tables par défaut
export const defaultTables: Table[] = [
  // Tables EAU
  { id: 1, name: 'Doc 1', section: TABLE_SECTIONS.EAU, status: 'available', seats: 4 },
  { id: 2, name: 'Doc 2', section: TABLE_SECTIONS.EAU, status: 'available', seats: 4 },
  { id: 3, name: 'Doc 3', section: TABLE_SECTIONS.EAU, status: 'available', seats: 4 },
  { id: 4, name: 'R1', section: TABLE_SECTIONS.EAU, status: 'available', seats: 2 },
  { id: 5, name: 'R2', section: TABLE_SECTIONS.EAU, status: 'available', seats: 2 },
  { id: 6, name: 'R3', section: TABLE_SECTIONS.EAU, status: 'available', seats: 2 },
  { id: 7, name: 'R4', section: TABLE_SECTIONS.EAU, status: 'available', seats: 2 },
  { id: 8, name: 'R5', section: TABLE_SECTIONS.EAU, status: 'available', seats: 2 },
  { id: 9, name: 'Poteau 1', section: TABLE_SECTIONS.EAU, status: 'available', seats: 4 },
  { id: 10, name: 'Poteau 2', section: TABLE_SECTIONS.EAU, status: 'available', seats: 4 },
  { id: 11, name: 'Ext 1', section: TABLE_SECTIONS.EAU, status: 'available', seats: 4 },
  { id: 12, name: 'Ext 2', section: TABLE_SECTIONS.EAU, status: 'available', seats: 4 },

  // Tables BUIS
  { id: 13, name: 'Bas 0', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 14, name: 'Bas 1', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 15, name: 'Arbre 1', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 16, name: 'Arbre 2', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 17, name: 'Tronc', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 2 },
  { id: 18, name: 'Caillou 1', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 2 },
  { id: 19, name: 'Caillou 2', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 2 },
  { id: 20, name: 'Escalier 1', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 21, name: 'Escalier 2', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 22, name: 'Escalier 3', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 23, name: 'Transfo', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 6 },
  { id: 24, name: 'Bache 1', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 25, name: 'Bache 2', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 26, name: 'Bache 3', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 27, name: 'Che', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 28, name: 'Che 8', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 29, name: 'Che 8bis', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 30, name: 'PDC 1', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 31, name: 'PDC 2', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 32, name: 'Eve Rgb', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 6 },
  { id: 33, name: 'Eve Bois', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 6 },
  { id: 34, name: 'BDM 1', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 35, name: 'BDM 2', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 36, name: 'BDM 3', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 37, name: 'BDF 1', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 38, name: 'BDF 2', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 39, name: 'BDF 3', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 40, name: 'HDB', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 41, name: 'Route 1', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 42, name: 'Route 2', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 4 },
  { id: 43, name: 'Sous Cabane', section: TABLE_SECTIONS.BUIS, status: 'available', seats: 6 },
];

// TABLES
export const initializeTables = async (): Promise<void> => {
  await ensureReady();
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM tables`);
  if (!row || row.count === 0) {
    await db.withTransactionAsync(async () => {
      for (const table of defaultTables) {
        await db.runAsync(
          `INSERT OR REPLACE INTO tables (id, name, section, status, seats, guests) VALUES (?, ?, ?, ?, ?, ?)`,
          [table.id, table.name, table.section, table.status, table.seats, table.guests ?? null]
        );
      }
    });
  }
};

export const getTables = async (): Promise<Table[]> => {
  await ensureReady();
  const tableRows = await db.getAllAsync<TableRow>(`SELECT * FROM tables ORDER BY id ASC`);
  if (tableRows.length === 0) return defaultTables;

  const orderRows = await db.getAllAsync<OrderRow>(`SELECT * FROM orders`);
  const itemRows = await db.getAllAsync<OrderItemRow>(`SELECT * FROM order_items`);

  const orderByTableId = new Map(orderRows.map((o) => [o.table_id, o]));

  return tableRows.map((t) => assembleTable(t, orderByTableId.get(t.id), itemRows));
};

export const getTable = async (id: number): Promise<Table | null> => {
  await ensureReady();
  const tableRow = await db.getFirstAsync<TableRow>(`SELECT * FROM tables WHERE id = ?`, [id]);
  if (!tableRow) return null;

  const orderRow = await db.getFirstAsync<OrderRow>(`SELECT * FROM orders WHERE table_id = ?`, [id]);
  const itemRows = orderRow
    ? await db.getAllAsync<OrderItemRow>(`SELECT * FROM order_items WHERE order_id = ?`, [orderRow.id])
    : [];

  return assembleTable(tableRow, orderRow ?? undefined, itemRows);
};

export const updateTable = async (updatedTable: Table): Promise<void> => {
  await ensureReady();
  await db.withTransactionAsync(async () => {
    await upsertTableTx(updatedTable);
  });
};

export const resetTable = async (tableId: number): Promise<void> => {
  await ensureReady();
  const defaultTable = defaultTables.find((t) => t.id === tableId);
  if (!defaultTable) return;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE tables SET status = ?, seats = ?, guests = NULL WHERE id = ?`,
      [defaultTable.status, defaultTable.seats, tableId]
    );
    await db.runAsync(`DELETE FROM orders WHERE table_id = ?`, [tableId]);
  });
};

export const resetAllTables = async (): Promise<void> => {
  await ensureReady();
  await db.withTransactionAsync(async () => {
    for (const defaultTable of defaultTables) {
      await db.runAsync(
        `UPDATE tables SET status = ?, seats = ?, guests = NULL WHERE id = ?`,
        [defaultTable.status, defaultTable.seats, defaultTable.id]
      );
    }
    await db.runAsync(`DELETE FROM orders`);
  });
};

export const saveTables = async (tables: Table[]): Promise<void> => {
  await ensureReady();
  await db.withTransactionAsync(async () => {
    for (const table of tables) {
      await upsertTableTx(table);
    }
  });
};

// ---------------------------------------------------------------------------
// BILLS
// ---------------------------------------------------------------------------

type BillRow = {
  id: number;
  table_number: number;
  amount: number;
  items: number | null;
  status: Bill['status'] | null;
  timestamp: string;
  table_name: string | null;
  section: string | null;
  payment_method: Bill['paymentMethod'] | null;
  payment_type: Bill['paymentType'] | null;
  paid_items: string | null;
  offered_amount: number | null;
  guests: number | null;
};

const rowToBill = (row: BillRow): Bill => ({
  id: row.id,
  tableNumber: row.table_number,
  amount: row.amount,
  items: row.items ?? 0,
  status: row.status ?? 'pending',
  timestamp: row.timestamp,
  tableName: row.table_name ?? undefined,
  section: row.section ?? undefined,
  paymentMethod: row.payment_method ?? undefined,
  paymentType: row.payment_type ?? undefined,
  paidItems: row.paid_items ? JSON.parse(row.paid_items) : undefined,
  offeredAmount: row.offered_amount ?? undefined,
  guests: row.guests ?? undefined,
});

const insertBillTx = async (bill: Bill): Promise<void> => {
  await db.runAsync(
    `INSERT OR REPLACE INTO bills
      (id, table_number, amount, items, status, timestamp, table_name, section, payment_method, payment_type, paid_items, offered_amount, guests)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      bill.id,
      bill.tableNumber,
      bill.amount,
      bill.items ?? null,
      bill.status ?? null,
      bill.timestamp,
      bill.tableName ?? null,
      bill.section ?? null,
      bill.paymentMethod ?? null,
      bill.paymentType ?? null,
      bill.paidItems ? JSON.stringify(bill.paidItems) : null,
      bill.offeredAmount ?? null,
      bill.guests ?? null,
    ]
  );
};

export const getBills = async (): Promise<Bill[]> => {
  await ensureReady();
  try {
    const rows = await db.getAllAsync<BillRow>(`SELECT * FROM bills ORDER BY timestamp DESC`);
    return rows.map(rowToBill);
  } catch (error) {
    logger.error('Error loading bills:', error);
    return [];
  }
};

export const getBillsCount = async (): Promise<number> => {
  await ensureReady();
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM bills`);
  return row?.count ?? 0;
};

export const addBill = async (bill: Bill): Promise<void> => {
  await ensureReady();
  try {
    await db.withTransactionAsync(async () => {
      await insertBillTx(bill);

      const countRow = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM bills`);
      const count = countRow?.count ?? 0;

      if (count > MAX_BILLS) {
        const toDelete = count - MAX_BILLS_KEEP;
        await db.runAsync(
          `DELETE FROM bills WHERE id IN (SELECT id FROM bills ORDER BY timestamp ASC LIMIT ?)`,
          [toDelete]
        );
      }
    });
  } catch (error) {
    logger.error('Error adding bill:', error);
    throw error;
  }
};

export const saveBills = async (bills: Bill[]): Promise<void> => {
  await ensureReady();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM bills`);
    for (const bill of bills) {
      await insertBillTx(bill);
    }
  });
};

// Maintenance incrémentale : ne revalide que les factures insérées depuis le
// dernier passage (via le rowid SQLite, monotone à l'insertion), au lieu de
// rebalayer toute la table à chaque appel.
const MAINTENANCE_WATERMARK_KEY = 'manjo_carn_bills_maintenance_watermark';

export const performBillsMaintenance = async (): Promise<void> => {
  await ensureReady();
  try {
    const stored = await AsyncStorage.getItem(MAINTENANCE_WATERMARK_KEY);
    const lastRowId = stored ? parseInt(stored, 10) : 0;

    await db.runAsync(
      `DELETE FROM bills WHERE rowid > ? AND (table_number IS NULL OR amount IS NULL OR timestamp IS NULL)`,
      [lastRowId]
    );

    const maxRow = await db.getFirstAsync<{ maxRowId: number | null }>(
      `SELECT MAX(rowid) as maxRowId FROM bills`
    );
    const newWatermark = maxRow?.maxRowId ?? lastRowId;

    await AsyncStorage.setItem(MAINTENANCE_WATERMARK_KEY, String(newWatermark));
  } catch (error) {
    logger.error('Erreur lors de la maintenance des factures:', error);
  }
};

// Pagination
export const getBillsPage = async (page: number = 0, pageSize: number = 20) => {
  await ensureReady();

  const totalRow = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM bills`);
  const total = totalRow?.count ?? 0;

  const rows = await db.getAllAsync<BillRow>(
    `SELECT * FROM bills ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    [pageSize, page * pageSize]
  );

  const bills = rows.map(rowToBill);
  const end = page * pageSize + bills.length;

  return {
    bills,
    total,
    hasMore: end < total,
  };
};

type BillFilters = {
  searchText?: string;
  dateRange?: { start: Date; end: Date };
  paymentMethod?: string;
};

const buildBillFilterClause = (filters: BillFilters): { where: string; params: any[] } => {
  const clauses: string[] = [];
  const params: any[] = [];

  if (filters.dateRange) {
    clauses.push(`timestamp >= ? AND timestamp <= ?`);
    params.push(filters.dateRange.start.toISOString(), filters.dateRange.end.toISOString());
  }

  if (filters.paymentMethod) {
    clauses.push(`payment_method = ?`);
    params.push(filters.paymentMethod);
  }

  if (filters.searchText) {
    clauses.push(
      `(LOWER(COALESCE(table_name, 'Table ' || table_number)) LIKE ? OR CAST(amount AS TEXT) LIKE ?)`
    );
    const search = `%${filters.searchText.toLowerCase()}%`;
    params.push(search, search);
  }

  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
};

// Filtrage
export const getFilteredBills = async (filters: BillFilters): Promise<Bill[]> => {
  await ensureReady();
  const { where, params } = buildBillFilterClause(filters);
  const rows = await db.getAllAsync<BillRow>(
    `SELECT * FROM bills ${where} ORDER BY timestamp DESC`,
    params
  );
  return rows.map(rowToBill);
};

// Statistiques
export const getBillsStatistics = async () => {
  await ensureReady();

  const totalRow = await db.getFirstAsync<{ count: number; total: number | null }>(
    `SELECT COUNT(*) as count, SUM(amount) as total FROM bills`
  );
  const totalBills = totalRow?.count ?? 0;

  if (totalBills === 0) {
    return {
      totalBills: 0,
      totalAmount: 0,
      averageAmount: 0,
      billsToday: 0,
      billsThisWeek: 0,
      billsThisMonth: 0,
    };
  }

  const totalAmount = totalRow?.total ?? 0;

  const boundsRow = await db.getFirstAsync<{ oldest: string; newest: string }>(
    `SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest FROM bills`
  );

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const countSince = async (date: Date) => {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM bills WHERE timestamp >= ?`,
      [date.toISOString()]
    );
    return row?.count ?? 0;
  };

  return {
    totalBills,
    totalAmount,
    averageAmount: totalAmount / totalBills,
    oldestBill: boundsRow?.oldest,
    newestBill: boundsRow?.newest,
    billsToday: await countSince(today),
    billsThisWeek: await countSince(weekAgo),
    billsThisMonth: await countSince(monthAgo),
  };
};

// ---------------------------------------------------------------------------
// MENU
// ---------------------------------------------------------------------------

type MenuAvailabilityRow = { id: number; available: number; name: string; price: number };
type CustomMenuItemRow = {
  id: number;
  name: string;
  price: number;
  category: string | null;
  type: CustomMenuItem['type'] | null;
  available: number;
};

export const getMenuAvailability = async (): Promise<MenuItemAvailability[]> => {
  await ensureReady();
  const rows = await db.getAllAsync<MenuAvailabilityRow>(`SELECT * FROM menu_availability`);
  return rows.map((r) => ({ id: r.id, available: !!r.available, name: r.name, price: r.price }));
};

export const saveMenuAvailability = async (items: MenuItemAvailability[]): Promise<void> => {
  await ensureReady();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM menu_availability`);
    for (const item of items) {
      await db.runAsync(
        `INSERT INTO menu_availability (id, available, name, price) VALUES (?, ?, ?, ?)`,
        [item.id, item.available ? 1 : 0, item.name, item.price]
      );
    }
  });
};

export const getCustomMenuItems = async (): Promise<CustomMenuItem[]> => {
  await ensureReady();
  const rows = await db.getAllAsync<CustomMenuItemRow>(`SELECT * FROM custom_menu_items`);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    price: r.price,
    category: r.category ?? '',
    type: r.type ?? 'resto',
    available: !!r.available,
  }));
};

export const saveCustomMenuItems = async (items: CustomMenuItem[]): Promise<void> => {
  await ensureReady();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM custom_menu_items`);
    for (const item of items) {
      await db.runAsync(
        `INSERT INTO custom_menu_items (id, name, price, category, type, available) VALUES (?, ?, ?, ?, ?, ?)`,
        [item.id, item.name, item.price, item.category, item.type, item.available ? 1 : 0]
      );
    }
  });
};

export const addCustomMenuItem = async (item: CustomMenuItem): Promise<void> => {
  await ensureReady();
  await db.runAsync(
    `INSERT INTO custom_menu_items (id, name, price, category, type, available) VALUES (?, ?, ?, ?, ?, ?)`,
    [item.id, item.name, item.price, item.category, item.type, item.available ? 1 : 0]
  );
};

export const updateCustomMenuItem = async (updatedItem: CustomMenuItem): Promise<void> => {
  await ensureReady();
  await db.runAsync(
    `UPDATE custom_menu_items SET name = ?, price = ?, category = ?, type = ?, available = ? WHERE id = ?`,
    [updatedItem.name, updatedItem.price, updatedItem.category, updatedItem.type, updatedItem.available ? 1 : 0, updatedItem.id]
  );
};

export const deleteCustomMenuItem = async (itemId: number): Promise<void> => {
  await ensureReady();
  await db.runAsync(`DELETE FROM custom_menu_items WHERE id = ?`, [itemId]);
};

// ---------------------------------------------------------------------------
// Classes de compatibilité
// ---------------------------------------------------------------------------

export class StorageManager {
  static async isFirstLaunch(): Promise<boolean> {
    const value = await AsyncStorage.getItem('manjo_carn_first_launch');
    return value === null;
  }

  static async markAppLaunched(): Promise<void> {
    await AsyncStorage.setItem('manjo_carn_first_launch', 'false');
  }

  static async performMaintenance(): Promise<void> {
    await performBillsMaintenance();
  }

  static async resetApplicationData(): Promise<void> {
    try {
      await saveMenuAvailability([]);
      await resetAllTables();
    } catch (error) {
      logger.error('Error resetting application data:', error);
    }
  }

  static async getStorageStats() {
    const bills = await getBills();

    let health: 'excellent' | 'good' | 'growing' = 'excellent';
    if (bills.length > 1000) health = 'good';
    if (bills.length > 5000) health = 'growing';

    return {
      billsCount: bills.length,
      lastAccess: new Date().toISOString(),
      storageHealth: health,
      protectionStatus: 'active',
    };
  }
}

export class TableManager {
  static async getTables(): Promise<Table[]> {
    return getTables();
  }

  static async saveTables(tables: Table[]): Promise<void> {
    await saveTables(tables);
  }

  static async cleanupOrphanedTableData(): Promise<void> {
    // Fonction vide maintenue pour compatibilité
  }
}

export class BillManager {
  static async getBillsStatistics() {
    return getBillsStatistics();
  }

  static async getProtectionStatus() {
    const bills = await getBills();
    return {
      totalBills: bills.length,
      protectionActive: true,
      message: `${bills.length} factures protégées`,
    };
  }

  static async validateBillsIntegrity() {
    const bills = await getBills();
    const issues: string[] = [];

    let validCount = 0;
    bills.forEach((bill, index) => {
      if (!bill.id) issues.push(`Facture ${index}: ID manquant`);
      if (!bill.tableNumber) issues.push(`Facture ${index}: numéro de table manquant`);
      if (bill.amount === undefined) issues.push(`Facture ${index}: montant manquant`);
      if (!bill.timestamp) issues.push(`Facture ${index}: timestamp manquant`);

      if (bill.id && bill.tableNumber && bill.amount !== undefined && bill.timestamp) {
        validCount++;
      }
    });

    return {
      totalBills: bills.length,
      validBills: validCount,
      issues,
    };
  }

  static async clearAllBills(): Promise<void> {
    await ensureReady();
    try {
      await db.runAsync(`DELETE FROM bills`);
    } catch (error) {
      logger.error('Erreur lors de la suppression de toutes les factures:', error);
      throw error;
    }
  }

  static async deleteBills(billsToDelete: number[]): Promise<void> {
    await ensureReady();
    try {
      await db.withTransactionAsync(async () => {
        for (const id of billsToDelete) {
          await db.runAsync(`DELETE FROM bills WHERE id = ?`, [id]);
        }
      });
    } catch (error) {
      logger.error('Erreur lors de la suppression des factures spécifiques:', error);
      throw error;
    }
  }

  static async clearFilteredBills(filters: BillFilters): Promise<number> {
    await ensureReady();
    try {
      const { where, params } = buildBillFilterClause(filters);
      const countRow = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM bills ${where}`,
        params
      );
      const count = countRow?.count ?? 0;
      await db.runAsync(`DELETE FROM bills ${where}`, params);
      return count;
    } catch (error) {
      logger.error('Erreur lors de la suppression des factures filtrées:', error);
      throw error;
    }
  }
}
