import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON, ZoomControl } from 'react-leaflet'
import { Icon, divIcon } from 'leaflet'
import { fetchMultipleSiteConditions, fetchStreamflowData, COLORADO_PLATEAU_BOUNDS } from '../services/usgsService'
import WaterQualityLayer from './WaterQualityLayer';
import DroughtLayer from './DroughtLayer';
import RiversLayer from './RiversLayer';
import GaugeModal from './GaugeModal';
import watershedData from '../data/san-juan-watershed.json'
import ErrorBoundary from './ErrorBoundary'
import './WaterMap.css'

// Sparkline component for showing 7-day flow trends
const Sparkline = ({ data, width = 120, height = 30, color = '#2563eb' }) => {
  if (!data || data.length < 2) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#6b7280' }}>
        No trend data
      </div>
    );
  }

  const flows = data.map(d => d.flow).filter(f => f !== null && !isNaN(f));
  if (flows.length < 2) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#6b7280' }}>
        Insufficient data
      </div>
    );
  }

  const minFlow = Math.min(...flows);
  const maxFlow = Math.max(...flows);
  const range = maxFlow - minFlow;
  
  // Create SVG path
  const points = flows.map((flow, index) => {
    const x = (index / (flows.length - 1)) * (width - 4); // Leave 2px margin on each side
    const y = range > 0 ? height - 4 - ((flow - minFlow) / range) * (height - 8) : height / 2; // Leave 2px margin top/bottom
    return `${x},${y}`;
  });
  
  const pathData = `M ${points.join(' L ')}`;
  
  // Determine trend direction
  const firstFlow = flows[0];
  const lastFlow = flows[flows.length - 1];
  const trend = lastFlow > firstFlow ? 'up' : lastFlow < firstFlow ? 'down' : 'stable';
  const trendColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6b7280';
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <svg width={width} height={height} style={{ border: '1px solid #e5e7eb', borderRadius: '4px', background: '#f9fafb' }}>
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Add dots for first and last points */}
        <circle cx={points[0].split(',')[0]} cy={points[0].split(',')[1]} r="2" fill={color} />
        <circle cx={points[points.length - 1].split(',')[0]} cy={points[points.length - 1].split(',')[1]} r="2" fill={trendColor} />
      </svg>
      <div style={{ fontSize: '10px', color: trendColor, fontWeight: '500' }}>
        {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}
      </div>
    </div>
  );
};

