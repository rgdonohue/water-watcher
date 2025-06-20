// 🌊 USGS Water Data Service
// Generated from Colorado Plateau ESDA analysis

const USGS_BASE_URL = 'https://waterservices.usgs.gov/nwis';

// San Juan River Basin focus area (from data analysis)
export const FOCUS_BOUNDS = {
  north: 37.5,
  south: 36.5,
  east: -107.5,
  west: -109.0
};

// Priority parameter codes
export const PARAMETERS = {
  DISCHARGE: '00060',
  GAGE_HEIGHT: '00065',
  TEMPERATURE: '00010',
  CONDUCTANCE: '00095',
  DISSOLVED_OXYGEN: '00300',
  PH: '00400'
};

/**
 * Convert days to USGS period format
 * @param {number} days - Number of days
 * @returns {string} ISO 8601 period format
 */
function formatPeriod(days) {
  if (days <= 1) return 'P1D';
  if (days <= 7) return 'P7D';
  if (days <= 30) return 'P30D';
  return 'P1Y';
}

/**
 * Fetch current streamflow data for a site
 * @param {string} siteNo - USGS site number
 * @param {number} days - Number of days of data to fetch
 * @returns {Promise<Array>} Streamflow data array
 */
export async function fetchStreamflowData(siteNo, days = 7) {
  const period = formatPeriod(days);
  const params = new URLSearchParams({
    format: 'json',
    sites: siteNo,
    period: period,
    parameterCd: PARAMETERS.DISCHARGE,
    siteStatus: 'all'
  });

  try {
    const response = await fetch(`${USGS_BASE_URL}/iv/?${params}`);

    if (!response.ok) {
      throw new Error(`USGS API error: ${response.status}`);
    }

    const data = await response.json();
    const parsed = parseStreamflowResponse(data);
    
    // Return just the data array for easier use in components
    return parsed.data || [];

  } catch (error) {
    console.error('Error fetching streamflow data:', error);
    
    // Return mock data for development when API fails
    return generateMockData(siteNo, days);
  }
}

/**
 * Generate mock streamflow data for development/fallback
 * @param {string} siteNo - USGS site number
 * @param {number} days - Number of days
 * @returns {Array} Mock data array
 */
function generateMockData(siteNo, days) {
  console.warn(`Using mock data for site ${siteNo} - API unavailable`);
  
  const mockData = [];
  const now = new Date();
  const baseFlow = Math.random() * 1000 + 500; // Random base flow 500-1500 cfs
  
  for (let i = days * 96; i >= 0; i--) { // 96 readings per day (15 min intervals)
    const date = new Date(now.getTime() - (i * 15 * 60 * 1000));
    const variation = (Math.random() - 0.5) * 200; // ±100 cfs variation
    const flow = Math.max(10, baseFlow + variation);
    
    mockData.push({
      dateTime: date.toISOString(),
      value: Math.round(flow),
      qualifiers: ['P'] // Provisional
    });
  }
  
  return mockData;
}

/**
 * Parse USGS API response into clean format
 * @param {Object} apiResponse - Raw USGS API response
 * @returns {Object} Parsed data
 */
function parseStreamflowResponse(apiResponse) {
  try {
    const timeSeries = apiResponse.value?.timeSeries?.[0];

    if (!timeSeries) {
      console.warn('No time series data found in USGS response');
      return { data: [], error: 'No data available' };
    }

    const siteInfo = timeSeries.sourceInfo;
    const values = timeSeries.values?.[0]?.value || [];

    const readings = values.map(reading => ({
      dateTime: reading.dateTime,
      value: parseFloat(reading.value),
      qualifiers: reading.qualifiers || []
    })).filter(reading => !isNaN(reading.value));

    return {
      site: {
        siteCode: siteInfo.siteCode?.[0]?.value || 'Unknown',
        siteName: siteInfo.siteName || 'Unknown Site',
        latitude: siteInfo.geoLocation?.geogLocation?.latitude || 0,
        longitude: siteInfo.geoLocation?.geogLocation?.longitude || 0
      },
      parameter: {
        code: timeSeries.variable?.variableCode?.[0]?.value || '00060',
        name: timeSeries.variable?.variableName || 'Streamflow',
        unit: timeSeries.variable?.unit?.unitAbbreviation || 'cfs'
      },
      data: readings,
      stats: readings.length > 0 ? {
        current: readings[readings.length - 1]?.value,
        average: readings.reduce((sum, r) => sum + r.value, 0) / readings.length,
        min: Math.min(...readings.map(r => r.value)),
        max: Math.max(...readings.map(r => r.value))
      } : null
    };
  } catch (error) {
    console.error('Error parsing USGS response:', error);
    return { data: [], error: 'Failed to parse response' };
  }
}

/**
 * Assess flow conditions based on statistical analysis
 * @param {number} currentFlow - Current discharge value
 * @param {number} averageFlow - Average discharge value
 * @returns {Object} Flow assessment
 */
export function assessFlowConditions(currentFlow, averageFlow) {
  const ratio = currentFlow / averageFlow;

  if (ratio < 0.5) {
    return { status: 'LOW', color: '#d32f2f', description: 'Below normal flow' };
  } else if (ratio > 1.5) {
    return { status: 'HIGH', color: '#388e3c', description: 'Above normal flow' };
  } else {
    return { status: 'NORMAL', color: '#1976d2', description: 'Normal flow conditions' };
  }
}
