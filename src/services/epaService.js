// EPA Water Quality Data Service
// Handles water quality data from the EPA's Water Quality Portal

import { cacheService } from '../utils/cacheService';

const EPA_BASE_URL = 'https://www.waterqualitydata.us/data/Result/search';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Create cache key for data requests
 */
const createCacheKey = (params) => {
  return `epa-${Object.entries(params)
    .sort()
    .map(([key, value]) => `${key}:${value}`)
    .join('|')}`;
};

/**
 * Enhanced error handling for EPA API requests
 */
const handleApiError = (error, context = '') => {
  console.error(`EPA API Error${context ? ` (${context})` : ''}:`, error)
  
  if (error.name === 'AbortError') {
    throw new Error('Request timeout' + (context ? ` for ${context}` : ''))
  }
  
  if (error.response) {
    const status = error.response.status
    if (status === 400) {
      throw new Error('Invalid request parameters' + (context ? ` for ${context}` : ''))
    } else if (status === 404) {
      throw new Error('Requested data not found' + (context ? ` for ${context}` : ''))
    } else if (status === 429) {
      throw new Error('API rate limit exceeded. Please try again later.')
    } else if (status >= 500) {
      throw new Error('EPA Water Quality service temporarily unavailable')
    }
  }
  
  throw new Error(`Failed to fetch EPA data${context ? ` for ${context}` : ''}: ${error.message}`)
}

/**
 * Fetch water quality data for a specific location
 * @param {Object} params - Query parameters
 * @param {number} params.latitude - Latitude of the location
 * @param {number} params.longitude - Longitude of the location
 * @param {number} [params.radius=10] - Search radius in miles (default: 10)
 * @param {string} [params.startDate] - Start date in YYYY-MM-DD format (default: 30 days ago)
 * @param {string} [params.endDate] - End date in YYYY-MM-DD format (default: today)
 * @param {Array<string>} [params.characteristicNames] - Array of water quality characteristic names to filter by
 * @returns {Promise<Array>} Processed water quality data
 */