// Fix for default markers in React Leaflet
delete Icon.Default.prototype._getIconUrl
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Popup content component with sparkline
const PopupContent = ({ site, status, currentFlow }) => {
  const [sparklineData, setSparklineData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSparklineData = async () => {
      if (!site?.siteNo) return;
      
      setLoading(true);
      try {
        const response = await fetchStreamflowData(site.siteNo, 'P7D');
        if (response && response.value && response.value.timeSeries && response.value.timeSeries.length > 0) {
          const timeSeries = response.value.timeSeries[0];
          const values = timeSeries.values[0].value || [];
          
          const formattedData = values
            .filter(item => item.value && item.value !== '-999999')
            .map(item => ({
              dateTime: new Date(item.dateTime),
              flow: parseFloat(item.value)
            }))
            .sort((a, b) => a.dateTime - b.dateTime);
          
          setSparklineData(formattedData);
        }
      } catch (error) {
        console.error('Error fetching sparkline data:', error);
        setSparklineData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSparklineData();
  }, [site?.siteNo]);

  return (
    <div className="site-popup">
      <h4>{site.name}</h4>
      <div className="site-details">
        <div className="info-row">
          <span className="label">Site ID:</span>
          <span className="value">{site.siteNo}</span>
        </div>
        <div className="info-row">
          <span className="label">Status:</span>
          <span className={`value status-${status}`}>
            {status === 'online' ? 'Live Data' : 'Offline'}
          </span>
        </div>
        {status === 'online' && currentFlow && (
          <div className="info-row">
            <span className="label">Current Flow:</span>
            <span className="value">
              {currentFlow.toLocaleString()} cfs
            </span>
          </div>
        )}
        <div className="info-row">
          <span className="label">Location:</span>
          <span className="value">
            {site.state} • {site.county}
          </span>
        </div>
        {status === 'online' && (
          <div className="info-row">
            <span className="label">7-Day Trend:</span>
            <div className="value">
              {loading ? (
                <div style={{ fontSize: '10px', color: '#6b7280' }}>Loading...</div>
              ) : (
                <Sparkline data={sparklineData} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

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

// Create proportional circle markers with enhanced visual hierarchy styling
const createProportionalMarker = (status, flow) => {
  if (status === 'offline' || flow === null || flow === undefined) {
    return divIcon({
      className: 'custom-div-icon offline-marker',
      html: `<div style="
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: #9ca3af;
        border: 3px solid white;
        box-shadow: 0 3px 8px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.2);
      "></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })
  }

  // Enhanced 3-tier flow classification with improved visual hierarchy
  let size, color, category, textColor
  
  if (flow >= 1000) {
    // High flow (>=1000 cfs) - Largest symbol: 96px with enhanced contrast
    size = 96
    color = '#1565c0' // Dark blue
    category = 'high'
    textColor = 'white'
  } else if (flow >= 200) {
    // Medium flow (200-999 cfs) - Medium symbol: 60px
    size = 60
    color = '#1976d2' // Medium blue  
    category = 'medium'
    textColor = 'white'
  } else {
    // Low flow (<200 cfs) - Small symbol: 36px
    size = 36
    color = '#42a5f5' // Light blue
    category = 'low'
    textColor = 'white'
  }

  return divIcon({
    className: `custom-div-icon flow-marker flow-${category}`,
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background-color: ${color};
      border: 3px solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${textColor};
      font-weight: bold;
      font-size: ${Math.max(10, size * 0.15)}px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      position: relative;
      z-index: 1000;
    ">${flow >= 1000 ? Math.round(flow/1000) + 'k' : Math.round(flow)}</div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  })
}

// Component to fit map bounds to watershed extent and monitoring sites
const MapBounds = ({ watershedData, sites = [], fitOnLoad = true }) => {
  const map = useMap()
  const initialFit = useRef(fitOnLoad)
  const boundsSet = useRef(false)
  
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
  
  // Function to add padding to bounds
  const addBoundsPadding = (bounds, paddingFactor = 0.3) => {
    if (!bounds) return null;
    
    const latRange = bounds.maxLat - bounds.minLat;
    const lngRange = bounds.maxLng - bounds.minLng;
    
    return {
      minLat: bounds.minLat - (latRange * paddingFactor),
      maxLat: bounds.maxLat + (latRange * paddingFactor),
      minLng: bounds.minLng - (lngRange * paddingFactor),
      maxLng: bounds.maxLng + (lngRange * paddingFactor)
    };
  };

  useEffect(() => {
    if ((watershedData || sites.length > 0) && !boundsSet.current) {
      let combinedBounds = null;
      
      // Get watershed bounds
      const watershedBounds = calculateBoundsFromGeoJSON(watershedData);
      
      // Get sites bounds  
      const sitesBounds = calculateBoundsFromSites(sites);
      
      // Combine bounds to include both watershed and sites
      if (watershedBounds && sitesBounds) {
        combinedBounds = {
          minLat: Math.min(watershedBounds.minLat, sitesBounds.minLat),
          maxLat: Math.max(watershedBounds.maxLat, sitesBounds.maxLat),
          minLng: Math.min(watershedBounds.minLng, sitesBounds.minLng),
          maxLng: Math.max(watershedBounds.maxLng, sitesBounds.maxLng)
        };
      } else if (watershedBounds) {
        combinedBounds = watershedBounds;
      } else if (sitesBounds) {
        combinedBounds = sitesBounds;
      }
      
      if (combinedBounds) {
        // Create leaflet bounds for fitting
        const fitBounds = [
          [combinedBounds.minLat, combinedBounds.minLng], 
          [combinedBounds.maxLat, combinedBounds.maxLng]
        ];
        
        // Set initial view and get the zoom level
        map.fitBounds(fitBounds, { padding: [50, 50] });
        const currentZoom = map.getZoom();
        
        // Set minZoom to 2 levels out from the full extent
        const minZoom = Math.max(1, currentZoom - 2);
        map.setMinZoom(minZoom);
        
        // Create maxBounds with generous padding to prevent panning too far
        const paddedBounds = addBoundsPadding(combinedBounds, 0.5);
        if (paddedBounds) {
          const maxBounds = [
            [paddedBounds.minLat, paddedBounds.minLng],
            [paddedBounds.maxLat, paddedBounds.maxLng]
          ];
          map.setMaxBounds(maxBounds);
        }
        
                 // Add gentle bounce-back behavior for when user pans too far
         let bounceTimeout;
         map.on('dragend', () => {
           if (paddedBounds) {
             const center = map.getCenter();
             const viewBounds = map.getBounds();
             
             // Check if the current view has moved significantly away from the data
             const isOutsideDataArea = (
               center.lat < combinedBounds.minLat - (combinedBounds.maxLat - combinedBounds.minLat) * 0.2 ||
               center.lat > combinedBounds.maxLat + (combinedBounds.maxLat - combinedBounds.minLat) * 0.2 ||
               center.lng < combinedBounds.minLng - (combinedBounds.maxLng - combinedBounds.minLng) * 0.2 ||
               center.lng > combinedBounds.maxLng + (combinedBounds.maxLng - combinedBounds.minLng) * 0.2
             );
             
             if (isOutsideDataArea) {
               // Clear any previous bounce timeout
               clearTimeout(bounceTimeout);
               
               // Gently fly back to keep the data in view
               bounceTimeout = setTimeout(() => {
                 const dataCenterLat = (combinedBounds.minLat + combinedBounds.maxLat) / 2;
                 const dataCenterLng = (combinedBounds.minLng + combinedBounds.maxLng) / 2;
                 
                 map.flyTo([dataCenterLat, dataCenterLng], map.getZoom(), {
                   duration: 1.2,
                   easeLinearity: 0.2
                 });
               }, 500);
             }
           }
         });
        
        boundsSet.current = true;
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
    // Calculate proportional sizes using area-based scaling for fixed values (2x larger)
    largeDiameter: 96,   // Size for 1000 cfs (doubled from 48)
    mediumDiameter: 68,  // Size for 500 cfs (doubled from 34) 
    smallDiameter: 48,   // Size for 100 cfs (doubled from 24)
    legendHeight: 136    // Height to fit largest circle + padding (doubled from 68)
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
    rivers: true,
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
    rivers: false,
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
            click: () => handleGaugeClick(site),
            mouseover: (e) => {
              e.target.openPopup();
            },
            mouseout: (e) => {
              e.target.closePopup();
            }
          }}
        >
          <Popup>
            <PopupContent site={site} status={status} currentFlow={currentFlow} />
          </Popup>
        </Marker>
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
                  id="riversToggle"
                  checked={activeLayers.rivers}
                  onChange={() => toggleLayer('rivers')}
                />
                <label className="form-check-label" htmlFor="riversToggle">
                  Rivers
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
                  Gauges
                </label>
              </div>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="waterQualityToggle"
                  checked={activeLayers.waterQuality}
                  onChange={() => toggleLayer('waterQuality')}
                />
                <label className="form-check-label" htmlFor="waterQualityToggle">
                  Water Quality
                </label>
              </div>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="droughtToggle"
                  checked={activeLayers.drought}
                  onChange={() => toggleLayer('drought')}
                />
                <label className="form-check-label" htmlFor="droughtToggle">
                  Drought
                </label>
              </div>
            </div>
          </div>
          
          {/* Flow Volume Legend - positioned in lower left of map */}
          <ProportionalLegend siteConditions={siteConditions} sites={sites} />
          
          {/* Rivers Legend - positioned in upper right of map */}
          {activeLayers.rivers && (
            <div className="map-rivers-legend">
              <h4>Rivers & Streams</h4>
              <div className="legend-item">
                <div className="river-line major-river"></div>
                <span>Major Rivers</span>
              </div>
              <div className="legend-item">
                <div className="river-line secondary-stream"></div>
                <span>Secondary Streams</span>
              </div>
              <div className="legend-item">
                <div className="river-line minor-tributary"></div>
                <span>Minor Tributaries</span>
              </div>
            </div>
          )}
          


          <MapContainer
            center={mapCenter}
            zoom={8}
            zoomControl={false}
            className="water-map"
            style={{ height: '600px', width: '100%' }}
            scrollWheelZoom={true}
            attributionControl={false}
            whenCreated={handleMapLoad}
            bounceAtZoomLimits={true}
          >
            {/* Custom zoom control */}
            <ZoomControl position="topright" />
            
            {/* Custom attribution */}
            <div className="leaflet-bottom leaflet-right">
              <div className="leaflet-control-attribution leaflet-control">
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
                  &copy; OpenStreetMap
                </a>
                {' | '}
                <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">
                  &copy; CARTO
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
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              detectRetina={true}
              maxZoom={19}
            />
            
            {activeLayers.watershed && (
              <GeoJSON 
                data={watershedData}
                style={{
                  fillColor: '#e8f1f5',
                  weight: 0.5,
                  opacity: 0.3,
                  color: '#2c5f6f',
                  fillOpacity: 0.2,
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
            
            {/* Rivers Layer */}
            {activeLayers.rivers && (
              <RiversLayer
                bounds={mapBounds && mapBounds._southWest && mapBounds._northEast ? mapBounds : null}
                visible={activeLayers.rivers}
                onDataLoad={(data) => {
                  console.log(`Loaded ${data.features?.length || 0} river features`);
                  setLayerLoading(prev => ({ ...prev, rivers: false }));
                }}
                onError={(error) => {
                  console.error('Rivers data error:', error);
                  setLayerLoading(prev => ({ ...prev, rivers: false }));
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
          allSites={sites}
        />
      </div>
    </ErrorBoundary>
  )
}

export default React.memo(WaterMap)
