import { 
  fetchCurrentDroughtConditions, 
  fetchDroughtForecast, 
  clearCache,
  getCacheStats
} from '../noaaService';

describe('NOAA Service', () => {
  // Mock fetch
  global.fetch = jest.fn();
  
  // Mock response helper
  const mockResponse = (data, ok = true) => ({
    ok,
    json: () => Promise.resolve(data),
  });
  
  // Mock error response helper
  const mockError = (status = 500, statusText = 'Internal Server Error') => ({
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve({ message: 'Error occurred' }),
  });
  
  // Clear cache before each test
  beforeEach(() => {
    clearCache();
    fetch.mockClear();
  });
  
  describe('fetchCurrentDroughtConditions', () => {
    const mockBounds = {
      north: 40.0,
      south: 35.0,
      east: -105.0,
      west: -110.0
    };
    
    const mockDroughtData = [
      {
        dm: 'D0',
        dm_short: 'Abnormally Dry',
        dm_color: '#FCD37F',
        area_pct: 25.5,
        valid_start: '2023-01-01',
        valid_end: '2023-01-31'
      },
      {
        dm: 'D1',
        dm_short: 'Moderate Drought',
        dm_color: '#FFAA00',
        area_pct: 15.2,
        valid_start: '2023-01-01',
        valid_end: '2023-01-31'
      }
    ];
    
    it('should fetch and return drought conditions', async () => {
      fetch.mockResolvedValueOnce(mockResponse(mockDroughtData));
      
      const result = await fetchCurrentDroughtConditions(mockBounds);
      
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).toContain('currentdroughtconditions');
      expect(result).toEqual(mockDroughtData);
      
      // Check cache was populated
      const cacheStats = getCacheStats();
      expect(cacheStats.size).toBe(1);
    });
    
    it('should use cache for subsequent requests with same parameters', async () => {
      fetch.mockResolvedValueOnce(mockResponse(mockDroughtData));
      
      // First call - should call the API
      const result1 = await fetchCurrentDroughtConditions(mockBounds);
      
      // Second call with same parameters - should use cache
      const result2 = await fetchCurrentDroughtConditions(mockBounds);
      
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockDroughtData);
      expect(result2).toEqual(mockDroughtData);
    });
    
    it('should handle API errors', async () => {
      fetch.mockResolvedValueOnce(mockError(500, 'Server Error'));
      
      await expect(fetchCurrentDroughtConditions(mockBounds))
        .rejects
        .toThrow('Failed to fetch drought conditions');
    });
  });
  
  describe('fetchDroughtForecast', () => {
    const mockBounds = {
      north: 40.0,
      south: 35.0,
      east: -105.0,
      west: -110.0
    };
    
    const mockForecastData = {
      forecast: [
        {
          dm: 'D1',
          dm_short: 'Moderate Drought',
          dm_color: '#FFAA00',
          probability: 0.65,
          valid_start: '2023-02-01',
          valid_end: '2023-02-28'
        },
        {
          dm: 'D2',
          dm_short: 'Severe Drought',
          dm_color: '#E37400',
          probability: 0.45,
          valid_start: '2023-02-01',
          valid_end: '2023-02-28'
        }
      ]
    };
    
    it('should fetch and return drought forecast', async () => {
      fetch.mockResolvedValueOnce(mockResponse(mockForecastData));
      
      const result = await fetchDroughtForecast(mockBounds);
      
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).toContain('droughtforecast');
      expect(result).toEqual(mockForecastData);
      
      // Check cache was populated
      const cacheStats = getCacheStats();
      expect(cacheStats.size).toBe(1);
    });
    
    it('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(fetchDroughtForecast(mockBounds))
        .rejects
        .toThrow('Failed to fetch drought forecast');
    });
  });
  
  describe('cache management', () => {
    it('should clear the cache', () => {
      // Add something to the cache
      const mockCache = {
        timestamp: Date.now(),
        data: { test: 'data' }
      };
      
      // @ts-ignore - accessing private cache for testing
      const cache = global.cache || new Map();
      cache.set('test-key', mockCache);
      
      expect(cache.size).toBe(1);
      
      clearCache();
      
      expect(cache.size).toBe(0);
    });
  });
});
