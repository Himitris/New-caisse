// utils/storage.ts - Version optimisée avec compression et gestion intelligente de la mémoire

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { events, EVENT_TYPES } from './events';
import LZString from 'lz-string';

// Types d'entités
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
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  offered?: boolean; 
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
  paidItems?: {
    id: number;
    name: string;
    price: number;
    quantity: number;
    notes?: string;
    offered?: boolean;
    paymentPercentage?: number; // Pour les paiements partagés
    customAmount?: number; // Pour les paiements personnalisés
    splitPart?: number; // Pour les paiements divisés
    totalParts?: number; // Pour les paiements divisés
  }[];
  offeredAmount?: number; // Montant total des articles offerts dans cette facture
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

// Constantes optimisées
export const TABLE_SECTIONS = {
  EAU: 'Eau',
  BUIS: 'Buis',
} as const;

// Clés pour AsyncStorage avec versioning
const STORAGE_PREFIX = 'manjo_carn_';
const STORAGE_VERSION = 'v4'; // Incrémenté pour la nouvelle version optimisée

export const STORAGE_KEYS = {
  TABLES: `${STORAGE_PREFIX}tables_${STORAGE_VERSION}`,
  BILLS: `${STORAGE_PREFIX}bills_${STORAGE_VERSION}`,
  BILLS_ARCHIVE: `${STORAGE_PREFIX}bills_archive_${STORAGE_VERSION}`,
  MENU_AVAILABILITY: `${STORAGE_PREFIX}menu_availability_${STORAGE_VERSION}`,
  FIRST_LAUNCH: `${STORAGE_PREFIX}first_launch_${STORAGE_VERSION}`,
  APP_VERSION: `${STORAGE_PREFIX}app_version_${STORAGE_VERSION}`,
  LAST_SYNC: `${STORAGE_PREFIX}last_sync_${STORAGE_VERSION}`,
  CUSTOM_MENU_ITEMS: `${STORAGE_PREFIX}custom_menu_items_${STORAGE_VERSION}`,
  SETTINGS_STORAGE_KEY: `${STORAGE_PREFIX}restaurant_settings_${STORAGE_VERSION}`,
  CACHE: `${STORAGE_PREFIX}cache_${STORAGE_VERSION}`,
  SETTINGS: `${STORAGE_PREFIX}settings_${STORAGE_VERSION}`,
} as const;

// Configuration optimisée
const CONFIG = {
  APP_VERSION: '1.0.0',
  MAX_BILLS: 1000,
  MAX_ARCHIVE_AGE_DAYS: 90,
  CACHE_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes
  MAX_STORAGE_SIZE_MB: 5,
  COMPRESSION_ENABLED: false,
  COMPRESSION_THRESHOLD: 1024, // Compresser seulement si > 1KB
  BATCH_SIZE: 100,
} as const;


// Système de compression simple
class CompressionManager {
  // Marqueur pour identifier les données compressées
  private static COMPRESSION_MARKER = 'LZS_V1:';

  static compress(data: any): string {
    try {
      if (!CONFIG.COMPRESSION_ENABLED) {
        return JSON.stringify(data);
      }

      const jsonStr = JSON.stringify(data);

      // Ne pas compresser les petites données
      if (jsonStr.length < CONFIG.COMPRESSION_THRESHOLD) {
        return jsonStr;
      }

      // Compresser avec lz-string (format UTF16 pour compatibilité)
      const compressed = LZString.compressToUTF16(jsonStr);

      // Ajouter le marqueur pour identifier les données compressées
      return this.COMPRESSION_MARKER + compressed;
    } catch (error) {
      console.error('Compression error:', error);
      // En cas d'erreur, retourner les données brutes
      return JSON.stringify(data);
    }
  }
  static decompress(data: string): any {
    try {
      // Vérifier si les données sont compressées avec notre nouveau format
      if (data.startsWith(this.COMPRESSION_MARKER)) {
        // Extraire les données compressées sans le marqueur
        const compressedData = data.substring(this.COMPRESSION_MARKER.length);

        // Décompresser avec lz-string
        const decompressed = LZString.decompressFromUTF16(compressedData);

        if (decompressed === null) {
          throw new Error('LZ-String decompression failed');
        }

        return JSON.parse(decompressed);
      }

      // Compatibilité avec l'ancien format de compression (COMP_V1)
      if (data.startsWith('COMP_V1:')) {
        // Essayer de décompresser avec l'ancienne méthode
        const compressedData = data.substring('COMP_V1:'.length);

        try {
          // Décompresser avec l'ancienne méthode (pour la migration)
          const decompressed = compressedData.replace(
            /(.)(#)(\d+)(#)/g,
            (match, char, sep1, count, sep2) => {
              const repetitions = parseInt(count, 10);
              if (repetitions > 10000) {
                throw new Error('Decompression count exceeds safety limit');
              }
              return char.repeat(repetitions);
            }
          );

          return JSON.parse(decompressed);
        } catch (oldFormatError) {
          log.error('Error decompressing with old format:', oldFormatError);
          // En cas d'échec, essayer le format JSON brut
          return JSON.parse(data);
        }
      }

      // Essayer comme JSON normal non compressé
      return JSON.parse(data);
    } catch (error) {
      console.error('Decompression error:', error);

      // Tentative de récupération
      try {
        // Si c'est une erreur de décompression mais que les données pourraient être du JSON valide
        if (data.startsWith('{') || data.startsWith('[')) {
          return JSON.parse(data);
        }
      } catch (e) {
        // Ne rien faire, on laissera l'erreur se propager
      }

      // Lever une erreur explicite
      if (error instanceof Error) {
        throw new Error(`Failed to parse data: ${error.message}`);
      } else {
        throw new Error('Failed to parse data: Unknown error');
      }
    }
  }
}

// Fonction améliorée de log avec horodatage et niveaux
const log = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[INFO][${timestamp}][${Platform.OS}] ${message}`, data || '');
  },
  error: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.error(
      `[ERROR][${timestamp}][${Platform.OS}] ${message}`,
      data || ''
    );
  },
  perf: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[PERF][${timestamp}][${Platform.OS}] ${message}`, data || '');
  },
};

