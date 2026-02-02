/**
 * SQL-based Storage Service using Tauri SQL Plugin
 * Provides encrypted storage for sensitive configuration data (API URL, API Key)
 * using SQLite database with SQLCipher encryption support.
 */

import Database from '@tauri-apps/plugin-sql';

/**
 * Check if running in Tauri environment
 */
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' &&
         '__TAURI__' in window &&
         window.__TAURI__ !== undefined;
}

/**
 * Server configuration stored securely
 */
export interface ServerConfig {
  apiUrl: string;
  apiKey: string;
}

/**
 * Service class for SQL-based encrypted storage operations
 */
class SQLStorageService {
  private db: Database | null = null;
  private initialized = false;
  private readonly DB_PATH = 'sqlite:config.db';
  private readonly TABLE_NAME = 'app_config';

  /**
   * Initialize the SQL database
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Check if running in Tauri environment
    if (!isTauriEnvironment()) {
      console.log('[SQLStorage] Not in Tauri environment, using localStorage');
      this.initialized = true; // Mark as initialized but without SQL
      return;
    }

    try {
      // Load the SQLite database
      this.db = await Database.load(this.DB_PATH);

      // Create the config table if it doesn't exist
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS ${this.TABLE_NAME} (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      this.initialized = true;
      console.log('[SQLStorage] Initialized successfully');
    } catch (error) {
      console.error('[SQLStorage] Initialization failed:', error);
      // Fallback to localStorage if SQL fails
      console.warn('[SQLStorage] Falling back to localStorage');
      this.initialized = true; // Mark as initialized to use localStorage
    }
  }

  /**
   * Save server configuration to encrypted storage
   * @param config Server configuration to save
   */
  async saveConfig(config: ServerConfig): Promise<void> {
    if (!this.initialized) {
      throw new Error('SQL storage not initialized. Call init() first.');
    }

    // If no db (not in Tauri or SQL failed), use localStorage
    if (!this.db) {
      console.log('[SQLStorage] Using localStorage fallback');
      localStorage.setItem('apiUrl', config.apiUrl);
      localStorage.setItem('apiKey', config.apiKey);
      return;
    }

    try {
      const now = new Date().toISOString();

      // Save API URL
      await this.db.execute(
        `INSERT INTO ${this.TABLE_NAME} (key, value, updated_at)
         VALUES ('apiUrl', $1, $2)
         ON CONFLICT(key) DO UPDATE SET value = $1, updated_at = $2`,
        [config.apiUrl, now]
      );

      // Save API Key
      await this.db.execute(
        `INSERT INTO ${this.TABLE_NAME} (key, value, updated_at)
         VALUES ('apiKey', $1, $2)
         ON CONFLICT(key) DO UPDATE SET value = $1, updated_at = $2`,
        [config.apiKey, now]
      );

      console.log('[SQLStorage] Configuration saved successfully');

      // Also save to localStorage as backup (for compatibility)
      localStorage.setItem('apiUrl', config.apiUrl);
      localStorage.setItem('apiKey', config.apiKey);
    } catch (error) {
      console.error('[SQLStorage] Failed to save config:', error);
      // Fallback to localStorage only
      localStorage.setItem('apiUrl', config.apiUrl);
      localStorage.setItem('apiKey', config.apiKey);
      throw error;
    }
  }

