/**
 * Service for fetching drought data from NOAA's National Integrated Drought Information System (NIDS)
 * 
 * This service provides functions to retrieve current drought conditions and forecasts
 * from NOAA's drought monitoring services.
 */

// Base URL for NOAA's drought monitoring services
const BASE_URL = 'https://usdmdataservices.unl.edu/api';

// Cache configuration
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
let cache = new Map();

/**
 * Fetches current drought conditions for a specific geographic area
 * @param {Object} bounds - Map bounds object with north, south, east, west properties
 * @param {string} [statisticsType='1'] - Type of statistics (1=county, 2=state, 3=HUC)
 * @returns {Promise<Array>} - Array of drought condition data
 */
export const fetchCurrentDroughtConditions = async (bounds, statisticsType = '1') => {
  const cacheKey = `drought-${statisticsType}-${JSON.stringify(bounds)}`;
  const cached = cache.get(cacheKey);
  
  // Return cached data if it's still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const params = new URLSearchParams({
      statisticsType,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 30 days
      endDate: new Date().toISOString().split('T')[0],
      format: 'json',
      in_BBox: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`
    });

    const response = await fetch(`${BASE_URL}/currentconditions/currentdroughtconditions?${params}`);
    
    if (!response.ok) {
      throw new Error(`NOAA API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Cache the response
    cache.set(cacheKey, {
      timestamp: Date.now(),
      data
    });
    
    return data;
  } catch (error) {
    console.error('Error fetching drought conditions:', error);
    throw new Error('Failed to fetch drought conditions. Please try again later.');
  }
};

/**
 * Fetches drought forecast data for a specific geographic area
 * @param {Object} bounds - Map bounds object with north, south, east, west properties
 * @returns {Promise<Array>} - Array of drought forecast data
 */
export const fetchDroughtForecast = async (bounds) => {
  const cacheKey = `drought-forecast-${JSON.stringify(bounds)}`;
  const cached = cache.get(cacheKey);
  
  // Return cached data if it's still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const params = new URLSearchParams({
      bbox: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
      format: 'json',
      time: 'latest'
    });

    const response = await fetch(`${BASE_URL}/droughtforecast?${params}`);
    
    if (!response.ok) {
      throw new Error(`NOAA forecast API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Cache the response
    cache.set(cacheKey, {
      timestamp: Date.now(),
      data
    });
    
    return data;
  } catch (error) {
    console.error('Error fetching drought forecast:', error);
    throw new Error('Failed to fetch drought forecast. Please try again later.');
  }
};

/**
 * Clears the cache for testing or when fresh data is needed
 */
export const clearCache = () => {
  cache.clear();
};

/**
 * Gets cache statistics for debugging
 * @returns {Object} Cache statistics
 */
export const getCacheStats = () => {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
};