export const fetchWaterQualityData = async ({
  latitude,
  longitude,
  radius = 10,
  startDate,
  endDate,
  characteristicNames = []
} = {}) => {
  // Validate required parameters
  if (latitude === undefined || longitude === undefined) {
    throw new Error('Latitude and longitude are required');
  }

  // Set default date range if not provided
  const end = endDate || new Date().toISOString().split('T')[0];
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Create cache key
  const cacheParams = {
    lat: latitude.toFixed(4),
    lng: longitude.toFixed(4),
    radius,
    startDate: start,
    endDate: end,
    characteristics: characteristicNames.sort().join(',')
  };
  
  const cacheKey = createCacheKey(cacheParams);
  
  // Try to get from cache first
  try {
    const cachedData = cacheService.get(cacheKey);
    if (cachedData) {
      console.log('Using cached water quality data');
      return cachedData;
    }
  } catch (error) {
    console.error('Cache read error:', error);
    // Continue with API fetch if cache read fails
  }

  // Set up API request parameters
  const params = new URLSearchParams({
    latitude: latitude,
    longitude: longitude,
    within: radius, // miles
    startDateLo: start,
    startDateHi: end,
    dataProfile: 'resultPhysChem',
    sorted: 'desc',
    mimeType: 'json',
    zip: 'no',
    providers: 'STEWARDS,STORET,NWIS'
  });

  // Add characteristic names filter if provided
  if (characteristicNames && characteristicNames.length > 0) {
    characteristicNames.forEach(name => {
      params.append('characteristicName', name);
    });
  }

  const url = `${EPA_BASE_URL}?${params.toString()}`;
  
  try {
    console.log('Fetching water quality data from EPA API...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Process and validate data
    const processedData = processWaterQualityData(data, { latitude, longitude });
    
    // Cache the results
    try {
      cacheService.set(cacheKey, processedData, { ttl: CACHE_DURATION });
    } catch (error) {
      console.error('Failed to cache water quality data:', error);
    }
    
    return processedData;
    
  } catch (error) {
    handleApiError(error, `location (${latitude}, ${longitude})`);
  }
};

/**
 * Process raw EPA API response into clean data structure
 */
const processWaterQualityData = (apiResponse, location) => {
  if (!apiResponse || !apiResponse.Results || !Array.isArray(apiResponse.Results.Result)) {
    return []
  }

  // Group results by monitoring location and characteristic
  const resultsByLocation = {}
  
  apiResponse.Results.Result.forEach(result => {
    const locationKey = result.MonitoringLocationIdentifier || 'unknown'
    const charName = result.CharacteristicName || 'Unknown'
    
    if (!resultsByLocation[locationKey]) {
      resultsByLocation[locationKey] = {
        locationId: locationKey,
        locationName: result.MonitoringLocationName || 'Unnamed Location',
        latitude: parseFloat(result.LatitudeMeasure) || location.latitude,
        longitude: parseFloat(result.LongitudeMeasure) || location.longitude,
        characteristics: {}
      }
    }
    
    const locationData = resultsByLocation[locationKey]
    
    if (!locationData.characteristics[charName]) {
      locationData.characteristics[charName] = {
        name: charName,
        unit: result.ResultMeasure.MeasureUnitCode || '',
        values: [],
        lastUpdated: null
      }
    }
    
    const charData = locationData.characteristics[charName]
    
    // Parse the value, handling different possible formats
    let value = null
    if (result.ResultMeasureValue) {
      value = parseFloat(result.ResultMeasureValue)
      if (isNaN(value)) {
        value = result.ResultMeasureValue // Keep as string if not a number
      }
    }
    
    // Parse the date
    const date = result.ActivityStartDate ? new Date(result.ActivityStartDate) : new Date()
    
    charData.values.push({
      value,
      date,
      status: result.ResultStatusIdentifier || 'Unknown',
      sampleMedia: result.ActivityMediaName || 'Unknown',
      sampleType: result.ActivityTypeCode || 'Unknown'
    })
    
    // Update last updated date if this is newer
    if (!charData.lastUpdated || date > new Date(charData.lastUpdated)) {
      charData.lastUpdated = date
    }
  })
  
  // Convert to array and sort by location name
  return Object.values(resultsByLocation).map(location => ({
    ...location,
    characteristics: Object.values(location.characteristics).map(char => ({
      ...char,
      // Sort values by date (newest first)
      values: char.values.sort((a, b) => b.date - a.date)
    }))
  })).sort((a, b) => a.locationName.localeCompare(b.locationName))
}

/**
 * Get list of available water quality characteristic names
 * @returns {Promise<Array>} List of characteristic names and their metadata
 */
export const getCharacteristicNames = async () => {
  const cacheKey = 'epa-characteristic-names';
  
  // Try to get from cache first
  try {
    const cachedData = cacheService.get(cacheKey);
    if (cachedData) {
      console.log('Using cached characteristic names');
      return cachedData;
    }
  } catch (error) {
    console.error('Cache read error:', error);
    // Continue with API fetch if cache read fails
  }
  
  const url = 'https://www.waterqualitydata.us/Codes/characteristicname?mimeType=json';
  
  try {
    console.log('Fetching characteristic names from EPA API...');
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.codes || !Array.isArray(data.codes)) {
      throw new Error('Invalid response format from EPA API');
    }
    
    // Process the results
    const characteristicNames = data.codes.map(item => ({
      code: item.value,
      name: item.desc,
      group: item.group
    }));
    
    // Cache the results (longer TTL since this doesn't change often)
    try {
      cacheService.set(cacheKey, characteristicNames, { ttl: 7 * 24 * 60 * 60 * 1000 }); // 1 week
    } catch (error) {
      console.error('Failed to cache characteristic names:', error);
    }
    
    return characteristicNames;
    
  } catch (error) {
    handleApiError(error, 'fetching characteristic names');
  }
};

/**
 * Clear the data cache (useful for testing or manual refresh)
 * @deprecated Use cacheService.clear() instead
 */
export const clearCache = () => {
  console.warn('clearCache() is deprecated. Use cacheService.clear() instead.');
  cacheService.clear();
};

/**
 * Get cache statistics for debugging
 * @deprecated Use cacheService.getStats() instead
 */
export const getCacheStats = () => {
  console.warn('getCacheStats() is deprecated. Use cacheService.getStats() instead.');
  return cacheService.getStats();
};