// Cache en mémoire optimisé avec limite de taille et nettoyage automatique
class MemoryCache {
  private cache: Map<string, { data: any; timestamp: number; size: number }> = new Map();
  private maxSize: number = 50 * 1024 * 1024; // 50MB maximum
  private currentSize: number = 0;
  private maxEntries: number = 100; // Maximum 100 entrées

  private calculateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // Approximation UTF-16
    } catch {
      return 1024; // Fallback 1KB
    }
  }

  private evictOldest(): void {
    if (this.cache.size === 0) return;

    // Trier par timestamp et supprimer les plus anciens
    const entries = Array.from(this.cache.entries())
      .sort(([,a], [,b]) => a.timestamp - b.timestamp);

    const toRemove = Math.ceil(entries.length * 0.3); // Supprimer 30% des entrées
    
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const [key, value] = entries[i];
      this.currentSize -= value.size;
      this.cache.delete(key);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const expiry = 5 * 60 * 1000; // 5 minutes

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > expiry) {
        this.currentSize -= value.size;
        this.cache.delete(key);
      }
    }
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > 5 * 60 * 1000) {
      this.currentSize -= item.size;
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  set<T>(key: string, data: T): void {
    const size = this.calculateSize(data);
    
    // Vérifier les limites avant d'ajouter
    if (this.cache.size >= this.maxEntries || this.currentSize + size > this.maxSize) {
      this.cleanup();
      
      if (this.cache.size >= this.maxEntries || this.currentSize + size > this.maxSize) {
        this.evictOldest();
      }
    }

    // Supprimer l'ancienne entrée si elle existe
    const existing = this.cache.get(key);
    if (existing) {
      this.currentSize -= existing.size;
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      size
    });
    
    this.currentSize += size;
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  getStats() {
    return {
      entries: this.cache.size,
      currentSize: this.currentSize,
      maxSize: this.maxSize,
      maxEntries: this.maxEntries
    };
  }
}

// Classe utilitaire optimisée pour gérer le stockage
class StorageManager {
  public static memoryCache = new MemoryCache(); // Le nouveau cache optimisé
  private static serializationCache = new Map<string, { hash: string; serialized: string }>();
  private static pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();
  private static hashCache = new Map<any, string>();

  private static performanceMonitor = new Map<
    string,
    { reads: number; writes: number }
  >();

  // Cache de hash pour éviter les recalculs
  private static calculateHash(data: any): string {
    // Vérifier le cache de hash d'abord
    if (this.hashCache.has(data)) {
      return this.hashCache.get(data)!;
    }

    try {
      // Hash simple et rapide
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      const result = hash.toString(36);
      
      // Limiter la taille du cache de hash
      if (this.hashCache.size > 1000) {
        this.hashCache.clear();
      }
      
      this.hashCache.set(data, result);
      return result;
    } catch {
      return Math.random().toString(36);
    }
  }

  private static isDataChanged(oldData: any, newData: any): boolean {
    if (oldData === newData) return false;

    // Utiliser le hash pour une comparaison rapide
    try {
      const oldHash = this.calculateHash(oldData);
      const newHash = this.calculateHash(newData);
      return oldHash !== newHash;
    } catch (e) {
      // En cas d'erreur, considérer les données comme modifiées
      return true;
    }
  }

