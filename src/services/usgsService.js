// Enhanced USGS Water Data Service
// Handles real-time streamflow data with caching and error handling

import { cacheService } from '../utils/cacheService';

// Use proxy endpoints in development, direct URLs in production
const isDevelopment = import.meta.env.DEV;
const USGS_BASE_URL = isDevelopment ? '/api/usgs/nwis/iv' : 'https://waterservices.usgs.gov/nwis/iv'
const USGS_SITE_URL = isDevelopment ? '/api/usgs/nwis/site' : 'https://waterservices.usgs.gov/nwis/site'
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
const createCacheKey = (siteNo, period) => `usgs-${siteNo}-${period}`

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
 * @param {string|number} period - Period string (e.g., 'P7D') or number of days (for backward compatibility)
 * @returns {Promise<Object>} Raw USGS API response
 */
export const fetchStreamflowData = async (siteNo, period = 'P7D') => {
  // Validate input parameters
  if (!siteNo || typeof siteNo !== 'string') {
    throw new Error('Invalid site number provided');
  }
  
  // Handle both period strings (P7D) and number of days for backward compatibility
  let validatedPeriod;
  if (typeof period === 'string' && period.match(/^P\d+(D|Y)$/)) {
    // It's already a valid period string like "P7D" or "P365D"
    validatedPeriod = period;
      } else {
      // Convert days number to period string
      const days = Math.min(Math.max(1, parseInt(period, 10)), 365);
      validatedPeriod = `P${days}D`;
    }
  
  const cacheKey = createCacheKey(siteNo, validatedPeriod);
  
  // Try to get from cache first
  try {
    const cachedData = cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`[USGS] Using cached data for site ${siteNo}`);
      return cachedData;
    }
  } catch (error) {
    console.error('[USGS] Cache read error:', error);
    // Continue with API fetch if cache read fails
  }
  
  // Set up AbortController for request timeout (30 second timeout)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  try {
    // Build URL with simplified, known-working parameters
    const params = new URLSearchParams({
      format: 'json',
      sites: siteNo,
      period: validatedPeriod,
      parameterCd: '00060' // Streamflow parameter code
    });
    
    const url = `${USGS_BASE_URL}?${params}`;
    console.log(`[USGS] Fetching data from: ${url}`);
    
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
      const errorText = await response.text();
      console.error(`[USGS] API Error ${response.status} for site ${siteNo}:`, errorText);
      
      if (response.status === 400) {
        // Try to parse the error response for more details
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.message) {
            throw new Error(`USGS API Error: ${errorData.error.message}`);
          }
        } catch (e) {
          // If we can't parse the error, use a generic message
          throw new Error(`Invalid request for site ${siteNo}. The site may not exist or the parameters may be invalid.`);
        }
      }
      
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
        // Process the response
    const data = await response.json();
    
    // Check if we got valid data
    if (!data || !data.value || !data.value.timeSeries) {
      console.error('[USGS] Invalid response format:', data);
      throw new Error('Invalid response format from USGS API');
    }

    // Cache the raw data (so modal can process it as needed)
    try {
      console.log(`[USGS] Caching data for site ${siteNo} period ${validatedPeriod}`);
      cacheService.set(cacheKey, data, CACHE_DURATION);
    } catch (error) {
      console.error('[USGS] Cache write error:', error);
      // Don't fail the request if cache write fails
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Log additional error details for debugging
    if (error.name === 'AbortError') {
      console.error(`[USGS] Request timeout for site ${siteNo}`);
    } else if (error.response) {
      console.error(`[USGS] API Error for site ${siteNo}:`, {
        status: error.response.status,
        statusText: error.response.statusText,
        url: error.response.url
      });
    } else {
      console.error(`[USGS] Error fetching data for site ${siteNo}:`, error);
    }
    
    // Rethrow the error with user-friendly message
    throw handleApiError(error, siteNo);
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
 * Fetch current conditions for multiple sites (for map markers) - IMPROVED VERSION
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
        parameterCd: '00060' // Streamflow only
      });
      
      const url = `${USGS_BASE_URL}?${params}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`USGS API error for chunk: ${response.status}`);
        // Don't throw - allow other chunks to succeed
        return;
      }
      
      const data = await response.json();
      
      // Process each site in the response
      if (data.value && data.value.timeSeries) {
        data.value.timeSeries.forEach((series) => {
          try {
            const siteNo = series.sourceInfo.siteCode[0].value;
            const latestValue = series.values[0]?.value?.[0];
            
            if (!latestValue) {
              // Site exists but has no current data
              results[siteNo] = {
                status: 'offline',
                currentFlow: null,
                lastUpdate: null
              };
              return;
            }
            
            const flowValue = parseFloat(latestValue.value);
            
            results[siteNo] = {
              status: !isNaN(flowValue) ? 'online' : 'offline',
              currentFlow: !isNaN(flowValue) ? flowValue : null,
              lastUpdate: latestValue.dateTime ? new Date(latestValue.dateTime).toISOString() : null
            };
          } catch (error) {
            console.error('Error processing site data:', error);
            // Continue processing other sites
          }
        });
      }
    }));
    
    // Ensure all requested sites have an entry (mark missing ones as offline)
    siteNumbers.forEach(siteNo => {
      if (!results[siteNo]) {
        results[siteNo] = {
          status: 'offline',
          currentFlow: null,
          lastUpdate: null
        };
      }
    });
    
    // Cache the results
    try {
      cacheService.set(cacheKey, results, CACHE_DURATION);
    } catch (error) {
      console.error('Failed to cache site conditions:', error);
    }
    
    return results;
  } catch (error) {
    console.error('Error fetching multiple site conditions:', error);
    // Fallback: return offline status for all sites
    const fallbackResults = {};
    siteNumbers.forEach(siteNo => {
      fallbackResults[siteNo] = {
        status: 'offline',
        currentFlow: null,
        lastUpdate: null
      };
    });
    return fallbackResults;
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
  
  const url = `${USGS_SITE_URL}/?format=json&sites=${siteNo}&siteOutput=expanded`
  
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
      cacheService.set(cacheKey, processedInfo, 24 * 60 * 60 * 1000); // 1 day
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
