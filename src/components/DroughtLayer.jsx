import React, { useState, useEffect, useMemo } from 'react';
import { GeoJSON, Tooltip } from 'react-leaflet';
import { fetchCurrentDroughtConditions } from '../services/noaaService';

// Drought intensity scale colors and labels
const DROUGHT_INTENSITY = {
  D0: { color: '#FCD37F', label: 'Abnormally Dry' },
  D1: { color: '#FFAA00', label: 'Moderate Drought' },
  D2: { color: '#E37400', label: 'Severe Drought' },
  D3: { color: '#BE3A34', label: 'Extreme Drought' },
  D4: { color: '#8B1A1A', label: 'Exceptional Drought' },
};

// Style function for GeoJSON features
const getStyle = (feature) => {
  const dm = feature.properties.dm || 'D0';
  const color = DROUGHT_INTENSITY[dm]?.color || '#CCCCCC';
  
  return {
    fillColor: color,
    weight: 1,
    opacity: 1,
    color: 'white',
    dashArray: '3',
    fillOpacity: 0.7
  };
};

// Convert NOAA API response to GeoJSON format
const convertToGeoJSON = (data) => {
  if (!data || !data.length) return null;
  
  // This is a simplified conversion - in a real app, you'd want to properly
  // map the NOAA data to GeoJSON features with proper geometry
  return {
    type: 'FeatureCollection',
    features: data.map(item => ({
      type: 'Feature',
      properties: {
        ...item,
        name: item.area_name || 'Unknown Area',
        dm: item.dm,
        area_pct: item.area_pct,
        valid_start: item.valid_start,
        valid_end: item.valid_end
      },
      // Note: In a real implementation, you'd want to include proper geometry
      // from the NOAA data or another source like TIGER/Line shapefiles
      geometry: {
        type: 'Polygon',
        coordinates: [] // This would contain the actual coordinates
      }
    }))
  };
};

const DroughtLayer = ({ 
  bounds, 
  visible = true, 
  onDataLoad,
  onError 
}) => {
  const [droughtData, setDroughtData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Convert bounds to the format expected by the NOAA API
  const noaaBounds = useMemo(() => ({
    north: bounds?._northEast?.lat || 0,
    south: bounds?._southWest?.lat || 0,
    east: bounds?._northEast?.lng || 0,
    west: bounds?._southWest?.lng || 0
  }), [bounds]);

  // Fetch drought data when bounds change
  useEffect(() => {
    if (!visible || !bounds) return;
    
    const loadDroughtData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await fetchCurrentDroughtConditions(noaaBounds);
        setDroughtData(data);
        if (onDataLoad) onDataLoad(data);
      } catch (err) {
        console.error('Error loading drought data:', err);
        setError('Failed to load drought data');
        if (onError) onError(err);
      } finally {
        setLoading(false);
      }
    };
    
    loadDroughtData();
  }, [visible, noaaBounds, bounds, onDataLoad, onError]);

  // Convert API data to GeoJSON
  const geoJsonData = useMemo(() => {
    if (!droughtData) return null;
    return convertToGeoJSON(droughtData);
  }, [droughtData]);

  // Create a legend for the drought layer
  const renderLegend = () => (
    <div className="drought-legend">
      <h4>Drought Conditions</h4>
      {Object.entries(DROUGHT_INTENSITY).map(([key, { color, label }]) => (
        <div key={key} className="legend-item">
          <span className="legend-color" style={{ backgroundColor: color }}></span>
          <span>{label} ({key})</span>
        </div>
      ))}
      {loading && <div className="loading-indicator">Loading drought data...</div>}
      {error && <div className="error-message">{error}</div>}
    </div>
  );

  if (!visible || !geoJsonData) return null;

  // Function to render popup content for each feature
  const onEachFeature = (feature, layer) => {
    if (feature.properties) {
      const { name, dm, area_pct, valid_start, valid_end } = feature.properties;
      const intensity = DROUGHT_INTENSITY[dm]?.label || 'Unknown';
      
      const popupContent = `
        <div class="drought-popup">
          <h4>${name || 'Unknown Area'}</h4>
          <div class="drought-info">
            <div class="drought-intensity" style="background-color: ${DROUGHT_INTENSITY[dm]?.color || '#CCCCCC'}">
              ${intensity} (${dm || 'N/A'})
            </div>
            <p><strong>Area Affected:</strong> ${area_pct ? `${area_pct}%` : 'N/A'}</p>
            <p><strong>Valid:</strong> ${valid_start || 'N/A'} to ${valid_end || 'N/A'}</p>
          </div>
        </div>
      `;
      
      layer.bindPopup(popupContent);
    }
  };

  return (
    <>
      {geoJsonData && (
        <GeoJSON
          key={JSON.stringify(geoJsonData)}
          data={geoJsonData}
          style={getStyle}
          onEachFeature={onEachFeature}
        />
      )}
      {renderLegend()}
    </>
  );
};

export default DroughtLayer;
