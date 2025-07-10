import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'

// Mock Leaflet before importing the component
jest.mock('leaflet', () => ({
  Icon: {
    Default: {
      prototype: {
        _getIconUrl: jest.fn(),
      },
      mergeOptions: jest.fn(),
    },
  },
  divIcon: jest.fn().mockImplementation((options) => ({
    options: {
      ...options,
      html: options.html || ''
    }
  })),
  latLng: (lat, lng) => ({ lat, lng }),
  latLngBounds: () => ({
    extend: jest.fn(),
    getNorthEast: () => ({ lat: 40.5, lng: -106.0 }),
    getSouthWest: () => ({ lat: 35.0, lng: -114.0 })
  })
}))

// Import the component after setting up mocks
import WaterMap from '../components/WaterMap'

// Mock react-leaflet components
const mockFitBounds = jest.fn()
const mockSetView = jest.fn()

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children, position, icon, eventHandlers }) => (
    <div 
      data-testid="marker" 
      data-position={JSON.stringify(position)}
      data-icon={icon?.options?.html?.includes('Loading') ? 'loading' : 'loaded'}
      onClick={eventHandlers?.click}
    >
      {children}
    </div>
  ),
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({
    fitBounds: mockFitBounds,
    setView: mockSetView,
    getBounds: () => ({
      getNorthEast: () => ({ lat: 40.5, lng: -106.0 }),
      getSouthWest: () => ({ lat: 35.0, lng: -114.0 })
    })
  }),
  GeoJSON: () => <div data-testid="geojson-layer" />
}))

// Leaflet is now properly mocked at the top of the file

// Mock USGS service
const mockFetchMultipleSiteConditions = jest.fn()

jest.mock('../services/usgsService', () => ({
  fetchMultipleSiteConditions: (...args) => mockFetchMultipleSiteConditions(...args),
  COLORADO_PLATEAU_BOUNDS: {
    north: 40.5,
    south: 35.0,
    east: -106.0,
    west: -114.0
  }
}))

const mockSites = [
  {
    siteNo: '09371010',
    name: 'SAN JUAN RIVER AT FOUR CORNERS, CO',
    latitude: 36.9986,
    longitude: -109.0447,
    state: 'CO',
    usgsUrl: 'https://waterdata.usgs.gov/monitoring-location/09371010/'
  }
]

describe('WaterMap', () => {
  const mockProps = {
    sites: mockSites,
    selectedSite: null,
    onSiteSelect: jest.fn()
  }

  const mockSiteConditions = {
    '09371010': {
      status: 'online',
      currentFlow: 850,
      lastUpdate: new Date(),
      dataQuality: 'provisional',
      parameter: '00060',
      unit: 'ft³/s'
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchMultipleSiteConditions.mockResolvedValue(mockSiteConditions)
  })

  test('renders map container', async () => {
    render(<WaterMap {...mockProps} />)
    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTestId('map-container')).toBeInTheDocument()
    })
  })

  test('shows loading state initially', async () => {
    render(<WaterMap {...mockProps} />)
    
    // Initial loading state
    expect(screen.getByText('Loading monitoring sites...')).toBeInTheDocument()
    
    // Wait for data to load
    await waitFor(() => {
      expect(mockFetchMultipleSiteConditions).toHaveBeenCalledTimes(1)
    })
  })

  test('renders map header with title and description', async () => {
    render(<WaterMap {...mockProps} />)
    
    await screen.findByText('Interactive Water Monitoring Map')
    expect(screen.getByText('Click on a marker to view detailed streamflow data')).toBeInTheDocument()
  })

  test('renders map with legend', async () => {
    render(<WaterMap {...mockProps} />)
    
    // Wait for the component to finish loading and verify legend items
    await waitFor(() => {
      expect(screen.getByText('Interactive Water Monitoring Map')).toBeInTheDocument()
    })
    
    // Check for legend container
    const legend = screen.getByText('Flow Volume (cfs)').closest('.map-legend')
    expect(legend).toBeInTheDocument()
    
    // Check for legend items within the legend container
    expect(legend).toHaveTextContent('High (1000-2000)')
    expect(legend).toHaveTextContent('Medium (500-1000)')
    expect(legend).toHaveTextContent('Low (100-500)')
  })

  test('handles empty sites array', async () => {
    render(<WaterMap {...mockProps} sites={[]} />)
    
    // Should not call the API when there are no sites
    expect(mockFetchMultipleSiteConditions).not.toHaveBeenCalled()
    
    // The map should still render but with no markers
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  test('handles API errors gracefully', async () => {
    const errorMessage = 'Failed to load site data'
    mockFetchMultipleSiteConditions.mockRejectedValueOnce(new Error(errorMessage))
    
    render(<WaterMap {...mockProps} />)
    
    // Should show error state
    await waitFor(() => {
      expect(screen.getByText(/unable to load map data/i)).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })
  
  test('loads and displays site data', async () => {
    render(<WaterMap {...mockProps} />)
    
    // Wait for data to load
    await waitFor(() => {
      expect(mockFetchMultipleSiteConditions).toHaveBeenCalledTimes(1)
      expect(mockFetchMultipleSiteConditions).toHaveBeenCalledWith(['09371010'])
    })
    
    // Verify the map container is rendered
    await waitFor(() => {
      expect(screen.getByTestId('map-container')).toBeInTheDocument()
    })
  })
  
  test('shows loading state when sites prop changes', async () => {
    const { rerender } = render(<WaterMap {...mockProps} sites={[]} />)
    
    // Update with new sites
    const newSites = [...mockSites, {
      siteNo: '09371500',
      name: 'SAN JUAN RIVER NEAR BLUFF, UT',
      latitude: 37.2844,
      longitude: -109.5519,
      state: 'UT',
      usgsUrl: 'https://waterdata.usgs.gov/monitoring-location/09371500/'
    }]
    
    // Reset mock to simulate new loading state
    mockFetchMultipleSiteConditions.mockClear()
    mockFetchMultipleSiteConditions.mockResolvedValueOnce({
      ...mockSiteConditions,
      '09371500': {
        status: 'online',
        currentFlow: 1200,
        lastUpdate: new Date(),
        dataQuality: 'provisional'
      }
    })
    
    await act(async () => {
      rerender(<WaterMap {...mockProps} sites={newSites} />)
    })
    
    // Wait for new data to load
    await waitFor(() => {
      expect(mockFetchMultipleSiteConditions).toHaveBeenCalledTimes(1)
      expect(mockFetchMultipleSiteConditions).toHaveBeenCalledWith(['09371010', '09371500'])
    })
  })
}) 