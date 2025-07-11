import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Marker, Popup, useMap, LayerGroup } from 'react-leaflet';
import { divIcon } from 'leaflet';
import { fetchWaterQualityData, getCharacteristicNames } from '../services/epaService';

// Create a water quality marker icon
const createWaterQualityIcon = (status) => {
  let color = '#9ca3af'; // Default gray for unknown status
  
  // Simple status-based coloring (can be enhanced based on actual water quality metrics)
  if (status === 'good') color = '#10b981'; // Green
  else if (status === 'fair') color = '#f59e0b'; // Yellow
  else if (status === 'poor') color = '#ef4444'; // Red
  
  return divIcon({
    className: 'water-quality-marker',
    html: `<div style="
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: ${color};
      border: 2px solid rgba(255, 255, 255, 0.4);
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
};

// Determine status based on water quality metrics
const determineStatus = (characteristics) => {
  // Simple logic to determine status based on common water quality metrics
  // This can be enhanced based on specific requirements
  if (!characteristics) return 'unknown';
  
  const hasCriticalIssue = Object.values(characteristics).some(char => {
    // Example: Check for critical levels of certain parameters
    const latestValue = char.values[0]?.value;
    if (typeof latestValue !== 'number') return false;
    
    // These thresholds are examples and should be adjusted based on actual water quality standards
    if (char.name.toLowerCase().includes('ph')) {
      return latestValue < 6.5 || latestValue > 8.5; // pH outside safe range
    }
    if (char.name.toLowerCase().includes('dissolved oxygen')) {
      return latestValue < 5; // Low dissolved oxygen
    }
    if (char.name.toLowerCase().includes('e. coli') || 
        char.name.toLowerCase().includes('coliform')) {
      return latestValue > 100; // High bacteria count
    }
    return false;
  });
  
  if (hasCriticalIssue) return 'poor';
  
  // Check for fair conditions
  const hasWarning = Object.values(characteristics).some(char => {
    const latestValue = char.values[0]?.value;
    if (typeof latestValue !== 'number') return false;
    
    if (char.name.toLowerCase().includes('ph')) {
      return latestValue < 7 || latestValue > 8; // Approaching limits
    }
    if (char.name.toLowerCase().includes('dissolved oxygen')) {
      return latestValue < 6; // Approaching low
    }
    return false;
  });
  
  return hasWarning ? 'fair' : 'good';
};

const WaterQualityLayer = ({ 
  bounds, 
  visible = true, 
  onDataLoad,
  onError,
  selectedCharacteristics = []
}) => {
  const [waterQualityData, setWaterQualityData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availableCharacteristics, setAvailableCharacteristics] = useState([]);
  const map = useMap();

  // Get the center point of the map bounds
  const center = useMemo(() => {
    if (!bounds) return null;
    return [
      (bounds._southWest.lat + bounds._northEast.lat) / 2,
      (bounds._southWest.lng + bounds._northEast.lng) / 2
    ];
  }, [bounds]);

  // Load available characteristic names
  const loadCharacteristicNames = useCallback(async () => {
    try {
      const characteristics = await getCharacteristicNames();
      setAvailableCharacteristics(characteristics);
    } catch (err) {
      console.error('Error loading characteristic names:', err);
    }
  }, []);

  // Filter data based on selected characteristics
  const filteredData = useMemo(() => {
    if (!selectedCharacteristics.length) return waterQualityData;
    
    return waterQualityData.map(location => {
      const filteredCharacteristics = Object.entries(location.characteristics)
        .filter(([key]) => selectedCharacteristics.includes(key))
        .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});
      
      return {
        ...location,
        characteristics: filteredCharacteristics
      };
    }).filter(location => Object.keys(location.characteristics).length > 0);
  }, [waterQualityData, selectedCharacteristics]);

  // Fetch water quality data when map bounds change
  useEffect(() => {
    if (!visible || !center) return;
    
    const loadWaterQualityData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Calculate radius based on map bounds
        const radius = Math.min(
          map.distance(
            [bounds._southWest.lat, bounds._southWest.lng],
            [bounds._northEast.lat, bounds._southWest.lng]
          ) / 1609.34, // Convert meters to miles
          50 // Max 50 miles radius
        );
        
        // Only fetch characteristics that are selected or all if none selected
        const characteristicsToFetch = selectedCharacteristics.length > 0 
          ? selectedCharacteristics 
          : [
              'pH', 
              'Dissolved oxygen (DO)',
              'Escherichia coli',
              'Total Coliform',
              'Turbidity',
              'Temperature, water',
              'Specific conductance',
              'Nitrate',
              'Phosphorus',
              'Chlorophyll a'
            ];
        
        const data = await fetchWaterQualityData({
          latitude: center[0],
          longitude: center[1],
          radius,
          characteristicNames: characteristicsToFetch
        });
        
        setWaterQualityData(data);
        if (onDataLoad) onDataLoad(data);
      } catch (err) {
        console.error('Error loading water quality data:', err);
        setError('Failed to load water quality data');
        if (onError) onError(err);
      } finally {
        setLoading(false);
      }
    };
    
    loadWaterQualityData();
    loadCharacteristicNames();
  }, [visible, center, bounds, map, onDataLoad, onError, selectedCharacteristics, loadCharacteristicNames]);

  // Format characteristic value with units
  const formatCharacteristic = (char) => {
    const latest = char.values[0];
    if (!latest) return '';
    
    let value = latest.value;
    if (typeof value === 'number') {
      // Format numbers to 2 decimal places if needed
      value = value % 1 === 0 ? value : value.toFixed(2);
    }
    
    return `${value} ${char.unit || ''}`.trim();
  };

  if (!visible) return null;
  
  return (
    <LayerGroup>
      {filteredData.map((location) => {
        const status = determineStatus(location.characteristics);
        
        return (
          <Marker
            key={location.locationId}
            position={[location.latitude, location.longitude]}
            icon={createWaterQualityIcon(status)}
          >
            <Popup>
              <div className="water-quality-popup">
                <h4>{location.locationName}</h4>
                <div className="water-quality-status">
                  <span className={`status-indicator status-${status}`}></span>
                  <span className="status-text">
                    {status === 'good' ? 'Good' : status === 'fair' ? 'Fair' : 'Poor'}
                  </span>
                </div>
                <div className="water-quality-metrics">
                  {Object.entries(location.characteristics).map(([key, char]) => (
                    <div key={key} className="water-quality-metric">
                      <span className="metric-name">{char.name}:</span>
                      <span className="metric-value">{formatCharacteristic(char)}</span>
                    </div>
                  ))}
                </div>
                {location.characteristics[0]?.lastUpdated && (
                  <div className="last-updated">
                    Last updated: {new Date(location.characteristics[0].lastUpdated).toLocaleDateString()}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
      
      {loading && (
        <div className="water-quality-loading">
          Loading water quality data...
        </div>
      )}
      
      {error && (
        <div className="water-quality-error">
          {error}
        </div>
      )}
    </LayerGroup>
  );
};

export default React.memo(WaterQualityLayer);
