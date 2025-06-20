// Enhanced USGS Water Data Service
// Handles real-time streamflow data with caching and error handling

const USGS_BASE_URL = 'https://waterservices.usgs.gov/nwis/iv'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds

// In-memory cache for API responses
const dataCache = new Map()

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
const createCacheKey = (siteNo, days) => `${siteNo}-${days}`

/**
 * Check if cached data is still valid
 */
const isCacheValid = (cachedData) => {
  if (!cachedData) return false
  return Date.now() - cachedData.timestamp < CACHE_DURATION
}

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
  const cacheKey = createCacheKey(siteNo, days)
  const cachedData = dataCache.get(cacheKey)
  
  // Return cached data if valid
  if (isCacheValid(cachedData)) {
    console.log(`Using cached data for site ${siteNo}`)
    return cachedData.data
  }

  // Calculate date range
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000))
  
  const params = new URLSearchParams({
    format: 'json',
    sites: siteNo,
    parameterCd: '00060', // Streamflow parameter code
    startDT: startDate.toISOString().split('T')[0],
    endDT: endDate.toISOString().split('T')[0],
    siteStatus: 'all'
  })

  const url = `${USGS_BASE_URL}?${params}`
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    // Process and validate data
    const processedData = processStreamflowData(data, siteNo)
    
    // Cache the results
    dataCache.set(cacheKey, {
      data: processedData,
      timestamp: Date.now()
    })
    
    return processedData
    
  } catch (error) {
    handleApiError(error, siteNo)
  }
}

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
  const conditions = {}
  
  // Process sites in batches to avoid overwhelming the API
  const batchSize = 3
  for (let i = 0; i < siteNumbers.length; i += batchSize) {
    const batch = siteNumbers.slice(i, i + batchSize)
    
    const promises = batch.map(async (siteNo) => {
      try {
        const data = await fetchStreamflowData(siteNo, 1) // Just current day
        conditions[siteNo] = {
          status: 'online',
          currentFlow: data.length > 0 ? data[data.length - 1].value : null,
          lastUpdate: data.length > 0 ? data[data.length - 1].dateTime : null,
          dataQuality: data.length > 0 ? data[data.length - 1].quality : null
        }
      } catch (error) {
        conditions[siteNo] = {
          status: 'offline',
          currentFlow: null,
          lastUpdate: null,
          error: error.message
        }
      }
    })
    
    await Promise.all(promises)
    
    // Small delay between batches to be respectful to the API
    if (i + batchSize < siteNumbers.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  return conditions
}

/**
 * Get site information and metadata
 * @param {string} siteNo - USGS site number
 * @returns {Promise<Object>} Site metadata
 */
export const fetchSiteInfo = async (siteNo) => {
  const cacheKey = `info-${siteNo}`
  const cachedData = dataCache.get(cacheKey)
  
  if (isCacheValid(cachedData)) {
    return cachedData.data
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
    dataCache.set(cacheKey, {
      data: processedInfo,
      timestamp: Date.now()
    })
    
    return processedInfo
    
  } catch (error) {
    handleApiError(error, siteNo)
  }
}

/**
 * Clear the data cache (useful for testing or manual refresh)
 */
export const clearCache = () => {
  dataCache.clear()
  console.log('USGS data cache cleared')
}

/**
 * Get cache statistics for debugging
 */
export const getCacheStats = () => ({
  size: dataCache.size,
  keys: Array.from(dataCache.keys()),
  totalMemory: JSON.stringify(Array.from(dataCache.values())).length
})