  static async save<T>(
    key: string,
    data: T,
    compress: boolean = CONFIG.COMPRESSION_ENABLED
  ): Promise<void> {
    try {
      // Annuler l'écriture en attente pour cette clé
      const pendingTimeout = this.pendingWrites.get(key);
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
      }

      // Vérifier si les données ont vraiment changé
      const cachedData = this.memoryCache.get<T>(key);
      if (cachedData && !this.isDataChanged(cachedData, data)) {
        return; // Données identiques, pas besoin de sauvegarder
      }

      // Mettre à jour le cache mémoire immédiatement
      this.memoryCache.set(key, data);

      // Préparer la sérialisation avec cache
      const dataHash = this.calculateHash(data);
      let jsonValue: string;
      const cached = this.serializationCache.get(key);
      
      if (cached && cached.hash === dataHash) {
        // Réutiliser la sérialisation en cache
        jsonValue = cached.serialized;
      } else {
        // Nouvelle sérialisation
        if (compress && JSON.stringify(data).length > CONFIG.COMPRESSION_THRESHOLD) {
          jsonValue = CompressionManager.compress(data);
        } else {
          jsonValue = JSON.stringify(data);
        }
        
        // Mettre en cache la sérialisation
        this.serializationCache.set(key, { hash: dataHash, serialized: jsonValue });
        
        // Limiter la taille du cache de sérialisation
        if (this.serializationCache.size > 50) {
          const firstKey = this.serializationCache.keys().next().value;
          if (typeof firstKey === 'string') {
            this.serializationCache.delete(firstKey);
          }
        }
      }

      // Écriture différée pour éviter les écritures trop fréquentes
      const writeTimeout = setTimeout(async () => {
        try {
          await AsyncStorage.setItem(key, jsonValue);
          this.pendingWrites.delete(key);
          log.info(`Data saved to ${key} successfully (deferred)`);
        } catch (error) {
          log.error(`Error saving deferred data to ${key}:`, error);
        }
      }, 100); // Attendre 100ms

      this.pendingWrites.set(key, writeTimeout);

      return Promise.resolve();
    } catch (error) {
      log.error(`Error preparing save for ${key}:`, error);
      throw error;
    }
  }

  static async load<T>(key: string, defaultValue: T): Promise<T> {
    return LoadingStateManager.getOrLoad(key, async () => {
      const startTime = Date.now();
      try {
        // Vérifier le cache en mémoire
        const cachedData = this.memoryCache.get<T>(key);
        if (cachedData !== null) {
          log.perf(`Cache hit for ${key}`, {
            duration: Date.now() - startTime,
          });
          return cachedData;
        }

        const jsonValue = await AsyncStorage.getItem(key);
        if (jsonValue === null) {
          log.info(`No data found for ${key}, using default value`);
          return defaultValue;
        }

        let parsedData: T;
        try {
          parsedData = JSON.parse(jsonValue) as T;
        } catch (parseError) {
          try {
            parsedData = CompressionManager.decompress(jsonValue) as T;
          } catch (decompressError) {
            log.error(`Failed to parse data from ${key}:`, decompressError);
            await AsyncStorage.setItem(`${key}_corrupted`, jsonValue);
            return defaultValue;
          }
        }

        this.memoryCache.set(key, parsedData);
        this.trackPerformance(key, 'read');
        log.perf(`Loaded data from ${key}`, {
          duration: Date.now() - startTime,
        });

        return parsedData;
      } catch (error) {
        log.error(`Error loading data from ${key}:`, error);
        return defaultValue;
      }
    });
  }

  // Forcer l'écriture de toutes les données en attente
  static async flushPendingWrites(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const [key, timeout] of this.pendingWrites.entries()) {
      clearTimeout(timeout);
      this.pendingWrites.delete(key);
      
      // Effectuer l'écriture immédiatement
      const cachedData = this.memoryCache.get(key);
      if (cachedData) {
        promises.push(
          AsyncStorage.setItem(key, JSON.stringify(cachedData))
            .catch(error => log.error(`Error flushing ${key}:`, error))
        );
      }
    }

    await Promise.all(promises);
    log.info(`Flushed ${promises.length} pending writes`);
  }

  static async performMaintenance(): Promise<void> {
    try {
      // 1. Nettoyer tout le cache en mémoire
      StorageManager.memoryCache.clear();

      // 2. Nettoyer les données de cache dans AsyncStorage
      await AsyncStorage.removeItem(STORAGE_KEYS.CACHE);

      // 3. Nettoyer les caches internes
      this.serializationCache.clear();
      this.hashCache.clear();

      // 4. Annuler les écritures en attente et les forcer
      await this.flushPendingWrites();

      // 5. Vérifier et réparer les données incohérentes des tables
      await TableManager.cleanupOrphanedTableData();

      log.info('Maintenance de stockage terminée avec succès');
    } catch (error) {
      log.error('Erreur lors de la maintenance du stockage:', error);
    }
  }

  static async resetCorruptedData(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
      log.info(`Reset corrupted data for ${key}`);
    } catch (error) {
      log.error(`Error resetting corrupted data for ${key}:`, error);
    }
  }

  static async batchSave(
    operations: Array<{ key: string; data: any }>
  ): Promise<void> {
    try {
      const pairs: [string, string][] = operations.map((op) => {
        const needsCompression =
          JSON.stringify(op.data).length > CONFIG.COMPRESSION_THRESHOLD;
        const jsonValue = needsCompression
          ? CompressionManager.compress(op.data)
          : JSON.stringify(op.data);

        // Mettre à jour le cache mémoire
        this.memoryCache.set(op.key, op.data);

        // Créer un tuple correctement typé
        return [op.key, jsonValue];
      });

      // Vérifier si nous avons des paires à enregistrer
      if (pairs.length > 0) {
        await AsyncStorage.multiSet(pairs);
        log.info(`Batch saved ${pairs.length} items successfully`);
      }

      return Promise.resolve();
    } catch (error) {
      log.error(`Error in batch save:`, error);
      throw error;
    }
  }

  static async resetApplicationData(): Promise<void> {
    try {
      const keysToReset = [
        STORAGE_KEYS.BILLS,
        STORAGE_KEYS.BILLS_ARCHIVE,
        STORAGE_KEYS.MENU_AVAILABILITY,
        STORAGE_KEYS.LAST_SYNC,
        STORAGE_KEYS.CACHE,
      ];

      for (const key of keysToReset) {
        await AsyncStorage.removeItem(key);
      }

      this.memoryCache.clear();
      this.serializationCache.clear();
      this.hashCache.clear();
      
      // Annuler toutes les écritures en attente
      for (const timeout of this.pendingWrites.values()) {
        clearTimeout(timeout);
      }
      this.pendingWrites.clear();

      log.info("Les données de l'application ont été réinitialisées");

      await AsyncStorage.setItem(STORAGE_KEYS.APP_VERSION, CONFIG.APP_VERSION);
    } catch (error) {
      log.error('Erreur lors de la réinitialisation des données:', error);
      throw error;
    }
  }

  private static trackPerformance(
    key: string,
    operation: 'read' | 'write'
  ): void {
    if (!this.performanceMonitor.has(key)) {
      this.performanceMonitor.set(key, { reads: 0, writes: 0 });
    }

    const stats = this.performanceMonitor.get(key)!;
    if (operation === 'read') {
      stats.reads++;
    } else {
      stats.writes++;
    }
  }

  static getPerformanceStats(): Array<{
    key: string;
    reads: number;
    writes: number;
  }> {
    const stats: Array<{ key: string; reads: number; writes: number }> = [];
    this.performanceMonitor.forEach((value, key) => {
      stats.push({ key, ...value });
    });
    return stats;
  }

  static async isFirstLaunch(): Promise<boolean> {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_LAUNCH);
    return value === null || value === 'true';
  }

  static async markAppLaunched(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.FIRST_LAUNCH, 'false');
    await AsyncStorage.setItem(STORAGE_KEYS.APP_VERSION, CONFIG.APP_VERSION);
  }

  static async checkForMigrations(): Promise<boolean> {
    const storedVersion = await AsyncStorage.getItem(STORAGE_KEYS.APP_VERSION);
    return storedVersion !== CONFIG.APP_VERSION;
  }

  static async clearAllData(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter((key) =>
        key.startsWith(STORAGE_PREFIX)
      );
      await AsyncStorage.multiRemove(keysToRemove);
      
      this.memoryCache.clear();
      this.serializationCache.clear();
      this.hashCache.clear();
      
      // Annuler toutes les écritures en attente
      for (const timeout of this.pendingWrites.values()) {
        clearTimeout(timeout);
      }
      this.pendingWrites.clear();

      log.info(`Cleared ${keysToRemove.length} storage keys`);
    } catch (error) {
      log.error('Error clearing data:', error);
      throw error;
    }
  }

  // Nouvelle méthode pour obtenir les statistiques du cache
  static getCacheStats() {
    return {
      memory: this.memoryCache.getStats(),
      serialization: {
        entries: this.serializationCache.size,
        maxEntries: 50
      },
      hash: {
        entries: this.hashCache.size,
        maxEntries: 1000
      },
      pendingWrites: this.pendingWrites.size,
      performance: this.getPerformanceStats()
    };
  }
}

