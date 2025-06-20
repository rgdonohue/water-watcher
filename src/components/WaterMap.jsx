import React, { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON } from 'react-leaflet'
import { Icon, divIcon } from 'leaflet'
import { fetchMultipleSiteConditions, COLORADO_PLATEAU_BOUNDS } from '../services/usgsService'
import watershedData from '../data/san-juan-watershed.json'
// import 'leaflet/dist/leaflet.css' // Imported in index.css instead

// Fix for default markers in React Leaflet
delete Icon.Default.prototype._getIconUrl
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Create proportional circle markers with sequential blue color scheme
const createProportionalMarker = (status, currentFlow) => {
  // Handle offline or missing data
  if (status !== 'online' || !currentFlow) {
    return divIcon({
      className: 'custom-div-icon',
      html: `<div style="
        width: 12px; 
        height: 12px; 
        border-radius: 50%; 
        background-color: #9ca3af; 
        border: 2px solid white; 
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    })
  }

  // Calculate proportional size (minimum 8px, maximum 32px)
  const minSize = 8
  const maxSize = 32
  const minFlow = 10
  const maxFlow = 3000
  
  const normalizedFlow = Math.max(minFlow, Math.min(maxFlow, currentFlow))
  const size = minSize + ((normalizedFlow - minFlow) / (maxFlow - minFlow)) * (maxSize - minSize)
  
  // Sequential blue color scheme based on flow volume
  let color = '#e0f2fe' // Very light blue (lowest flow)
  
  if (currentFlow >= 2000) color = '#0277bd'      // Dark blue (very high flow)
  else if (currentFlow >= 1000) color = '#0288d1' // Medium-dark blue (high flow)
  else if (currentFlow >= 500) color = '#03a9f4'  // Medium blue (medium-high flow)
  else if (currentFlow >= 200) color = '#29b6f6'  // Medium-light blue (medium flow)
  else if (currentFlow >= 100) color = '#4fc3f7'  // Light blue (low-medium flow)
  else if (currentFlow >= 50) color = '#81d4fa'   // Very light blue (low flow)
  else color = '#b3e5fc'                          // Lightest blue (very low flow)

  return divIcon({
    className: 'custom-div-icon',
    html: `<div style="
      width: ${size}px; 
      height: ${size}px; 
      border-radius: 50%; 
      background-color: ${color}; 
      border: 2px solid white; 
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      opacity: 0.9;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  })
}

// Component to fit map bounds
const MapBounds = ({ sites }) => {
  const map = useMap()
  
  useEffect(() => {
    if (sites.length > 0) {
      const bounds = sites.map(site => [site.latitude, site.longitude])
      map.fitBounds(bounds, { padding: [20, 20] })
    }
  }, [sites, map])
  
  return null
}

const WaterMap = ({ sites, selectedSite, onSiteSelect }) => {
  const [siteConditions, setSiteConditions] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mapRef = useRef(null)

  // Load site conditions on component mount
  useEffect(() => {
    const loadSiteConditions = async () => {
      if (sites.length === 0) return
      
      setLoading(true)
      setError(null)
      
      try {
        const siteNumbers = sites.map(site => site.siteNo)
        const conditions = await fetchMultipleSiteConditions(siteNumbers)
        setSiteConditions(conditions)
      } catch (err) {
        setError(err.message)
        console.error('Error loading site conditions:', err)
      } finally {
        setLoading(false)
      }
    }

    loadSiteConditions()
  }, [sites])

  // Center map on Colorado Plateau region
  const mapCenter = [
    (COLORADO_PLATEAU_BOUNDS.north + COLORADO_PLATEAU_BOUNDS.south) / 2,
    (COLORADO_PLATEAU_BOUNDS.east + COLORADO_PLATEAU_BOUNDS.west) / 2
  ]

  if (loading) {
    return (
      <div className="water-map-loading">
        <div className="loading-spinner"></div>
        <p>Loading monitoring sites...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="water-map-error">
        <h3>Unable to load map data</h3>
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="btn btn-primary"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="water-map-container">
      <div className="map-header">
        <h3>Interactive Water Monitoring Map</h3>
        <p>Click on a marker to view detailed streamflow data</p>
        <div className="map-legend">
          <div className="legend-title">Flow Volume (cfs)</div>
          <div className="legend-item">
            <div className="legend-marker proportional-large" style={{ backgroundColor: '#0277bd' }}></div>
            <span>Very High (&gt;2000)</span>
          </div>
          <div className="legend-item">
            <div className="legend-marker proportional-medium" style={{ backgroundColor: '#0288d1' }}></div>
            <span>High (1000-2000)</span>
          </div>
          <div className="legend-item">
            <div className="legend-marker proportional-medium" style={{ backgroundColor: '#03a9f4' }}></div>
            <span>Medium (500-1000)</span>
          </div>
          <div className="legend-item">
            <div className="legend-marker proportional-small" style={{ backgroundColor: '#4fc3f7' }}></div>
            <span>Low (100-500)</span>
          </div>
          <div className="legend-item">
            <div className="legend-marker proportional-small" style={{ backgroundColor: '#81d4fa' }}></div>
            <span>Very Low (50-100)</span>
          </div>
          <div className="legend-item">
            <div className="legend-marker proportional-small" style={{ backgroundColor: '#b3e5fc' }}></div>
            <span>Minimal (&lt;50)</span>
          </div>
          <div className="legend-item">
            <div className="legend-marker proportional-small" style={{ backgroundColor: '#9ca3af' }}></div>
            <span>Offline</span>
          </div>
          <div className="legend-note">
            <small>*Symbol size proportional to flow volume</small>
          </div>
        </div>
      </div>
      
      <div className="map-wrapper">
        <MapContainer
          center={mapCenter}
          zoom={8}
          className="water-map"
          zoomControl={true}
          scrollWheelZoom={true}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Watershed boundaries */}
          <GeoJSON 
            data={watershedData} 
            style={{
              fillColor: '#e3f2fd',
              weight: 2,
              opacity: 0.8,
              color: '#1976d2',
              dashArray: '5, 5',
              fillOpacity: 0.1
            }}
            onEachFeature={(feature, layer) => {
              layer.bindPopup(`
                <div class="watershed-popup">
                  <h4>${feature.properties.name}</h4>
                  <p><strong>HUC:</strong> ${feature.properties.huc}</p>
                  <p><strong>Area:</strong> ${feature.properties.area_sqkm.toLocaleString()} km²</p>
                  <p>${feature.properties.description}</p>
                </div>
              `)
            }}
          />
          
          {/* Fit bounds to show all sites */}
          <MapBounds sites={sites} />
          
          {/* Site markers */}
          {sites.map((site) => {
            const condition = siteConditions[site.siteNo] || { status: 'loading', currentFlow: null }
            const isSelected = selectedSite?.siteNo === site.siteNo
            
            return (
              <Marker
                key={site.siteNo}
                position={[site.latitude, site.longitude]}
                icon={createProportionalMarker(condition.status, condition.currentFlow)}
                eventHandlers={{
                  click: () => {
                    onSiteSelect(site)
                  }
                }}
              >
                <Popup>
                  <div className="map-popup">
                    <h4>{site.name}</h4>
                    <div className="popup-info">
                      <div className="info-row">
                        <span className="label">Site ID:</span>
                        <span className="value">{site.siteNo}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Location:</span>
                        <span className="value">{site.state}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Coordinates:</span>
                        <span className="value">
                          {site.latitude.toFixed(4)}°, {site.longitude.toFixed(4)}°
                        </span>
                      </div>
                      <div className="info-row">
                        <span className="label">Status:</span>
                        <span className={`value status-${condition.status}`}>
                          {condition.status === 'online' ? 'Live Data' : 'Offline'}
                        </span>
                      </div>
                      {condition.currentFlow && (
                        <div className="info-row">
                          <span className="label">Current Flow:</span>
                          <span className="value">
                            {condition.currentFlow.toLocaleString()} cfs
                          </span>
                        </div>
                      )}
                      {condition.lastUpdate && (
                        <div className="info-row">
                          <span className="label">Last Update:</span>
                          <span className="value">
                            {new Date(condition.lastUpdate).toLocaleTimeString()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="popup-actions">
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => onSiteSelect(site)}
                      >
                        View Chart
                      </button>
                      <a 
                        href={site.usgsUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        USGS Data
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
      
      {selectedSite && (
        <div className="selected-site-info">
          <h4>Selected Site: {selectedSite.name}</h4>
          <p>Viewing streamflow data below the map</p>
        </div>
      )}
    </div>
  )
}

export default WaterMap 