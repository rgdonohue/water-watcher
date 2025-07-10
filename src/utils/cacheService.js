/**
 * Cache Service
 * 
 * A unified caching solution for the application that provides:
 * - In-memory caching with configurable TTL (time-to-live)
 * - Persistent storage using localStorage for offline support
 * - Automatic cache invalidation
 * - Cache statistics and management
 */

const CACHE_PREFIX = 'water-watcher-cache-';
const CACHE_VERSION = 'v1';
const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      memorySize: 0,
      storageSize: 0,
      lastCleaned: Date.now()
    };
    
    // Clean up expired items every hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }
  
  /**
   * Generate a cache key with prefix and version
   * @private
   */
  _getCacheKey(key) {
    return `${CACHE_PREFIX}${CACHE_VERSION}-${key}`;
  }
  
  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @param {Object} options - Cache options
   * @param {boolean} [options.allowExpired=false] - Return expired items
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key, { allowExpired = false } = {}) {
    const cacheKey = this._getCacheKey(key);
    let hit = false;
    let result = null;
    
    // Try memory cache first
    if (this.memoryCache.has(cacheKey)) {
      const { value, expires } = this.memoryCache.get(cacheKey);
      
      if (!expires || expires > Date.now() || allowExpired) {
        hit = true;
        result = value;
      } else {
        // Remove expired item from memory
        this.memoryCache.delete(cacheKey);
      }
    }
    
    // If not found in memory, try localStorage
    if (!hit && typeof window !== 'undefined' && window.localStorage) {
      try {
        const item = localStorage.getItem(cacheKey);
        if (item) {
          try {
            const { value, expires } = JSON.parse(item);
            
            if (!expires || expires > Date.now() || allowExpired) {
              // Add to memory cache directly to avoid double-counting hits
              const ttl = expires ? expires - Date.now() : null;
              const cacheKey = this._getCacheKey(key);
              this.memoryCache.set(cacheKey, {
                value,
                expires: ttl ? Date.now() + ttl : null
              });
              hit = true;
              result = value;
            } else {
              // Remove expired item from storage
              localStorage.removeItem(cacheKey);
            }
          } catch (parseError) {
            // If we can't parse the item, remove it from storage
            this.error('Error parsing cached item, removing:', parseError);
            localStorage.removeItem(cacheKey);
          }
        }
      } catch (error) {
        this.error('Error reading from localStorage:', error);
      }
    }
    
    // Update stats
    if (hit) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    
    return result;
  }
  
  /**
   * Error handling helper
   */
  error(message, error) {
    if (process.env.NODE_ENV !== 'test' || process.env.DEBUG === 'true') {
      console.error(message, error);
    }
    // Don't return anything to allow the error to propagate if needed
  }
  
  /**
   * Set item in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache (must be serializable)
   * @param {Object} options - Cache options
   * @param {number} [options.ttl] - Time to live in milliseconds
   * @param {boolean} [options.persist=true] - Whether to persist to localStorage
   */
  set(key, value, { ttl = DEFAULT_TTL, persist = true } = {}) {
    if (!key) return;
    
    const cacheKey = this._getCacheKey(key);
    const expires = Date.now() + ttl;
    const cacheItem = { value, expires };
    
    // Store in memory
    this.memoryCache.set(cacheKey, cacheItem);
    this.stats.memorySize = this._calculateMemorySize();
    
    // Persist to localStorage if enabled
    if (persist && typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
      } catch (error) {
        this.error('Error writing to localStorage:', error);
        // If we hit storage quota, clear old items and try again
        if (error.name === 'QuotaExceededError') {
          this.clearExpired();
          try {
            localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
          } catch (retryError) {
            this.error('Failed to write to localStorage after cleanup:', retryError);
          }
        }
      }
    }
  }
  
  /**
   * Remove item from cache
   * @param {string} key - Cache key to remove
   */
  remove(key) {
    const cacheKey = this._getCacheKey(key);
    this.memoryCache.delete(cacheKey);
    
    try {
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
    
    this.stats.memorySize = this._calculateMemorySize();
    this.stats.storageSize = this._calculateStorageSize();
  }
  
  /**
   * Clear all cached items (both memory and storage)
   */
  clear() {
    this.memoryCache.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      // Only clear our own keys from localStorage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
    this.stats = {
      hits: 0,
      misses: 0,
      memorySize: 0,
      storageSize: 0,
      lastCleaned: Date.now()
    };
  }
  
  /**
   * Clear expired items from cache
   */
  clearExpired() {
    const now = Date.now();
    let expiredCount = 0;
    
    // Track keys we've already processed to avoid double-counting
    const processedKeys = new Set();
    
    // Clear expired from memory
    for (const [key, { expires }] of this.memoryCache.entries()) {
      if (expires && expires < now) {
        this.memoryCache.delete(key);
        // Extract the original key from the cache key
        const originalKey = key.replace(new RegExp(`^${CACHE_PREFIX}${CACHE_VERSION}-`), '');
        processedKeys.add(originalKey);
        expiredCount++;
      }
    }
    
    // Clear expired from storage
    if (typeof window !== 'undefined' && window.localStorage) {
      // Create a list of keys to remove first to avoid index shifting issues
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          try {
            const itemStr = localStorage.getItem(key);
            if (itemStr) {
              const item = JSON.parse(itemStr);
              const originalKey = key.replace(new RegExp(`^${CACHE_PREFIX}${CACHE_VERSION}-`), '');
              
              // Only count this as expired if we haven't already processed it from memory
              if (item && item.expires && item.expires < now && !processedKeys.has(originalKey)) {
                keysToRemove.push(key);
                expiredCount++;
              } else if (item && item.expires && item.expires < now) {
                // Still remove from storage, but don't count it again
                keysToRemove.push(key);
              }
            }
          } catch (e) {
            // If we can't parse the item, remove it
            keysToRemove.push(key);
            expiredCount++;
          }
        }
      }
      
      // Remove all expired items
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
    
    // Update stats
    this.stats.memorySize = this._calculateMemorySize();
    this.stats.lastCleaned = now;
    
    return expiredCount;
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const totalAccesses = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      memorySize: this._formatBytes(this._calculateMemorySize()),
      storageSize: this._formatBytes(this._calculateStorageSize()),
      hitRatio: totalAccesses > 0 
        ? ((this.stats.hits / totalAccesses) * 100).toFixed(2) + '%' 
        : '0%',
      memoryItemCount: this.memoryCache.size,
      storageItemCount: this._getStorageItemCount(),
      lastCleaned: this.stats.lastCleaned
    };
  }
  
  /**
   * Clean up the cache (alias for clearExpired)
   * @returns {number} Number of expired items removed
   */
  cleanup() {
    return this.clearExpired();
  }
  
  /**
   * Calculate memory usage of cache
   * @private
   */
  _calculateMemorySize() {
    let size = 0;
    for (const [key, value] of this.memoryCache.entries()) {
      try {
        size += new Blob([key]).size;
        size += new Blob([JSON.stringify(value)]).size;
      } catch (e) {
        console.warn('Could not calculate size of item:', key, e);
      }
    }
    return size;
  }
  
  /**
   * Calculate storage usage of cache
   * @private
   */
  _calculateStorageSize() {
    let size = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          const value = localStorage.getItem(key);
          if (value) {
            size += new Blob([key]).size;
            size += new Blob([value]).size;
          }
        }
      }
    } catch (error) {
      console.error('Error calculating storage size:', error);
    }
    return size;
  }
  
  /**
   * Get count of items in storage
   * @private
   */
  _getStorageItemCount() {
    try {
      return Object.keys(localStorage)
        .filter(key => key.startsWith(CACHE_PREFIX))
        .length;
    } catch (error) {
      console.error('Error getting storage item count:', error);
      return 0;
    }
  }
  
  /**
   * Format bytes to human-readable string
   * @private
   */
  _formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

// Export a singleton instance
export const cacheService = new CacheService();

// For testing
export const _testing = {
  CACHE_PREFIX,
  CACHE_VERSION,
  DEFAULT_TTL
};