// Données par défaut pour les tables (inchangé)
export const defaultTables: Table[] = [
  // EAU Section
  {
    id: 1,
    name: 'Doc 1',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 4,
  },
  {
    id: 2,
    name: 'Doc 2',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 4,
  },
  {
    id: 3,
    name: 'Doc 3',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 4,
  },
  {
    id: 4,
    name: 'Vue 1',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 4,
  },
  {
    id: 5,
    name: 'Vue 2',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 4,
  },
  {
    id: 6,
    name: 'R1',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 2,
  },
  {
    id: 7,
    name: 'R2',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 2,
  },
  {
    id: 8,
    name: 'R3',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 2,
  },
  {
    id: 9,
    name: 'R4',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 2,
  },
  {
    id: 10,
    name: 'Poteau',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 4,
  },
  {
    id: 11,
    name: 'Ext 1',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 4,
  },
  {
    id: 12,
    name: 'Ext 2',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 4,
  },
  {
    id: 13,
    name: 'Ext Rge',
    section: TABLE_SECTIONS.EAU,
    status: 'available',
    seats: 6,
  },

  // BUIS Section
  {
    id: 14,
    name: 'Bas 0',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 15,
    name: 'Bas 1',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 16,
    name: 'Arbre 1',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 17,
    name: 'Arbre 2',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 18,
    name: 'Tronc',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 2,
  },
  {
    id: 19,
    name: 'Caillou',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 2,
  },
  {
    id: 20,
    name: 'Escalier 1',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 21,
    name: 'Escalier 2',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 22,
    name: 'Transfo',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 6,
  },
  {
    id: 23,
    name: 'Bache 1',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 24,
    name: 'Bache 2',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 25,
    name: 'Bache 3',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 26,
    name: 'Che 1',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 27,
    name: 'Che 2',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 28,
    name: 'PDC 1',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 29,
    name: 'PDC 2',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 30,
    name: 'Eve Rgb',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 6,
  },
  {
    id: 31,
    name: 'Eve Bois',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 6,
  },
  {
    id: 32,
    name: 'HDB',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 33,
    name: 'Lukas 1',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 34,
    name: 'Lukas 2',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 35,
    name: 'Route 1',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 36,
    name: 'Route 2',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 4,
  },
  {
    id: 37,
    name: 'Sous Cabane',
    section: TABLE_SECTIONS.BUIS,
    status: 'available',
    seats: 6,
  },
];

