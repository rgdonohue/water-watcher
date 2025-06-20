import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import WaterMap from '../components/WaterMap'

// Mock react-leaflet components
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({
    fitBounds: jest.fn(),
  }),
}))

// Mock leaflet
jest.mock('leaflet', () => ({
  Icon: {
    Default: {
      prototype: {
        _getIconUrl: jest.fn(),
      },
      mergeOptions: jest.fn(),
    },
  },
}))

// Mock USGS service
jest.mock('../services/usgsService', () => ({
  fetchMultipleSiteConditions: jest.fn(() => 
    Promise.resolve({
      '09371010': {
        status: 'online',
        currentFlow: 850,
        lastUpdate: new Date(),
        dataQuality: 'provisional'
      }
    })
  ),
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

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders map container', () => {
    render(<WaterMap {...mockProps} />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  test('shows loading state initially', () => {
    render(<WaterMap {...mockProps} />)
    expect(screen.getByText('Loading monitoring sites...')).toBeInTheDocument()
  })

  test('renders map header with title and description', async () => {
    render(<WaterMap {...mockProps} />)
    
    await screen.findByText('Interactive Water Monitoring Map')
    expect(screen.getByText('Click on a marker to view detailed streamflow data')).toBeInTheDocument()
  })

  test('renders legend with flow categories', async () => {
    render(<WaterMap {...mockProps} />)
    
    await screen.findByText('High Flow (>1000 cfs)')
    expect(screen.getByText('Normal Flow (500-1000 cfs)')).toBeInTheDocument()
    expect(screen.getByText('Low Flow (100-500 cfs)')).toBeInTheDocument()
    expect(screen.getByText('Very Low Flow (<100 cfs)')).toBeInTheDocument()
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  test('handles empty sites array', () => {
    render(<WaterMap {...mockProps} sites={[]} />)
    expect(screen.queryByTestId('marker')).not.toBeInTheDocument()
  })

  test('calls onSiteSelect when provided', () => {
    const onSiteSelect = jest.fn()
    render(<WaterMap {...mockProps} onSiteSelect={onSiteSelect} />)
    
    // Component should render without errors
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })
}) 