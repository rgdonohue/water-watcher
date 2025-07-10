import {
  fetchWaterQualityData,
  getCharacteristicNames,
  clearCache,
  getCacheStats
} from '../epaService'

describe('EPA Water Quality Service', () => {
  // Mock fetch before each test
  let originalFetch
  
  beforeEach(() => {
    originalFetch = global.fetch
    clearCache()
    jest.useFakeTimers()
  })
  
  afterEach(() => {
    global.fetch = originalFetch
    jest.useRealTimers()
  })
  
  describe('fetchWaterQualityData', () => {
    it('should fetch water quality data for a location', async () => {
      const mockResponse = {
        Results: {
          Result: [
            {
              MonitoringLocationIdentifier: 'USGS-12345678',
              MonitoringLocationName: 'Test Location',
              LatitudeMeasure: '40.0',
              LongitudeMeasure: '-105.0',
              CharacteristicName: 'pH',
              ResultMeasureValue: '7.5',
              ResultMeasure.MeasureUnitCode: 'std units',
              ActivityStartDate: '2023-01-01',
              ResultStatusIdentifier: 'Valid',
              ActivityMediaName: 'Water',
              ActivityTypeCode: 'Sample'
            }
          ]
        }
      }
      
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
      )
      
      const result = await fetchWaterQualityData({
        latitude: 40.0,
        longitude: -105.0,
        radius: 10,
        characteristicNames: ['pH', 'Dissolved Oxygen']
      })
      
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(1)
      expect(result[0].locationName).toBe('Test Location')
      expect(result[0].characteristics).toHaveProperty('pH')
    })
    
    it('should handle API errors', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })
      )
      
      await expect(
        fetchWaterQualityData({ latitude: 40.0, longitude: -105.0 })
      ).rejects.toThrow('EPA Water Quality service temporarily unavailable')
    })
    
    it('should use cache for subsequent requests', async () => {
      const mockResponse = { Results: { Result: [] } }
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
      )
      
      // First call - should call the API
      await fetchWaterQualityData({ latitude: 40.0, longitude: -105.0 })
      expect(fetch).toHaveBeenCalledTimes(1)
      
      // Second call with same params - should use cache
      await fetchWaterQualityData({ latitude: 40.0, longitude: -105.0 })
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })
  
  describe('getCharacteristicNames', () => {
    it('should fetch and return characteristic names', async () => {
      const mockResponse = {
        Characteristic: [
          { CharacteristicName: 'pH', CharacteristicDescription: 'pH' },
          { CharacteristicName: 'Dissolved Oxygen', CharacteristicDescription: 'Dissolved Oxygen' }
        ]
      }
      
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
      )
      
      const result = await getCharacteristicNames()
      
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('CharacteristicName', 'pH')
    })
  })
  
  describe('cache management', () => {
    it('should clear the cache', () => {
      // Add something to the cache
      const cacheKey = 'test-key'
      const cache = getCacheStats()
      const initialSize = cache.size
      
      // Add an item to the cache
      const testData = { timestamp: Date.now(), data: 'test' }
      const internalCache = require('../epaService').__getCache()
      internalCache.set(cacheKey, testData)
      
      // Verify it was added
      expect(getCacheStats().size).toBe(initialSize + 1)
      
      // Clear cache and verify
      clearCache()
      expect(getCacheStats().size).toBe(0)
    })
  })
})

// Add a way to access the internal cache for testing
const internalModule = require('../epaService')
internalModule.__getCache = () => require('../epaService').__getCache()
