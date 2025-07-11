import React, { useState, useEffect, useCallback } from 'react';
import TimeSeriesChart from './TimeSeriesChart';
import { fetchStreamflowData } from '../services/usgsService';

const GaugeModal = ({ isOpen, onClose, siteData, siteCondition, allSites = [] }) => {
  const [chartData, setChartData] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('P7D');
  const [comparisonSiteId, setComparisonSiteId] = useState('');

  // Time period options supported by USGS
  const timePeriods = [
    { value: 'P1D', label: '1 Day', days: 1 },
    { value: 'P7D', label: '7 Days', days: 7 },
    { value: 'P30D', label: '30 Days', days: 30 },
    { value: 'P90D', label: '90 Days', days: 90 },
    { value: 'P365D', label: '1 Year', days: 365 }
  ];

  const loadChartData = useCallback(async () => {
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
              parsedDate: date,
              siteId: siteData.siteNo,
              siteName: siteData.name
            };
          })
          .reverse(); // Most recent first

        const dataWithAnomalies = detectAnomalies(formattedData);
        setChartData(dataWithAnomalies);
      } else {
        setError('No data available for this time period');
      }
    } catch (err) {
      console.error('Error loading chart data:', err);
      setError('Failed to load chart data');
    } finally {
      setLoading(false);
    }
  }, [siteData, selectedPeriod]);

  const loadComparisonData = useCallback(async () => {
    if (!comparisonSiteId) return;

    console.log('Loading comparison data for site:', comparisonSiteId);
    setComparisonLoading(true);
    const comparisonSite = allSites.find(site => site.siteNo === comparisonSiteId);

    try {
      const response = await fetchStreamflowData(comparisonSiteId, selectedPeriod);
      
      if (response && response.value && response.value.timeSeries && response.value.timeSeries.length > 0) {
        const timeSeries = response.value.timeSeries[0];
        const values = timeSeries.values[0].value || [];
        
        // Convert USGS data to chart format
        const formattedData = values
          .filter(item => item.value && item.value !== '-999999')
          .map(item => {
            const date = new Date(item.dateTime);
            const flow = parseFloat(item.value);
            
            // Determine condition based on flow value
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
              parsedDate: date,
              siteId: comparisonSiteId,
              siteName: comparisonSite?.name || 'Unknown Site'
            };
          })
          .reverse(); // Most recent first

        console.log('Loaded comparison data:', formattedData.length, 'points');
        const dataWithAnomalies = detectAnomalies(formattedData);
        setComparisonData(dataWithAnomalies);
      } else {
        console.warn('No comparison data available for this time period');
        setComparisonData([]);
      }
    } catch (err) {
      console.error('Error loading comparison data:', err);
      setComparisonData([]);
    } finally {
      setComparisonLoading(false);
    }
  }, [comparisonSiteId, selectedPeriod, allSites]);

  // Function to detect data anomalies and outliers
  const detectAnomalies = useCallback((data) => {
    if (!data || data.length < 10) return data; // Need more data points for meaningful detection
    
    const flows = data.map(d => d.flow);
    const mean = flows.reduce((sum, val) => sum + val, 0) / flows.length;
    const variance = flows.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / flows.length;
    const stdDev = Math.sqrt(variance);
    
    // Much more conservative thresholds
    const zScoreThreshold = 4; // Increased from 3 to 4 standard deviations (more conservative)
    const changeThreshold = 5; // Increased from 2 to 5 (500% change, much more conservative)
    const impossibleThreshold = 15; // Increased from 10 to 15 standard deviations
    
    let anomalyCount = 0;
    const anomalies = [];
    
    const processedData = data.map((point, index) => {
      const zScore = Math.abs((point.flow - mean) / stdDev);
      const isOutlier = zScore > zScoreThreshold;
      
      // Check for sudden rate changes (comparing to previous point)
      let isSuddenChange = false;
      if (index > 0) {
        const prevFlow = data[index - 1].flow;
        const changeRatio = Math.abs(point.flow - prevFlow) / Math.max(prevFlow, 1);
        isSuddenChange = changeRatio > changeThreshold;
      }
      
      // Check for impossible values (negative flow, extremely high values)
      const isImpossible = point.flow < 0 || point.flow > mean + impossibleThreshold * stdDev;
      
      const hasAnomaly = isOutlier || isSuddenChange || isImpossible;
      
      if (hasAnomaly) {
        anomalyCount++;
        anomalies.push({
          index,
          dateTime: point.dateTime,
          flow: point.flow,
          reasons: {
            outlier: isOutlier ? `Z-score: ${zScore.toFixed(2)}` : null,
            suddenChange: isSuddenChange ? 'Large flow change' : null,
            impossible: isImpossible ? 'Impossible value' : null
          }
        });
      }
      
      return {
        ...point,
        anomaly: {
          isOutlier,
          isSuddenChange,
          isImpossible,
          zScore: zScore.toFixed(2),
          hasAnomaly: false // DISABLED: Don't show visual anomalies for now
        }
      };
    });
    
    // Log anomalies to console for inspection instead of visual display
    if (anomalyCount > 0) {
      console.group(`🔍 Data Quality Analysis - ${data[0]?.siteName || 'Unknown Site'}`);
      console.log(`Found ${anomalyCount} potential anomalies out of ${data.length} data points (${(anomalyCount/data.length*100).toFixed(1)}%)`);
      console.log('Statistics:', {
        mean: mean.toFixed(2),
        stdDev: stdDev.toFixed(2),
        thresholds: {
          zScore: zScoreThreshold,
          changeRatio: changeThreshold,
          impossibleStdDev: impossibleThreshold
        }
      });
      console.table(anomalies.slice(0, 10)); // Show first 10 anomalies
      if (anomalies.length > 10) {
        console.log(`... and ${anomalies.length - 10} more anomalies`);
      }
      console.log('💡 Data Validation Strategies:');
      console.log('  • Compare with nearby stations for cross-validation');
      console.log('  • Check USGS data qualifiers (P=provisional, A=approved)');  
      console.log('  • Verify against weather events and precipitation data');
      console.log('  • Inspect raw USGS data at: https://waterdata.usgs.gov/nwis/iv?site_no=' + (data[0]?.siteId || 'SITE_ID'));
      console.groupEnd();
    }
    
    return processedData;
  }, []);

  useEffect(() => {
    if (isOpen && siteData) {
      loadChartData();
    }
  }, [isOpen, siteData, loadChartData]);

  useEffect(() => {
    console.log('Comparison effect triggered:', { isOpen, comparisonSiteId });
    if (isOpen && comparisonSiteId) {
      loadComparisonData();
    } else {
      setComparisonData([]);
    }
  }, [isOpen, comparisonSiteId, loadComparisonData]);

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
  };

  const handleComparisonSiteChange = (siteId) => {
    console.log('Comparison site changed to:', siteId);
    setComparisonSiteId(siteId);
  };

  // Reset comparison when modal closes
  useEffect(() => {
    if (!isOpen) {
      setComparisonSiteId('');
      setComparisonData([]);
    }
  }, [isOpen]);

  // Get available sites for comparison (excluding current site)
  const availableComparisonSites = allSites.filter(site => 
    site.siteNo !== siteData?.siteNo
  ).sort((a, b) => a.name.localeCompare(b.name));

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

        {/* Comparison Controls */}
        {availableComparisonSites.length > 0 && (
          <div className="comparison-controls">
            <span className="controls-label">Compare with:</span>
            <div className="comparison-dropdown">
              <select 
                value={comparisonSiteId} 
                onChange={(e) => handleComparisonSiteChange(e.target.value)}
                disabled={loading || comparisonLoading}
                className="comparison-select"
              >
                <option value="">Select a station to compare...</option>
                {availableComparisonSites.map(site => (
                  <option key={site.siteNo} value={site.siteNo}>
                    {site.name} ({site.siteNo})
                  </option>
                ))}
              </select>
              {comparisonLoading && (
                <div className="comparison-loading">
                  <div className="loading-spinner-small"></div>
                  <span>Loading comparison data...</span>
                </div>
              )}
            </div>
          </div>
        )}

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
            <>
              <TimeSeriesChart 
                data={chartData}
                comparisonData={comparisonData}
                width={800}
                height={400}
                title={`Flow Data Comparison - ${selectedPeriod === 'P7D' ? '7 Days' : selectedPeriod === 'P30D' ? '30 Days' : '90 Days'}`}
              />
            </>
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