// Classe de gestion des tables optimisée
class TableManager {
  private static readonly CACHE_KEY = 'tables_cache';
  private static isInitializing = false;

  static async initializeTables(): Promise<Table[]> {
    try {
      const existingTables = await StorageManager.load<Table[]>(
        STORAGE_KEYS.TABLES,
        []
      );

      if (existingTables.length > 0) {
        log.info('Tables already exist, skipping initialization');
        return existingTables;
      }

      log.info('First initialization of tables with default data');
      await StorageManager.save(STORAGE_KEYS.TABLES, defaultTables);
      await StorageManager.markAppLaunched();
      return defaultTables;
    } catch (error) {
      log.error('Error initializing tables:', error);
      return defaultTables;
    }
  }

  calculateTotal = (items: OrderItem[]): number => {
    return items.reduce((sum, item) => {
      // N'ajoute le prix au total que si l'article n'est pas marqué comme offert
      if (!item.offered) {
        return sum + item.price * item.quantity;
      }
      return sum;
    }, 0);
  };

  static async getTables(): Promise<Table[]> {
    return LoadingStateManager.getOrLoad('getTables', async () => {
      try {
        let tables = await StorageManager.load<Table[]>(
          STORAGE_KEYS.TABLES,
          []
        );

        if (tables.length === 0 && !this.isInitializing) {
          log.info('No tables found, initializing with defaults');
          this.isInitializing = true;
          try {
            tables = await TableManager.initializeTables();
          } finally {
            this.isInitializing = false;
          }
        }

        const needsCorrection = tables.some((table) => !table.section);
        if (needsCorrection) {
          log.info('Found tables with missing section, correcting...');
          tables = tables.map((table) => {
            if (!table.section) {
              const defaultTable = defaultTables.find((t) => t.id === table.id);
              return {
                ...table,
                section: defaultTable?.section || TABLE_SECTIONS.EAU,
              };
            }
            return table;
          });
          await StorageManager.save(STORAGE_KEYS.TABLES, tables);
        }

        return tables;
      } catch (error) {
        log.error('Error retrieving tables:', error);
        return defaultTables;
      }
    });
  }

  static async saveTables(tables: Table[]): Promise<void> {
    return StorageManager.save(STORAGE_KEYS.TABLES, tables);
  }

  static async getTable(id: number): Promise<Table | null> {
    try {
      const tables = await TableManager.getTables();
      return tables.find((table) => table.id === id) || null;
    } catch (error) {
      log.error(`Error getting table ${id}:`, error);
      return null;
    }
  }

  static async updateTable(updatedTable: Table): Promise<void> {
    try {
      const tables = await TableManager.getTables();

      const existingIndex = tables.findIndex(
        (table) => table.id === updatedTable.id
      );

      if (existingIndex >= 0) {
        tables[existingIndex] = updatedTable;
      } else {
        tables.push(updatedTable);
      }

      // Sauvegarde directe avec AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));

      // Mettre à jour le cache
      StorageManager.memoryCache.set(STORAGE_KEYS.TABLES, tables);

      // Émettre l'événement
      events.emit(EVENT_TYPES.TABLE_UPDATED, updatedTable.id);
    } catch (error) {
      console.error(`Error updating table ${updatedTable.id}:`, error);
      throw error;
    }
  }

  // Modifier la fonction resetTable pour garantir un nettoyage complet
  static async resetTable(tableId: number): Promise<void> {
    try {
      const tables = await TableManager.getTables();
      const tableIndex = tables.findIndex((table) => table.id === tableId);

      if (tableIndex >= 0) {
        const defaultTable = defaultTables.find((t) => t.id === tableId);
        const currentTable = tables[tableIndex];

        // Conserver uniquement les informations de base et réinitialiser tout le reste
        tables[tableIndex] = {
          ...(defaultTable || { id: tableId, seats: 4 }),
          id: tableId,
          name: currentTable.name,
          section:
            currentTable.section || defaultTable?.section || TABLE_SECTIONS.EAU,
          status: 'available',
          seats: currentTable.seats || defaultTable?.seats || 4,
          // Supprimer explicitement les propriétés ci-dessous
          guests: undefined,
          order: undefined,
        };

        await TableManager.saveTables(tables);
        log.info(
          `Reset table ${tableId} to available state - order data completely purged`
        );

        // Émettre un événement pour notification
        events.emit(EVENT_TYPES.TABLE_UPDATED, tableId);

        return;
      } else {
        log.info(`Table ${tableId} not found for reset`);
      }
    } catch (error) {
      log.error(`Error resetting table ${tableId}:`, error);
      throw error;
    }
  }

