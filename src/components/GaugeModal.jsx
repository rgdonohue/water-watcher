import React, { useState, useEffect } from 'react';
import TimeSeriesChart from './TimeSeriesChart';
import { fetchStreamflowData } from '../services/usgsService';

const GaugeModal = ({ isOpen, onClose, siteData, siteCondition }) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('P7D');

  // Time period options supported by USGS
  const timePeriods = [
    { value: 'P1D', label: '1 Day', days: 1 },
    { value: 'P7D', label: '7 Days', days: 7 },
    { value: 'P30D', label: '30 Days', days: 30 },
    { value: 'P90D', label: '90 Days', days: 90 },
    { value: 'P365D', label: '1 Year', days: 365 }
  ];

  useEffect(() => {
    if (isOpen && siteData) {
      loadChartData();
    }
  }, [isOpen, siteData, selectedPeriod]);

  const loadChartData = async () => {
    if (!siteData) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetchStreamflowData(siteData.siteNo, selectedPeriod);
      
      if (response && response.value && response.value.timeSeries && response.value.timeSeries.length > 0) {
        const timeSeries = response.value.timeSeries[0];
        const values = timeSeries.values[0].value || [];
        
        // Convert USGS data to chart format
        const formattedData = values
          .filter(item => item.value && item.value !== '-999999')
          .map(item => {
            const date = new Date(item.dateTime);
            const flow = parseFloat(item.value);
            
            // Determine condition based on flow value (you can customize these thresholds)
            let condition = 'Normal';
            if (flow > 1000) condition = 'High';
            else if (flow < 200) condition = 'Low';
            
            return {
              dateTime: date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              }),
              flow: flow,
              condition: condition,
              parsedDate: date
            };
          })
          .reverse(); // Most recent first

        setChartData(formattedData);
      } else {
        setError('No data available for this time period');
      }
    } catch (err) {
      console.error('Error loading chart data:', err);
      setError('Failed to load chart data');
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
  };

  const formatFlow = (flow) => {
    if (flow === null || flow === undefined) return 'No data';
    return `${flow.toLocaleString()} cfs`;
  };

  const getConditionColor = (condition) => {
    switch(condition) {
      case 'High': return '#16a34a';
      case 'Low': return '#f59e0b';
      case 'Normal': 
      default: return '#2563eb';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{siteData?.name || 'Monitoring Station'}</h2>
            <p className="modal-subtitle">Site ID: {siteData?.siteNo}</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Site Information Panel */}
        <div className="site-info-panel">
          <div className="site-info-grid">
            <div className="info-item">
              <span className="info-label">Current Flow</span>
              <span className="info-value">
                {formatFlow(siteCondition?.currentFlow)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Status</span>
              <span 
                className="status-badge"
                style={{ 
                  backgroundColor: getConditionColor(siteCondition?.status),
                  color: 'white'
                }}
              >
                {siteCondition?.status || 'Unknown'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Location</span>
              <span className="info-value">
                {siteData?.state} • {siteData?.county}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Last Updated</span>
              <span className="info-value">
                {siteCondition?.lastUpdate || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* Time Period Controls */}
        <div className="time-period-controls">
          <span className="controls-label">Time Period:</span>
          <div className="period-buttons">
            {timePeriods.map(period => (
              <button
                key={period.value}
                className={`period-button ${selectedPeriod === period.value ? 'active' : ''}`}
                onClick={() => handlePeriodChange(period.value)}
                disabled={loading}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Section */}
        <div className="modal-chart-section">
          {loading && (
            <div className="chart-loading">
              <div className="loading-spinner"></div>
              <p>Loading chart data...</p>
            </div>
          )}
          
          {error && (
            <div className="chart-error">
              <p>⚠️ {error}</p>
              <button onClick={loadChartData} className="retry-button">
                Retry
              </button>
            </div>
          )}
          
          {!loading && !error && chartData.length > 0 && (
            <TimeSeriesChart
              data={chartData}
              width={800}
              height={400}
              title={`Flow Data - ${timePeriods.find(p => p.value === selectedPeriod)?.label}`}
            />
          )}
          
          {!loading && !error && chartData.length === 0 && (
            <div className="no-data">
              <p>No data available for the selected time period</p>
            </div>
          )}
        </div>

        {/* Footer with additional info */}
        <div className="modal-footer">
          <p className="data-source">
            Data source: USGS National Water Information System
          </p>
          <a 
            href={siteData?.usgsUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="usgs-link"
          >
            View on USGS →
          </a>
        </div>
      </div>
    </div>
  );
};

export default GaugeModal;