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
 * Fetch current streamflow data for a site
 * @param {string} siteNo - USGS site number
 * @param {string} period - Period code (P7D, P30D, P1Y)
 * @returns {Promise<Object>} Streamflow data
 */
export async function fetchStreamflowData(siteNo, period = 'P7D') {
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
    return parseStreamflowResponse(data);

  } catch (error) {
    console.error('Error fetching streamflow data:', error);
    throw error;
  }
}

/**
 * Parse USGS API response into clean format
 * @param {Object} apiResponse - Raw USGS API response
 * @returns {Object} Parsed data
 */
function parseStreamflowResponse(apiResponse) {
  const timeSeries = apiResponse.value?.timeSeries?.[0];

  if (!timeSeries) {
    return { error: 'No data available' };
  }

  const siteInfo = timeSeries.sourceInfo;
  const values = timeSeries.values?.[0]?.value || [];

  const readings = values.map(reading => ({
    dateTime: new Date(reading.dateTime),
    value: parseFloat(reading.value),
    qualifiers: reading.qualifiers || []
  })).filter(reading => !isNaN(reading.value));

  return {
    site: {
      siteCode: siteInfo.siteCode[0].value,
      siteName: siteInfo.siteName,
      latitude: siteInfo.geoLocation.geogLocation.latitude,
      longitude: siteInfo.geoLocation.geogLocation.longitude
    },
    parameter: {
      code: timeSeries.variable.variableCode[0].value,
      name: timeSeries.variable.variableName,
      unit: timeSeries.variable.unit.unitAbbreviation
    },
    data: readings,
    stats: readings.length > 0 ? {
      current: readings[readings.length - 1]?.value,
      average: readings.reduce((sum, r) => sum + r.value, 0) / readings.length,
      min: Math.min(...readings.map(r => r.value)),
      max: Math.max(...readings.map(r => r.value))
    } : null
  };
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
