// Enhanced USGS Water Data Service
// Handles real-time streamflow data with caching and error handling

import { cacheService } from '../utils/cacheService';

const USGS_BASE_URL = 'https://waterservices.usgs.gov/nwis/iv'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds

// Colorado Plateau bounds for geographic context
export const COLORADO_PLATEAU_BOUNDS = {
  north: 40.5,
  south: 35.0,
  east: -106.0,
  west: -114.0
}

/**
 * Create cache key for data requests
 */
const createCacheKey = (siteNo, days) => `usgs-${siteNo}-${days}`

/**
 * Enhanced error handling for API requests
 */
const handleApiError = (error, siteNo) => {
  console.error(`USGS API Error for site ${siteNo}:`, error)
  
  if (error.name === 'AbortError') {
    throw new Error(`Request timeout for site ${siteNo}`)
  }
  
  if (error.response) {
    const status = error.response.status
    if (status === 404) {
      throw new Error(`Site ${siteNo} not found`)
    } else if (status === 429) {
      throw new Error('API rate limit exceeded. Please try again later.')
    } else if (status >= 500) {
      throw new Error('USGS service temporarily unavailable')
    }
  }
  
  throw new Error(`Failed to fetch data for site ${siteNo}: ${error.message}`)
}

/**
 * Fetch streamflow data for a specific site
 * @param {string} siteNo - USGS site number
 * @param {number} days - Number of days to fetch (default: 7)
 * @returns {Promise<Array>} Processed streamflow data
 */
export const fetchStreamflowData = async (siteNo, days = 7) => {
  const cacheKey = createCacheKey(siteNo, days);
  
  // Try to get from cache first
  try {
    const cachedData = cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`Using cached data for site ${siteNo}`);
      return cachedData;
    }
  } catch (error) {
    console.error('Cache read error:', error);
    // Continue with API fetch if cache read fails
  }
  
  // Set up AbortController for request timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
  
  try {
    // Build URL with required parameters
    const params = new URLSearchParams({
      format: 'json',
      sites: siteNo,
      period: `P${days}D`,
      parameterCd: '00060', // Streamflow
      siteStatus: 'all',
      siteType: 'ST', // Stream
      hasDataTypeCd: 'iv,id', // Instantaneous and daily values
      outputDataTypeCd: 'iv' // Prefer instantaneous
    });
    
    const url = `${USGS_BASE_URL}?${params}`;
    
    console.log(`Fetching data for site ${siteNo} from USGS API...`);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const processedData = processStreamflowData(data, siteNo);
    
    // Cache the response
    try {
      cacheService.set(cacheKey, processedData, { ttl: CACHE_DURATION });
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
    
    return processedData;
  } catch (error) {
    clearTimeout(timeoutId);
    handleApiError(error, siteNo);
  }
};

/**
 * Process raw USGS API response into clean data structure
 */
const processStreamflowData = (apiResponse, siteNo) => {
  try {
    const timeSeries = apiResponse?.value?.timeSeries
    
    if (!timeSeries || timeSeries.length === 0) {
      console.warn(`No time series data found for site ${siteNo}`)
      return []
    }
    
    const streamflowSeries = timeSeries.find(ts => 
      ts.variable?.variableCode?.[0]?.value === '00060'
    )
    
    if (!streamflowSeries?.values?.[0]?.value) {
      console.warn(`No streamflow values found for site ${siteNo}`)
      return []
    }
    
    return streamflowSeries.values[0].value.map(point => ({
      dateTime: new Date(point.dateTime),
      value: parseFloat(point.value),
      qualifiers: point.qualifiers || [],
      // Add data quality indicator
      quality: point.qualifiers?.includes('P') ? 'provisional' : 'approved'
    })).filter(point => !isNaN(point.value)) // Remove invalid values
    
  } catch (error) {
    console.error(`Error processing data for site ${siteNo}:`, error)
    return []
  }
}

/**
 * Fetch current conditions for multiple sites (for map markers)
 * @param {Array<string>} siteNumbers - Array of USGS site numbers
 * @returns {Promise<Object>} Site conditions keyed by site number
 */
