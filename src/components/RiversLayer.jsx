import React, { useState, useEffect, useMemo } from 'react';
import { GeoJSON } from 'react-leaflet';

// Rivers styling based on stream order for optimal cartographic hierarchy
const getStreamStyle = (streamOrder) => {
  if (streamOrder >= 6) {
    // Major rivers: 1.5-2pt lines, 60% opacity, blue-gray (#4a90a4)
    return {
      weight: 2,
      opacity: 0.6,
      color: '#4a90a4',
      lineCap: 'round',
      lineJoin: 'round',
      smoothFactor: 1.0
    };
  } else if (streamOrder >= 3) {
    // Secondary streams: 1pt lines, 40% opacity, lighter blue-gray (#6ba3b5)
    return {
      weight: 1,
      opacity: 0.4,
      color: '#6ba3b5',
      lineCap: 'round',
      lineJoin: 'round',
      smoothFactor: 1.0
    };
  } else {
    // Minor tributaries: 0.5pt lines, 25% opacity, very light blue-gray (#8cb6c6)
    return {
      weight: 0.5,
      opacity: 0.25,
      color: '#8cb6c6',
      lineCap: 'round',
      lineJoin: 'round',
      smoothFactor: 1.0
    };
  }
};

// Style function for GeoJSON features
const getStyle = (feature) => {
  const streamOrder = feature.properties.stream_order || feature.properties.streamorder || 1;
  return getStreamStyle(streamOrder);
};

const RiversLayer = ({ 
  visible = true, 
  bounds = null,
  onDataLoad = null,
  onError = null,
  riversData = null // Allow passing pre-loaded rivers data
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [geoJsonData, setGeoJsonData] = useState(null);

  // Load rivers data when component mounts or bounds change
  useEffect(() => {
    if (!visible) return;

    const loadRiversData = async () => {
      if (riversData) {
        // Use pre-loaded data if provided
        setGeoJsonData(riversData);
        if (onDataLoad) onDataLoad(riversData);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // In a real implementation, this would fetch from NHD or similar service
        // For now, we'll create a placeholder that can be replaced with actual data
        const mockRiversData = await fetchRiversData(bounds);
        setGeoJsonData(mockRiversData);
        if (onDataLoad) onDataLoad(mockRiversData);
      } catch (err) {
        console.error('Error loading rivers data:', err);
        setError('Failed to load rivers data');
        if (onError) onError(err);
      } finally {
        setLoading(false);
      }
    };

    loadRiversData();
  }, [visible, bounds, riversData, onDataLoad, onError]);

  // Mock function for loading rivers data
  // In a real implementation, this would call a service to fetch NHD data
  const fetchRiversData = async (bounds) => {
    // This is a placeholder for actual NHD data loading
    // You would typically fetch from USGS National Map or similar service
    return new Promise((resolve) => {
      // Simulate API delay
      setTimeout(() => {
        resolve({
          type: 'FeatureCollection',
          features: [
            // Sample feature - in real implementation, this would come from NHD
            {
              type: 'Feature',
              properties: {
                name: 'San Juan River',
                stream_order: 7,
                reach_code: '14080101001234'
              },
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-109.0, 37.0],
                  [-109.1, 37.1],
                  [-109.2, 37.2]
                ]
              }
            }
          ]
        });
      }, 1000);
    });
  };

  // Handle feature interactions
  const onEachFeature = (feature, layer) => {
    if (feature.properties) {
      const { name, stream_order, reach_code } = feature.properties;
      const streamOrder = stream_order || 1;
      
      let streamType = 'Minor Tributary';
      if (streamOrder >= 6) {
        streamType = 'Major River';
      } else if (streamOrder >= 3) {
        streamType = 'Secondary Stream';
      }
      
      const popupContent = `
        <div class="river-popup">
          <h4>${name || 'Unnamed Stream'}</h4>
          <div class="stream-info">
            <p><strong>Type:</strong> ${streamType}</p>
            <p><strong>Stream Order:</strong> ${streamOrder}</p>
            ${reach_code ? `<p><strong>Reach Code:</strong> ${reach_code}</p>` : ''}
          </div>
        </div>
      `;
      
      layer.bindPopup(popupContent);
      
      // Add hover effects
      layer.on('mouseover', (e) => {
        const layer = e.target;
        layer.setStyle({
          weight: layer.options.weight * 2,
          opacity: Math.min(layer.options.opacity * 1.5, 1.0)
        });
      });
      
      layer.on('mouseout', (e) => {
        const layer = e.target;
        const streamOrder = layer.feature.properties.stream_order || 1;
        layer.setStyle(getStreamStyle(streamOrder));
      });
    }
  };

  if (!visible) return null;

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
    </>
  );
};

export default RiversLayer; 