  static async cleanupOrphanedTableData(): Promise<void> {
    try {
      const tables = await TableManager.getTables();
      let cleanedTables = 0;

      // Parcourir toutes les tables pour nettoyer les données orphelines
      for (const table of tables) {
        let needsCleanup = false;

        // Vérifier les incohérences
        if (table.status === 'available' && (table.order || table.guests)) {
          needsCleanup = true;
        }

        // Vérifier les commandes vides
        if (
          table.order &&
          (!table.order.items || table.order.items.length === 0)
        ) {
          needsCleanup = true;
        }

        // Nettoyer si nécessaire
        if (needsCleanup) {
          const defaultTable = defaultTables.find((t) => t.id === table.id);
          table.status = 'available';
          table.guests = undefined;
          table.order = undefined;
          cleanedTables++;
        }
      }

      if (cleanedTables > 0) {
        await TableManager.saveTables(tables);
        log.info(
          `Auto-cleanup: fixed ${cleanedTables} tables with orphaned data`
        );
      }
    } catch (error) {
      log.error('Error during orphaned table data cleanup:', error);
    }
  }

  static async resetAllTables(): Promise<void> {
    try {
      const currentTables = await TableManager.getTables();

      const resetTables = defaultTables.map((defaultTable) => {
        const existingTable = currentTables.find(
          (t) => t.id === defaultTable.id
        );
        return {
          ...defaultTable,
          name: existingTable?.name || defaultTable.name,
          section: existingTable?.section || defaultTable.section,
        };
      });

      await TableManager.saveTables(resetTables);
      log.info('All tables have been reset to default state');
    } catch (error) {
      log.error('Error resetting all tables:', error);
      throw error;
    }
  }
}

// Classe de gestion des factures optimisée
class BillManager {
  static async getBills(): Promise<Bill[]> {
    return LoadingStateManager.getOrLoad('getBills', async () => {
      return StorageManager.load<Bill[]>(STORAGE_KEYS.BILLS, []);
    });
  }

  static async saveBills(bills: Bill[]): Promise<void> {
    return StorageManager.save(STORAGE_KEYS.BILLS, bills);
  }

  static async addBill(bill: Bill): Promise<void> {
    try {
      const bills = await BillManager.getBills();
      bills.push(bill);

      // Nettoyer les anciennes factures si nécessaire
      const cleanedBills = await BillManager.cleanOldBills(bills);

      // Sauvegarde directe avec AsyncStorage
      await AsyncStorage.setItem(
        STORAGE_KEYS.BILLS,
        JSON.stringify(cleanedBills)
      );

      // Mettre à jour le cache
      StorageManager.memoryCache.set(STORAGE_KEYS.BILLS, cleanedBills);

      events.emit(EVENT_TYPES.PAYMENT_ADDED, bill.tableNumber, bill);
    } catch (error) {
      console.error(`Error adding bill:`, error);
      throw error;
    }
  }

  private static async cleanOldBills(bills: Bill[]): Promise<Bill[]> {
    if (bills.length <= CONFIG.MAX_BILLS) {
      return bills;
    }

    // Trier par date et garder les plus récents
    const sortedBills = [...bills].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Archiver les anciens
    const toArchive = sortedBills.slice(CONFIG.MAX_BILLS);
    await BillManager.archiveOldBills(toArchive);

    // Garder les plus récents
    const cleanedBills = sortedBills.slice(0, CONFIG.MAX_BILLS);

    log.info(`Cleaned ${bills.length - cleanedBills.length} old bills`);

    return cleanedBills;
  }

  private static async archiveOldBills(bills: Bill[]): Promise<void> {
    try {
      const existingArchive = await StorageManager.load<Bill[]>(
        STORAGE_KEYS.BILLS_ARCHIVE,
        []
      );
      const updatedArchive = [...existingArchive, ...bills];

      // Nettoyer l'archive si elle devient trop grande
      const cleanedArchive = BillManager.pruneArchive(updatedArchive);

      await StorageManager.save(STORAGE_KEYS.BILLS_ARCHIVE, cleanedArchive);
      log.info(`Archived ${bills.length} bills`);
    } catch (error) {
      log.error('Error archiving bills:', error);
    }
  }

  private static pruneArchive(archive: Bill[]): Bill[] {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() - CONFIG.MAX_ARCHIVE_AGE_DAYS);