export const fetchMultipleSiteConditions = async (siteNumbers) => {
  if (!siteNumbers || siteNumbers.length === 0) {
    return {};
  }
  
  const cacheKey = `usgs-multi-${siteNumbers.sort().join('-')}`;
  
  // Try to get from cache first
  try {
    const cachedData = cacheService.get(cacheKey);
    if (cachedData) {
      console.log('Using cached site conditions');
      return cachedData;
    }
  } catch (error) {
    console.error('Cache read error:', error);
    // Continue with API fetch if cache read fails
  }
  
  const chunkSize = 20; // USGS has a limit on the number of sites per request
  const chunks = [];
  
  // Split sites into chunks
  for (let i = 0; i < siteNumbers.length; i += chunkSize) {
    chunks.push(siteNumbers.slice(i, i + chunkSize));
  }
  
  try {
    const results = {};
    
    // Process each chunk in parallel
    await Promise.all(chunks.map(async (chunk) => {
      const params = new URLSearchParams({
        format: 'json',
        sites: chunk.join(','),
        parameterCd: '00060,00065', // Streamflow and Gage height
        siteStatus: 'active',
        siteType: 'ST',
        hasDataTypeCd: 'iv',
        outputDataTypeCd: 'iv'
      });
      
      const url = `${USGS_BASE_URL}?${params}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Process each site in the response
      if (data.value && data.value.timeSeries) {
        data.value.timeSeries.forEach((series) => {
          const siteNo = series.sourceInfo.siteCode[0].value;
          const paramCode = series.variable.variableCode[0].value;
          const latestValue = series.values[0].value[0];
          
          if (!results[siteNo]) {
            results[siteNo] = {
              siteNo,
              name: series.sourceInfo.siteName,
              lastUpdated: new Date(latestValue.dateTime).toISOString()
            };
          }
          
          // Add parameter values
          if (paramCode === '00060') {
            results[siteNo].streamflow = {
              value: parseFloat(latestValue.value),
              unit: series.variable.unit.unitCode
            };
          } else if (paramCode === '00065') {
            results[siteNo].gageHeight = {
              value: parseFloat(latestValue.value),
              unit: series.variable.unit.unitCode
            };
          }
        });
      }
    }));
    
    // Cache the results
    try {
      cacheService.set(cacheKey, results, { ttl: CACHE_DURATION });
    } catch (error) {
      console.error('Failed to cache site conditions:', error);
    }
    
    return results;
  } catch (error) {
    console.error('Error fetching multiple site conditions:', error);
    throw new Error('Failed to fetch site conditions');
  }
};

/**
 * Get site information and metadata
 * @param {string} siteNo - USGS site number
 * @returns {Promise<Object>} Site metadata
 */
export const fetchSiteInfo = async (siteNo) => {
  const cacheKey = `info-${siteNo}`;
  
  // Try to get from cache first
  try {
    const cachedData = cacheService.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }
  } catch (error) {
    console.error('Cache read error:', error);
    // Continue with API fetch if cache read fails
  }
  
  const url = `https://waterservices.usgs.gov/nwis/site/?format=json&sites=${siteNo}&siteOutput=expanded`
  
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    
    const data = await response.json()
    const siteInfo = data?.value?.timeSeries?.[0] || {}
    
    const processedInfo = {
      name: siteInfo.sourceInfo?.siteName || 'Unknown Site',
      location: {
        latitude: parseFloat(siteInfo.sourceInfo?.geoLocation?.geogLocation?.latitude),
        longitude: parseFloat(siteInfo.sourceInfo?.geoLocation?.geogLocation?.longitude)
      },
      drainage: siteInfo.sourceInfo?.siteProperty?.find(prop => 
        prop.name === 'Drainage area'
      )?.value,
      elevation: siteInfo.sourceInfo?.elevation_va
    }
    
    // Cache for longer since site info doesn't change often
    try {
      cacheService.set(cacheKey, processedInfo, { ttl: 24 * 60 * 60 * 1000 }); // 1 day
    } catch (error) {
      console.error('Failed to cache site info:', error);
    }
    
    return processedInfo
    
  } catch (error) {
    handleApiError(error, siteNo)
  }
}

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
