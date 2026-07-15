// utils/db.ts - Connexion SQLite (expo-sqlite) + versionnage de schéma (PRAGMA user_version)

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('manjo_carn.db');

// Pragmas de connexion : à réappliquer à chaque ouverture (foreign_keys n'est pas persisté par SQLite).
db.execSync(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

// ---------------------------------------------------------------------------
// Migrations de schéma, appliquées séquentiellement selon PRAGMA user_version.
// Chaque entrée décrit le passage de (version - 1) -> version.
// ---------------------------------------------------------------------------

type Migration = {
  version: number;
  migrate: () => Promise<void>;
};

const OLD_ASYNC_STORAGE_KEYS = {
  TABLES: 'manjo_carn_tables',
  BILLS: 'manjo_carn_bills',
  CUSTOM_MENU_ITEMS: 'manjo_carn_custom_menu_items',
  MENU_AVAILABILITY: 'manjo_carn_menu_availability',
} as const;

async function loadOldJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// v0 -> v1 : création du schéma initial + reprise des données AsyncStorage historiques.
const migrateV0ToV1 = async (): Promise<void> => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      section TEXT NOT NULL,
      status TEXT NOT NULL,
      seats INTEGER NOT NULL,
      guests INTEGER
    );

    CREATE TABLE IF NOT EXISTS orders (
      id REAL PRIMARY KEY,
      table_id INTEGER NOT NULL,
      guests INTEGER NOT NULL,
      status TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);

    CREATE TABLE IF NOT EXISTS order_items (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id REAL NOT NULL,
      item_id REAL NOT NULL,
      menu_id INTEGER,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      offered INTEGER,
      type TEXT,
      notes TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

    CREATE TABLE IF NOT EXISTS bills (
      id REAL PRIMARY KEY,
      table_number INTEGER NOT NULL,
      amount REAL NOT NULL,
      items INTEGER,
      status TEXT,
      timestamp TEXT NOT NULL,
      table_name TEXT,
      section TEXT,
      payment_method TEXT,
      payment_type TEXT,
      paid_items TEXT,
      offered_amount REAL,
      guests INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_bills_timestamp ON bills(timestamp);

    CREATE TABLE IF NOT EXISTS menu_availability (
      id INTEGER PRIMARY KEY,
      available INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custom_menu_items (
      id REAL PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT,
      type TEXT,
      available INTEGER
    );
  `);

  const [oldTables, oldBills, oldCustomMenuItems, oldMenuAvailability] = await Promise.all([
    loadOldJson<any[]>(OLD_ASYNC_STORAGE_KEYS.TABLES, []),
    loadOldJson<any[]>(OLD_ASYNC_STORAGE_KEYS.BILLS, []),
    loadOldJson<any[]>(OLD_ASYNC_STORAGE_KEYS.CUSTOM_MENU_ITEMS, []),
    loadOldJson<any[]>(OLD_ASYNC_STORAGE_KEYS.MENU_AVAILABILITY, []),
  ]);

  for (const t of oldTables) {
    await db.runAsync(
      `INSERT OR REPLACE INTO tables (id, name, section, status, seats, guests) VALUES (?, ?, ?, ?, ?, ?)`,
      [t.id, t.name, t.section, t.status, t.seats, t.guests ?? null]
    );

    if (t.order) {
      const o = t.order;
      await db.runAsync(
        `INSERT OR REPLACE INTO orders (id, table_id, guests, status, timestamp) VALUES (?, ?, ?, ?, ?)`,
        [o.id, t.id, o.guests, o.status, o.timestamp]
      );
      for (const item of o.items ?? []) {
        await db.runAsync(
          `INSERT INTO order_items (order_id, item_id, menu_id, name, price, quantity, offered, type, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            o.id,
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
  }

  for (const b of oldBills) {
    await db.runAsync(
      `INSERT OR REPLACE INTO bills
        (id, table_number, amount, items, status, timestamp, table_name, section, payment_method, payment_type, paid_items, offered_amount, guests)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.id,
        b.tableNumber,
        b.amount,
        b.items ?? null,
        b.status ?? null,
        b.timestamp,
        b.tableName ?? null,
        b.section ?? null,
        b.paymentMethod ?? null,
        b.paymentType ?? null,
        b.paidItems ? JSON.stringify(b.paidItems) : null,
        b.offeredAmount ?? null,
        b.guests ?? null,
      ]
    );
  }

  for (const m of oldMenuAvailability) {
    await db.runAsync(
      `INSERT OR REPLACE INTO menu_availability (id, available, name, price) VALUES (?, ?, ?, ?)`,
      [m.id, m.available ? 1 : 0, m.name, m.price]
    );
  }

  for (const c of oldCustomMenuItems) {
    await db.runAsync(
      `INSERT OR REPLACE INTO custom_menu_items (id, name, price, category, type, available) VALUES (?, ?, ?, ?, ?, ?)`,
      [c.id, c.name, c.price, c.category ?? null, c.type ?? null, c.available ? 1 : 0]
    );
  }
};

// v1 -> v2 : nouveau plan de salle (37 -> 43 tables, noms et découpage revus).
// On repart d'un plan propre plutôt que de renommer les lignes existantes une à
// une par id : les ids ne correspondent plus aux mêmes emplacements, et une
// commande en cours sur l'ancien plan n'a plus de sens après la bascule. Les
// factures déjà émises ne sont pas affectées (elles stockent leur propre copie
// du nom de table, indépendante de la table `tables`).
const NEW_DEFAULT_TABLES: Array<{
  id: number;
  name: string;
  section: string;
  seats: number;
}> = [
  { id: 1, name: 'Doc 1', section: 'Eau', seats: 4 },
  { id: 2, name: 'Doc 2', section: 'Eau', seats: 4 },
  { id: 3, name: 'Doc 3', section: 'Eau', seats: 4 },
  { id: 4, name: 'R1', section: 'Eau', seats: 2 },
  { id: 5, name: 'R2', section: 'Eau', seats: 2 },
  { id: 6, name: 'R3', section: 'Eau', seats: 2 },
  { id: 7, name: 'R4', section: 'Eau', seats: 2 },
  { id: 8, name: 'R5', section: 'Eau', seats: 2 },
  { id: 9, name: 'Poteau 1', section: 'Eau', seats: 4 },
  { id: 10, name: 'Poteau 2', section: 'Eau', seats: 4 },
  { id: 11, name: 'Ext 1', section: 'Eau', seats: 4 },
  { id: 12, name: 'Ext 2', section: 'Eau', seats: 4 },
  { id: 13, name: 'Bas 0', section: 'Buis', seats: 4 },
  { id: 14, name: 'Bas 1', section: 'Buis', seats: 4 },
  { id: 15, name: 'Arbre 1', section: 'Buis', seats: 4 },
  { id: 16, name: 'Arbre 2', section: 'Buis', seats: 4 },
  { id: 17, name: 'Tronc', section: 'Buis', seats: 2 },
  { id: 18, name: 'Caillou 1', section: 'Buis', seats: 2 },
  { id: 19, name: 'Caillou 2', section: 'Buis', seats: 2 },
  { id: 20, name: 'Escalier 1', section: 'Buis', seats: 4 },
  { id: 21, name: 'Escalier 2', section: 'Buis', seats: 4 },
  { id: 22, name: 'Escalier 3', section: 'Buis', seats: 4 },
  { id: 23, name: 'Transfo', section: 'Buis', seats: 6 },
  { id: 24, name: 'Bache 1', section: 'Buis', seats: 4 },
  { id: 25, name: 'Bache 2', section: 'Buis', seats: 4 },
  { id: 26, name: 'Bache 3', section: 'Buis', seats: 4 },
  { id: 27, name: 'Che', section: 'Buis', seats: 4 },
  { id: 28, name: 'Che 8', section: 'Buis', seats: 4 },
  { id: 29, name: 'Che 8bis', section: 'Buis', seats: 4 },
  { id: 30, name: 'PDC 1', section: 'Buis', seats: 4 },
  { id: 31, name: 'PDC 2', section: 'Buis', seats: 4 },
  { id: 32, name: 'Eve Rgb', section: 'Buis', seats: 6 },
  { id: 33, name: 'Eve Bois', section: 'Buis', seats: 6 },
  { id: 34, name: 'BDM 1', section: 'Buis', seats: 4 },
  { id: 35, name: 'BDM 2', section: 'Buis', seats: 4 },
  { id: 36, name: 'BDM 3', section: 'Buis', seats: 4 },
  { id: 37, name: 'BDF 1', section: 'Buis', seats: 4 },
  { id: 38, name: 'BDF 2', section: 'Buis', seats: 4 },
  { id: 39, name: 'BDF 3', section: 'Buis', seats: 4 },
  { id: 40, name: 'HDB', section: 'Buis', seats: 4 },
  { id: 41, name: 'Route 1', section: 'Buis', seats: 4 },
  { id: 42, name: 'Route 2', section: 'Buis', seats: 4 },
  { id: 43, name: 'Sous Cabane', section: 'Buis', seats: 6 },
];

const migrateV1ToV2 = async (): Promise<void> => {
  await db.execAsync(`DELETE FROM tables;`);

  for (const t of NEW_DEFAULT_TABLES) {
    await db.runAsync(
      `INSERT INTO tables (id, name, section, status, seats, guests) VALUES (?, ?, ?, 'available', ?, NULL)`,
      [t.id, t.name, t.section, t.seats]
    );
  }
};

// Ajouter ici les migrations futures, dans l'ordre croissant des versions, par ex. :
// { version: 3, migrate: async () => { await db.execAsync(`ALTER TABLE order_items ADD COLUMN course INTEGER;`); } }
const MIGRATIONS: Migration[] = [
  { version: 1, migrate: migrateV0ToV1 },
  { version: 2, migrate: migrateV1ToV2 },
];

const getSchemaVersion = async (): Promise<number> => {
  const row = await db.getFirstAsync<{ user_version: number }>(`PRAGMA user_version`);
  return row?.user_version ?? 0;
};

const setSchemaVersion = async (version: number): Promise<void> => {
  // PRAGMA n'accepte pas les paramètres liés (?) ; `version` est un entier interne, jamais une entrée utilisateur.
  await db.execAsync(`PRAGMA user_version = ${version}`);
};

async function runMigrations(): Promise<void> {
  let currentVersion = await getSchemaVersion();

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version
  );

  for (const migration of pending) {
    try {
      await db.withTransactionAsync(async () => {
        await migration.migrate();
        await setSchemaVersion(migration.version);
      });
      currentVersion = migration.version;
    } catch (error) {
      // La transaction a été annulée (rollback) par expo-sqlite : la base reste au dernier état
      // stable connu (currentVersion), sans corruption. On arrête d'appliquer les migrations suivantes.
      console.error(
        `Échec de la migration du schéma vers la version ${migration.version}, rollback effectué:`,
        error
      );
      break;
    }
  }
}

let migrationPromise: Promise<void> | null = null;

export function ensureReady(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runMigrations();
  }
  return migrationPromise;
}