    return archive.filter((bill) => new Date(bill.timestamp) > maxDate);
  }

  /**
   * Récupère les factures de manière paginée
   * @param page Numéro de page (commence à 0)
   * @param pageSize Nombre d'éléments par page
   * @param sortByDate Tri par date (défaut: true)
   * @returns Objet contenant les factures paginées et les métadonnées
   */
  static async getPaginatedBills(
    page: number = 0,
    pageSize: number = 20,
    sortByDate: boolean = true
  ): Promise<{
    bills: Bill[];
    total: number;
    currentPage: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    try {
      // Récupérer toutes les factures
      const allBills = await BillManager.getBills();

      // Trier si nécessaire
      const sortedBills = sortByDate
        ? [...allBills].sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
        : allBills;

      // Calculer les indices de début et de fin
      const startIndex = page * pageSize;
      const endIndex = startIndex + pageSize;

      // Extraire les factures de la page demandée
      const paginatedBills = sortedBills.slice(startIndex, endIndex);

      // Calculer les métadonnées de pagination
      const total = sortedBills.length;
      const totalPages = Math.ceil(total / pageSize);
      const hasMore = endIndex < total;

      return {
        bills: paginatedBills,
        total,
        currentPage: page,
        totalPages,
        hasMore,
      };
    } catch (error) {
      console.error('Error getting paginated bills:', error);
      return {
        bills: [],
        total: 0,
        currentPage: page,
        totalPages: 0,
        hasMore: false,
      };
    }
  }

  /**
   * Récupère les factures filtrées et paginées
   * @param filters Critères de filtrage
   * @param page Numéro de page
   * @param pageSize Nombre d'éléments par page
   * @returns Factures filtrées et paginées avec métadonnées
   */
  static async getFilteredPaginatedBills(
    filters: {
      dateRange?: { start: Date; end: Date };
      paymentMethod?: string;
      status?: string;
      tableNumber?: number;
      minAmount?: number;
      maxAmount?: number;
      searchText?: string;
    },
    page: number = 0,
    pageSize: number = 20
  ): Promise<{
    bills: Bill[];
    total: number;
    currentPage: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    try {
      // Récupérer toutes les factures
      const allBills = await BillManager.getBills();

      // Appliquer les filtres
      const filteredBills = allBills.filter((bill) => {
        // Date range filter
        if (filters.dateRange) {
          const billDate = new Date(bill.timestamp);
          if (
            billDate < filters.dateRange.start ||
            billDate > filters.dateRange.end
          ) {
            return false;
          }
        }

        // Payment method filter
        if (
          filters.paymentMethod &&
          bill.paymentMethod !== filters.paymentMethod
        ) {
          return false;
        }

        // Status filter
        if (filters.status && bill.status !== filters.status) {
          return false;
        }

        // Table number filter
        if (filters.tableNumber && bill.tableNumber !== filters.tableNumber) {
          return false;
        }

        // Amount range filter
        if (filters.minAmount && bill.amount < filters.minAmount) {
          return false;
        }
        if (filters.maxAmount && bill.amount > filters.maxAmount) {
          return false;
        }

        // Search text filter
        if (filters.searchText) {
          const searchLower = filters.searchText.toLowerCase();
          const tableName = bill.tableName || `Table ${bill.tableNumber}`;
          return (
            tableName.toLowerCase().includes(searchLower) ||
            bill.amount.toString().includes(searchLower) ||
            (bill.section && bill.section.toLowerCase().includes(searchLower))
          );
        }

        return true;
      });

      // Trier par date (du plus récent au plus ancien)
      const sortedBills = [...filteredBills].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Paginer les résultats
      const startIndex = page * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedBills = sortedBills.slice(startIndex, endIndex);

      // Métadonnées
      const total = sortedBills.length;
      const totalPages = Math.ceil(total / pageSize);
      const hasMore = endIndex < total;

      return {
        bills: paginatedBills,
        total,
        currentPage: page,
        totalPages,
        hasMore,
      };
    } catch (error) {
      console.error('Error getting filtered paginated bills:', error);
      return {
        bills: [],
        total: 0,
        currentPage: page,
        totalPages: 0,
        hasMore: false,
      };
    }
  }

  static async clearAllBills(): Promise<void> {
    try {
      await StorageManager.save(STORAGE_KEYS.BILLS, []);
      log.info('Toutes les factures ont été supprimées');
    } catch (error) {
      log.error('Erreur lors de la suppression des factures:', error);
      throw error;
    }
  }

  static async deleteBill(billId: number): Promise<void> {
    try {
      const bills = await BillManager.getBills();
      const updatedBills = bills.filter((bill) => bill.id !== billId);

      if (bills.length !== updatedBills.length) {
        await BillManager.saveBills(updatedBills);
        log.info(`Deleted bill ID ${billId}`);
      } else {
        log.info(`Bill ID ${billId} not found for deletion`);
      }
    } catch (error) {
      log.error(`Error deleting bill ${billId}:`, error);
      throw error;
    }
  }

  static async getBillsForTable(tableId: number): Promise<Bill[]> {
    try {
      const bills = await BillManager.getBills();

      const tableBills = bills.filter((bill) => bill.tableNumber === tableId);

      tableBills.sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return dateB - dateA;
      });

      return tableBills;
    } catch (error) {
      log.error(`Error getting bills for table ${tableId}:`, error);
      return [];
    }
  }

  static async getBillsByDate(date: Date): Promise<Bill[]> {
    try {
      const bills = await BillManager.getBills();
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      return bills.filter((bill) => {
        const billDate = new Date(bill.timestamp);
        return billDate >= startOfDay && billDate <= endOfDay;
      });
    } catch (error) {
      log.error(`Error getting bills by date:`, error);
      return [];
    }
  }
}

// Classe de gestion de la disponibilité des articles du menu
class MenuManager {
  static async getMenuAvailability(): Promise<MenuItemAvailability[]> {
    return StorageManager.load<MenuItemAvailability[]>(
      STORAGE_KEYS.MENU_AVAILABILITY,
      []
    );
  }

  static async saveMenuAvailability(
    items: MenuItemAvailability[]
  ): Promise<void> {
    try {
      const validItems = items.filter(
        (item) =>
          typeof item.id === 'number' &&
          typeof item.available === 'boolean' &&
          typeof item.name === 'string' &&
          typeof item.price === 'number'
      );

      if (validItems.length > 0) {
        await StorageManager.save(STORAGE_KEYS.MENU_AVAILABILITY, validItems);
        log.info(
          `Saved availability status for ${validItems.length} menu items`
        );
      } else {
        log.info('No valid menu items to save');
      }
    } catch (error) {
      log.error(`Error saving menu availability:`, error);
      throw error;
    }
  }

