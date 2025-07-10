import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON, ZoomControl } from 'react-leaflet'
import { Icon, divIcon } from 'leaflet'
import { fetchMultipleSiteConditions, COLORADO_PLATEAU_BOUNDS } from '../services/usgsService'
import WaterQualityLayer from './WaterQualityLayer';
import DroughtLayer from './DroughtLayer';
import GaugeModal from './GaugeModal';
import watershedData from '../data/san-juan-watershed.json'
import ErrorBoundary from './ErrorBoundary'
import './WaterMap.css'

// Fix for default markers in React Leaflet
delete Icon.Default.prototype._getIconUrl
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Create a loading marker
const createLoadingMarker = () => {
  return divIcon({
    className: 'custom-div-icon loading-marker',
    html: `<div style="
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: #93c5fd;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      animation: pulse 1.5s infinite;
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  })
}

// Create proportional circle markers with sequential blue color scheme
const createProportionalMarker = (status, flow) => {
  if (status === 'offline' || flow === null || flow === undefined) {
    return divIcon({
      className: 'custom-div-icon offline-marker',
      html: `<div style="
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: #9ca3af;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })
  }

  // Simplified 3-tier flow classification with larger symbols
  let size, color, category
  
  if (flow >= 1000) {
    // High flow (>=1000 cfs) - Largest symbol: 96px (3x increase from 32px)
    size = 96
    color = '#1565c0' // Dark blue
    category = 'high'
  } else if (flow >= 200) {
    // Medium flow (200-999 cfs) - Medium symbol: 60px
    size = 60
    color = '#1976d2' // Medium blue  
    category = 'medium'
  } else {
    // Low flow (<200 cfs) - Small symbol: 36px
    size = 36
    color = '#42a5f5' // Light blue
    category = 'low'
  }

  return divIcon({
    className: `custom-div-icon flow-marker flow-${category}`,
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background-color: ${color};
      box-shadow: 0 3px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: ${Math.max(10, size * 0.15)}px;
    ">${flow >= 1000 ? Math.round(flow/1000) + 'k' : Math.round(flow)}</div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  })
}

// Component to fit map bounds to watershed extent and monitoring sites
const MapBounds = ({ watershedData, sites = [], fitOnLoad = true }) => {
  const map = useMap()
  const initialFit = useRef(fitOnLoad)
  
  // Function to calculate bounds from GeoJSON coordinates
  const calculateBoundsFromGeoJSON = (geoJsonData) => {
    if (!geoJsonData || !geoJsonData.features || geoJsonData.features.length === 0) {
      return null;
    }
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    geoJsonData.features.forEach(feature => {
      if (feature.geometry && feature.geometry.coordinates) {
        const coords = feature.geometry.coordinates[0]; // Get the outer ring for polygons
        coords.forEach(coord => {
          const [lng, lat] = coord; // GeoJSON format is [longitude, latitude]
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
        });
      }
    });
    
    return { minLat, maxLat, minLng, maxLng };
  };
  
  // Function to calculate bounds from monitoring sites
  const calculateBoundsFromSites = (siteList) => {
    if (!siteList || siteList.length === 0) {
      return null;
    }
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    siteList.forEach(site => {
      if (site.latitude && site.longitude) {
        minLat = Math.min(minLat, site.latitude);
        maxLat = Math.max(maxLat, site.latitude);
        minLng = Math.min(minLng, site.longitude);
        maxLng = Math.max(maxLng, site.longitude);
      }
    });
    
    return { minLat, maxLat, minLng, maxLng };
  };
  
  useEffect(() => {
    if ((watershedData || sites.length > 0) && (initialFit.current || !fitOnLoad)) {
      let combinedBounds = null;
      
      // Get watershed bounds
      const watershedBounds = calculateBoundsFromGeoJSON(watershedData);
      
      // Get sites bounds  
      const sitesBounds = calculateBoundsFromSites(sites);
      
      // Combine bounds to include both watershed and sites
      if (watershedBounds && sitesBounds) {
        combinedBounds = [
          [Math.min(watershedBounds.minLat, sitesBounds.minLat), Math.min(watershedBounds.minLng, sitesBounds.minLng)],
          [Math.max(watershedBounds.maxLat, sitesBounds.maxLat), Math.max(watershedBounds.maxLng, sitesBounds.maxLng)]
        ];
      } else if (watershedBounds) {
        combinedBounds = [[watershedBounds.minLat, watershedBounds.minLng], [watershedBounds.maxLat, watershedBounds.maxLng]];
      } else if (sitesBounds) {
        combinedBounds = [[sitesBounds.minLat, sitesBounds.minLng], [sitesBounds.maxLat, sitesBounds.maxLng]];
      }
      
      if (combinedBounds) {
        map.fitBounds(combinedBounds, { padding: [50, 50] });
        initialFit.current = false;
      }
    }
  }, [watershedData, sites, map, fitOnLoad]);
  
  return null;
};

// Dynamic proportional symbol legend component (inspired by rgdonohue's technique)
const ProportionalLegend = ({ siteConditions, sites }) => {
  // Use fixed values instead of dynamic ones
  const legendData = {
    maxFlow: 1000,
    midFlow: 500,
    minFlow: 100,
    // Calculate proportional sizes using area-based scaling for fixed values
    largeDiameter: 48,   // Size for 1000 cfs
    mediumDiameter: 34,  // Size for 500 cfs (sqrt(500/1000) * 48 ≈ 34)
    smallDiameter: 24,   // Size for 100 cfs (sqrt(100/1000) * 48 ≈ 24)
    legendHeight: 68     // Height to fit largest circle + padding
  };

  const { maxFlow, midFlow, minFlow, largeDiameter, mediumDiameter, smallDiameter, legendHeight } = legendData;

  return (
    <div className="map-flow-legend">
      <h4>Flow Volume (cfs)</h4>
      <div 
        className="proportional-legend-container" 
        style={{ 
          height: `${legendHeight}px`,
          position: 'relative',
          marginBottom: '0.5rem'
        }}
      >
        {/* Large circle */}
        <div
          className="prop-circle prop-large"
          style={{
            width: `${largeDiameter}px`,
            height: `${largeDiameter}px`,
            backgroundColor: '#1565c0',
            borderRadius: '50%',
            position: 'absolute',
            left: 0,
            bottom: 0
          }}
        />
        <div
          className="prop-line prop-line-large"
          style={{
            position: 'absolute',
            left: `${largeDiameter + 5}px`,
            bottom: `${largeDiameter - 4}px`,
            width: '20px',
            height: '1px',
            backgroundColor: '#374151',
            borderTop: '1px solid #374151'
          }}
        />
        <div
          className="prop-label prop-label-large"
          style={{
            position: 'absolute',
            left: `${largeDiameter + 30}px`,
            bottom: `${largeDiameter - 8}px`,
            fontSize: '0.75rem',
            color: '#374151',
            fontWeight: '500'
          }}
        >
          {maxFlow.toLocaleString()}
        </div>

        {/* Medium circle */}
        <div
          className="prop-circle prop-medium"
          style={{
            width: `${mediumDiameter}px`,
            height: `${mediumDiameter}px`,
            backgroundColor: '#1976d2',
            borderRadius: '50%',
            position: 'absolute',
            left: `${(largeDiameter - mediumDiameter) / 2}px`,
            bottom: 0
          }}
        />
        <div
          className="prop-line prop-line-medium"
          style={{
            position: 'absolute',
            left: `${largeDiameter + 5}px`,
            bottom: `${mediumDiameter - 4}px`,
            width: '20px',
            height: '1px',
            backgroundColor: '#374151',
            borderTop: '1px solid #374151'
          }}
        />
        <div
          className="prop-label prop-label-medium"
          style={{
            position: 'absolute',
            left: `${largeDiameter + 30}px`,
            bottom: `${mediumDiameter - 8}px`,
            fontSize: '0.75rem',
            color: '#374151',
            fontWeight: '500'
          }}
        >
          {midFlow.toLocaleString()}
        </div>

        {/* Small circle */}
        <div
          className="prop-circle prop-small"
          style={{
            width: `${smallDiameter}px`,
            height: `${smallDiameter}px`,
            backgroundColor: '#42a5f5',
            borderRadius: '50%',
            position: 'absolute',
            left: `${(largeDiameter - smallDiameter) / 2}px`,
            bottom: 0
          }}
        />
        <div
          className="prop-line prop-line-small"
          style={{
            position: 'absolute',
            left: `${largeDiameter + 5}px`,
            bottom: `${smallDiameter - 4}px`,
            width: '20px',
            height: '1px',
            backgroundColor: '#374151',
            borderTop: '1px solid #374151'
          }}
        />
        <div
          className="prop-label prop-label-small"
          style={{
            position: 'absolute',
            left: `${largeDiameter + 30}px`,
            bottom: `${smallDiameter - 8}px`,
            fontSize: '0.75rem',
            color: '#374151',
            fontWeight: '500'
          }}
        >
          {minFlow.toLocaleString()}
        </div>

        {/* Offline indicator */}
        <div
          className="prop-circle prop-offline"
          style={{
            width: '12px',
            height: '12px',
            backgroundColor: '#9ca3af',
            borderRadius: '50%',
            position: 'absolute',
            left: `${largeDiameter + 30}px`,
            bottom: 0
          }}
        />
        <div
          className="prop-label prop-label-offline"
          style={{
            position: 'absolute',
            left: `${largeDiameter + 50}px`,
            bottom: '-4px',
            fontSize: '0.75rem',
            color: '#6b7280',
            fontWeight: '400'
          }}
        >
          Offline
        </div>
      </div>
      
      <div className="legend-note">
        <small style={{ color: '#6b7280', fontStyle: 'italic' }}>
          *Circle area ∝ flow volume
        </small>
      </div>
    </div>
  );
};

// Default parameters for the component
const WaterMap = ({
  sites = [],
  selectedSite = null,
  onSiteSelect = () => {},
  // Default active layers
  initialActiveLayers = {
    watershed: true,
    markers: true,
    waterQuality: false,
    drought: false
  },
  // Default map center (US center)
  initialMapCenter = [37.0902, -95.7129],
  // Default map bounds (entire world)
  initialMapBounds = [[-90, -180], [90, 180]]
}) => {
  const [siteConditions, setSiteConditions] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeLayers, setActiveLayers] = useState(initialActiveLayers)
  const [layerLoading, setLayerLoading] = useState({
    watershed: false,
    markers: false,
    waterQuality: false,
    drought: false
  })
  const [waterQualityFilters, setWaterQualityFilters] = useState([])
  const [availableCharacteristics, setAvailableCharacteristics] = useState([])
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [mapBounds, setMapBounds] = useState(null) // Initialize as null instead of array
  // Modal state for gauge details
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedSiteData, setSelectedSiteData] = useState(null)
  // Initialize map center to Colorado Plateau region if no initial center provided
  const [mapCenter, setMapCenter] = useState(initialMapCenter || [
    (COLORADO_PLATEAU_BOUNDS.north + COLORADO_PLATEAU_BOUNDS.south) / 2,
    (COLORADO_PLATEAU_BOUNDS.east + COLORADO_PLATEAU_BOUNDS.west) / 2
  ])
  const mapRef = useRef(null)
  const prevSitesRef = useRef([])

  // Load site conditions when sites change
  useEffect(() => {
    const loadSiteConditions = async () => {
      if (!sites.length) {
        setLoading(false)
        return
      }

      // Skip if sites haven't changed
      const siteIds = sites.map(site => site.siteNo).sort()
      const prevSiteIds = prevSitesRef.current.map(site => site.siteNo).sort()
      
      if (JSON.stringify(siteIds) === JSON.stringify(prevSiteIds)) {
        setLoading(false)
        return
      }

      setLoading(true)
      setLayerLoading(prev => ({ ...prev, markers: true }))
      prevSitesRef.current = [...sites]

      try {
        const conditions = await fetchMultipleSiteConditions(siteIds)
        setSiteConditions(conditions)
      } catch (err) {
        console.error('Error loading site conditions:', err)
      } finally {
        setLoading(false)
        setLayerLoading(prev => ({ ...prev, markers: false }))
      }
    }

    loadSiteConditions()
  }, [sites])

  // Toggle layer visibility
  const toggleLayer = (layer) => {
    // Only allow one data layer at a time
    if (layer === 'waterQuality' || layer === 'drought') {
      setActiveLayers(prev => ({
        ...prev,
        waterQuality: layer === 'waterQuality' ? !prev.waterQuality : false,
        drought: layer === 'drought' ? !prev.drought : false
      }));
    } else {
      setActiveLayers(prev => ({
        ...prev,
        [layer]: !prev[layer]
      }));
    }
  };

  // Toggle characteristic filter
  const toggleCharacteristicFilter = useCallback((characteristic) => {
    setWaterQualityFilters(prev => {
      if (prev.includes(characteristic)) {
        return prev.filter(c => c !== characteristic);
      } else {
        return [...prev, characteristic];
      }
    });
  }, []);

  // Handle map move end to update water quality data
  const updateMapBounds = useCallback(() => {
    if (mapRef.current) {
      const bounds = mapRef.current.getBounds();
      setMapBounds(bounds);
    }
  }, []);
  
  const handleMapLoad = useCallback((mapInstance) => {
    mapRef.current = mapInstance;
    updateMapBounds();
    mapInstance.on('moveend', updateMapBounds);
    
    return () => {
      mapInstance.off('moveend', updateMapBounds);
    };
  }, [updateMapBounds]);

  // Colorado Plateau region bounds for reference
  const coloradoPlateauCenter = [
    (COLORADO_PLATEAU_BOUNDS.north + COLORADO_PLATEAU_BOUNDS.south) / 2,
    (COLORADO_PLATEAU_BOUNDS.east + COLORADO_PLATEAU_BOUNDS.west) / 2
  ]

  // Handle water quality data load
  const handleWaterQualityDataLoad = useCallback((data) => {
    console.log(`Loaded ${data.length} water quality monitoring stations`);
    setLayerLoading(prev => ({ ...prev, waterQuality: false }));
    
    // Extract unique characteristics from the data
    const characteristics = new Set();
    data.forEach(location => {
      Object.keys(location.characteristics).forEach(char => {
        characteristics.add(char);
      });
    });
    
    setAvailableCharacteristics(prev => {
      // Only update if we have new characteristics
      if (prev.length !== characteristics.size) {
        return Array.from(characteristics).sort();
      }
      return prev;
    });
  }, []);
  
  // Handle drought data load
  const handleDroughtDataLoad = useCallback((data) => {
    console.log('Loaded drought data:', data);
    setLayerLoading(prev => ({ ...prev, drought: false }));
  }, []);
  
  // Handle water quality error
  const handleWaterQualityError = useCallback((error) => {
    console.error('Water quality data error:', error);
    setLayerLoading(prev => ({ ...prev, waterQuality: false }));
  }, []);
  
  // Handle drought error
  const handleDroughtError = useCallback((error) => {
    console.error('Drought data error:', error);
    setLayerLoading(prev => ({ ...prev, drought: false }));
  }, []);

  // Handle gauge click to open modal
  const handleGaugeClick = useCallback((site) => {
    setSelectedSiteData(site);
    setModalOpen(true);
  }, []);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setSelectedSiteData(null);
  }, []);

  // Create markers for each site
  const markers = useMemo(() => {
    if (!activeLayers.markers) return null;
    
    return sites.map(site => {
      const conditions = siteConditions[site.siteNo] || {}
      const { status = 'offline', currentFlow = null } = conditions
      
      return (
        <Marker
          key={site.siteNo}
          position={[site.latitude, site.longitude]}
          icon={loading || layerLoading.markers ? createLoadingMarker() : createProportionalMarker(status, currentFlow)}
          eventHandlers={{
            click: () => handleGaugeClick(site)
          }}
        />
      )
    })
  }, [sites, siteConditions, loading, layerLoading.markers, activeLayers.markers, handleGaugeClick])

  if (loading) {
    return (
      <div className="water-map-loading">
        <div className="loading-spinner" />
        <p>Loading monitoring sites...</p>
      </div>
    )
  }

  return (
    <ErrorBoundary onRetry={() => window.location.reload()}>
      <div className="water-map-container">
        <div className="map-header">
          <h3>Interactive Water Monitoring Map</h3>
          <p>Click on a monitoring site marker to view detailed streamflow data and interactive time series charts</p>
        </div>
        
        <div className="map-wrapper">
          {/* Layer Controls - positioned in upper left of map */}
          <div className="map-layer-controls">
            <h4>Map Layers</h4>
            <div className="layer-control-items">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="watershedToggle"
                  checked={activeLayers.watershed}
                  onChange={() => toggleLayer('watershed')}
                />
                <label className="form-check-label" htmlFor="watershedToggle">
                  Watershed
                </label>
              </div>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="markersToggle"
                  checked={activeLayers.markers}
                  onChange={() => toggleLayer('markers')}
                />
                <label className="form-check-label" htmlFor="markersToggle">
                  Sites
                </label>
              </div>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="waterQualityToggle"
                  checked={activeLayers.waterQuality}
                  onChange={() => toggleLayer('waterQuality')}
                  disabled={layerLoading.waterQuality}
                />
                <label className="form-check-label" htmlFor="waterQualityToggle">
                  Water Quality
                  {layerLoading.waterQuality && (
                    <span className="ms-2 spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  )}
                </label>
              </div>
            </div>
          </div>
          
          {/* Flow Volume Legend - positioned in lower left of map */}
          <ProportionalLegend siteConditions={siteConditions} sites={sites} />
          
          {/* Water Quality Legend - positioned in lower right of map */}
          <div className="map-water-quality-legend">
            <h4>Water Quality Status</h4>
            <div className="legend-item">
              <span className="legend-color status-good"></span>
              <span>Good</span>
            </div>
            <div className="legend-item">
              <span className="legend-color status-fair"></span>
              <span>Fair</span>
            </div>
            <div className="legend-item">
              <span className="legend-color status-poor"></span>
              <span>Poor</span>
            </div>
            
            {activeLayers.waterQuality && availableCharacteristics.length > 0 && (
              <div className="characteristic-filters">
                <h5>Filter by Parameter:</h5>
                <div className="filter-options">
                  {availableCharacteristics.slice(0, 6).map(char => (
                    <div key={char} className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`filter-${char}`}
                        checked={waterQualityFilters.includes(char)}
                        onChange={() => toggleCharacteristicFilter(char)}
                      />
                      <label className="form-check-label" htmlFor={`filter-${char}`}>
                        {char}
                      </label>
                    </div>
                  ))}
                </div>
                {waterQualityFilters.length > 0 && (
                  <button 
                    className="btn btn-sm btn-link p-0 mt-1"
                    onClick={() => setWaterQualityFilters([])}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          <MapContainer
            center={mapCenter}
            zoom={8}
            zoomControl={false}
            className="water-map"
            style={{ height: '600px', width: '100%' }}
            scrollWheelZoom={true}
            attributionControl={false}
            whenCreated={handleMapLoad}
          >
            {/* Custom zoom control */}
            <ZoomControl position="topright" />
            
            {/* Custom attribution */}
            <div className="leaflet-bottom leaflet-right">
              <div className="leaflet-control-attribution leaflet-control">
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
                  &copy; OpenStreetMap contributors
                </a>
                {' | '}
                <a href="https://waterdata.usgs.gov/nwis" target="_blank" rel="noopener noreferrer">
                  USGS Water Data
                </a>
                {' | '}
                <a href="https://www.epa.gov/waterdata/water-quality-data" target="_blank" rel="noopener noreferrer">
                  EPA Water Quality
                </a>
              </div>
            </div>
            
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              detectRetina={true}
              maxZoom={19}
              minZoom={5}
            />
            
            {activeLayers.watershed && (
              <GeoJSON 
                data={watershedData}
                style={{
                  fillColor: '#1976d2',
                  weight: 1.5,
                  opacity: 0.8,
                  color: '#1565c0',
                  fillOpacity: 0.4,
                  lineCap: 'round',
                  lineJoin: 'round',
                  smoothFactor: 2.0
                }}
                onEachFeature={(feature, layer) => {
                  layer.bindPopup(`
                    <div class="watershed-popup">
                      <h4>${feature.properties.name || 'Watershed'}</h4>
                      <p><strong>Area:</strong> ${(feature.properties.area_sqkm || 0).toLocaleString()} km&sup2;</p>
                    </div>
                  `)
                }}
              />
            )}
            
            {activeLayers.markers && markers}
            
            {/* Water Quality Layer */}
            {activeLayers.waterQuality && (
              <WaterQualityLayer
                bounds={mapBounds && mapBounds._southWest && mapBounds._northEast ? mapBounds : null}
                visible={activeLayers.waterQuality}
                onDataLoad={handleWaterQualityDataLoad}
                onError={handleWaterQualityError}
                selectedCharacteristics={waterQualityFilters}
              />
            )}
            
            {/* Drought Layer */}
            <DroughtLayer
              bounds={mapBounds && mapBounds._southWest && mapBounds._northEast ? mapBounds : null}
              visible={activeLayers.drought}
              onDataLoad={handleDroughtDataLoad}
              onError={handleDroughtError}
            />
            
            <MapBounds watershedData={watershedData} sites={sites} fitOnLoad={true} />
            
          </MapContainer>
        </div>
        
        {selectedSite && (
          <div className="selected-site-info">
            <h4>Selected Site: {selectedSite.name}</h4>
            <p>Viewing streamflow data below the map</p>
          </div>
        )}

        {/* Gauge Modal */}
        <GaugeModal
          isOpen={modalOpen}
          onClose={handleModalClose}
          siteData={selectedSiteData}
          siteCondition={selectedSiteData ? siteConditions[selectedSiteData.siteNo] : null}
        />
      </div>
    </ErrorBoundary>
  )
}

export default React.memo(WaterMap)