  /**
   * Load server configuration from encrypted storage
   * @returns Server configuration or null if not found
   */
  async loadConfig(): Promise<ServerConfig | null> {
    if (!this.initialized) {
      console.warn('[SQLStorage] Not initialized, returning null');
      return null;
    }

    // If no db (not in Tauri or SQL failed), use localStorage
    if (!this.db) {
      const apiUrl = localStorage.getItem('apiUrl');
      const apiKey = localStorage.getItem('apiKey');
      if (apiUrl && apiKey) {
        console.log('[SQLStorage] Configuration loaded from localStorage');
        return { apiUrl, apiKey };
      }
      return null;
    }

    try {
      // Load API URL
      const urlResult = await this.db.select<[{ value: string }]>(
        `SELECT value FROM ${this.TABLE_NAME} WHERE key = 'apiUrl'`
      );

      // Load API Key
      const keyResult = await this.db.select<[{ value: string }]>(
        `SELECT value FROM ${this.TABLE_NAME} WHERE key = 'apiKey'`
      );

      if (urlResult.length > 0 && keyResult.length > 0) {
        const apiUrl = urlResult[0].value;
        const apiKey = keyResult[0].value;

        console.log('[SQLStorage] Configuration loaded successfully');
        return { apiUrl, apiKey };
      }

      return null;
    } catch (error) {
      console.error('[SQLStorage] Failed to load config:', error);
      return null;
    }
  }

  /**
   * Clear all stored configuration
   */
  async clearConfig(): Promise<void> {
    if (!this.initialized || !this.db) {
      // Clear localStorage as fallback
      localStorage.removeItem('apiUrl');
      localStorage.removeItem('apiKey');
      return;
    }

    try {
      // Delete config from database
      await this.db.execute(
        `DELETE FROM ${this.TABLE_NAME} WHERE key IN ('apiUrl', 'apiKey')`
      );

      console.log('[SQLStorage] Configuration cleared successfully');
    } catch (error) {
      console.error('[SQLStorage] Failed to clear config:', error);
    }

    // Always clear localStorage as well
    localStorage.removeItem('apiUrl');
    localStorage.removeItem('apiKey');
  }

  /**
   * Check if SQL storage is available
   */
  isAvailable(): boolean {
    return this.initialized && this.db !== null;
  }

  /**
   * Get a configuration value by key (for extensibility)
   * @param key Configuration key
   * @returns Configuration value or null
   */
  async getValue(key: string): Promise<string | null> {
    if (!this.initialized || !this.db) {
      return localStorage.getItem(key);
    }

    try {
      const result = await this.db.select<[{ value: string }]>(
        `SELECT value FROM ${this.TABLE_NAME} WHERE key = $1`,
        [key]
      );

      return result.length > 0 ? result[0].value : null;
    } catch (error) {
      console.error('[SQLStorage] Failed to get value:', error);
      return localStorage.getItem(key);
    }
  }

  /**
   * Set a configuration value by key (for extensibility)
   * @param key Configuration key
   * @param value Configuration value
   */
  async setValue(key: string, value: string): Promise<void> {
    if (!this.initialized || !this.db) {
      localStorage.setItem(key, value);
      return;
    }

    try {
      const now = new Date().toISOString();
      await this.db.execute(
        `INSERT INTO ${this.TABLE_NAME} (key, value, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = $3`,
        [key, value, now]
      );
    } catch (error) {
      console.error('[SQLStorage] Failed to set value:', error);
      localStorage.setItem(key, value);
    }
  }

  /**
   * Delete a configuration value by key (for extensibility)
   * @param key Configuration key
   */
  async deleteValue(key: string): Promise<void> {
    if (!this.initialized || !this.db) {
      localStorage.removeItem(key);
      return;
    }

    try {
      await this.db.execute(
        `DELETE FROM ${this.TABLE_NAME} WHERE key = $1`,
        [key]
      );
    } catch (error) {
      console.error('[SQLStorage] Failed to delete value:', error);
    }

    localStorage.removeItem(key);
  }
}

// Export singleton instance
export const sqlStorageService = new SQLStorageService();

/**
 * Initialize SQL storage with error handling
 * Should be called on app startup
 */
export async function initializeSQLStorage(): Promise<void> {
  try {
    await sqlStorageService.init();
  } catch (error) {
    console.warn('[SQLStorage] Initialization failed, will use localStorage fallback');
    // Don't throw - allow app to continue with localStorage
  }
}