  static async updateItemAvailability(
    itemId: number,
    available: boolean
  ): Promise<void> {
    try {
      const items = await MenuManager.getMenuAvailability();
      const existingItemIndex = items.findIndex((item) => item.id === itemId);

      if (existingItemIndex >= 0) {
        items[existingItemIndex].available = available;
      } else {
        log.info(
          `Cannot update availability for item ${itemId} - not found in availability list`
        );
        return;
      }

      await MenuManager.saveMenuAvailability(items);
      log.info(`Updated availability of item ${itemId} to ${available}`);
    } catch (error) {
      log.error(`Error updating item availability:`, error);
      throw error;
    }
  }
}

// Dans utils/storage.ts - Ajouter cette classe
class LoadingStateManager {
  private static loadingStates = new Map<string, Promise<any>>();

  static async getOrLoad<T>(key: string, loadFunction: () => Promise<T>): Promise<T> {
    // Si déjà en cours de chargement, retourner la promesse existante
    if (this.loadingStates.has(key)) {
      return this.loadingStates.get(key) as Promise<T>;
    }

    // Créer et stocker la promesse de chargement
    const loadingPromise = loadFunction();
    this.loadingStates.set(key, loadingPromise);

    try {
      const result = await loadingPromise;
      return result;
    } finally {
      // Nettoyer l'état de chargement une fois terminé
      this.loadingStates.delete(key);
    }
  }
}

class CustomMenuManager {
  static async getCustomMenuItems(): Promise<CustomMenuItem[]> {
    return StorageManager.load<CustomMenuItem[]>(
      STORAGE_KEYS.CUSTOM_MENU_ITEMS,
      []
    );
  }

  static async saveCustomMenuItems(items: CustomMenuItem[]): Promise<void> {
    return StorageManager.save(STORAGE_KEYS.CUSTOM_MENU_ITEMS, items);
  }

  static async addCustomMenuItem(item: CustomMenuItem): Promise<void> {
    try {
      const items = await CustomMenuManager.getCustomMenuItems();
      items.push(item);
      await CustomMenuManager.saveCustomMenuItems(items);
      log.info(`Added new custom menu item ID ${item.id}: ${item.name}`);
    } catch (error) {
      log.error(`Error adding custom menu item:`, error);
      throw error;
    }
  }

  static async updateCustomMenuItem(
    updatedItem: CustomMenuItem
  ): Promise<void> {
    try {
      const items = await CustomMenuManager.getCustomMenuItems();
      const index = items.findIndex((item) => item.id === updatedItem.id);

      if (index >= 0) {
        items[index] = updatedItem;
        await CustomMenuManager.saveCustomMenuItems(items);
        log.info(`Updated custom menu item ID ${updatedItem.id}`);
      } else {
        log.info(`Custom menu item ID ${updatedItem.id} not found for update`);
      }
    } catch (error) {
      log.error(`Error updating custom menu item:`, error);
      throw error;
    }
  }

  // Supprimer un article personnalisé
  static async deleteCustomMenuItem(itemId: number): Promise<void> {
    try {
      const items = await CustomMenuManager.getCustomMenuItems();
      const updatedItems = items.filter((item) => item.id !== itemId);

      if (items.length !== updatedItems.length) {
        await CustomMenuManager.saveCustomMenuItems(updatedItems);
        log.info(`Deleted custom menu item ID ${itemId}`);
      } else {
        log.info(`Custom menu item ID ${itemId} not found for deletion`);
      }
    } catch (error) {
      log.error(`Error deleting custom menu item ${itemId}:`, error);
      throw error;
    }
  }
}

// Exporter les classes de gestion pour utilisation dans l'application
export {
  StorageManager,
  TableManager,
  BillManager,
  MenuManager,
  CustomMenuManager,
};

// Pour maintenir la compatibilité avec le code existant, réexporter les fonctions
// avec les mêmes noms que dans l'ancien système
export const initializeTables = TableManager.initializeTables;
export const getTables = TableManager.getTables;
export const saveTables = TableManager.saveTables;
export const getTable = TableManager.getTable;
export const updateTable = TableManager.updateTable;
export const resetTable = TableManager.resetTable;
export const resetAllTables = TableManager.resetAllTables;
export const getBills = BillManager.getBills;
export const saveBills = BillManager.saveBills;
export const addBill = BillManager.addBill;
export const getPaginatedBills = BillManager.getPaginatedBills;
export const getFilteredPaginatedBills = BillManager.getFilteredPaginatedBills;
export const getMenuAvailability = MenuManager.getMenuAvailability;
export const saveMenuAvailability = MenuManager.saveMenuAvailability;
export const getCustomMenuItems = CustomMenuManager.getCustomMenuItems;
export const saveCustomMenuItems = CustomMenuManager.saveCustomMenuItems;
export const addCustomMenuItem = CustomMenuManager.addCustomMenuItem;
export const updateCustomMenuItem = CustomMenuManager.updateCustomMenuItem;
export const deleteCustomMenuItem = CustomMenuManager.deleteCustomMenuItem;
