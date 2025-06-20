import React, { useState, useEffect } from 'react'
import { fetchStreamflowData } from '../services/usgsService'

const StreamflowChart = ({ siteData }) => {
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(7) // days
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadChartData = async () => {
      if (!siteData) return
      
      setLoading(true)
      setError(null)
      
      try {
        const data = await fetchStreamflowData(siteData.siteNo, timeRange)
        setChartData(data)
      } catch (err) {
        setError(`Failed to load data: ${err.message}`)
        console.error('Chart data loading error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadChartData()
  }, [siteData, timeRange])

  const getFlowCondition = (value) => {
    if (!value || isNaN(value)) return 'unknown'
    const flow = parseFloat(value)
    if (flow < 50) return 'low'
    if (flow > 1000) return 'high'
    return 'normal'
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!siteData) {
    return (
      <div className="chart-container">
        <p>Select a monitoring site to view streamflow data</p>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <div className="chart-header">
        <div className="chart-title-section">
          <h3 className="chart-title">Streamflow Data</h3>
          <p className="chart-subtitle">{siteData.name}</p>
        </div>
        
        <div className="chart-controls">
          <div className="time-range-selector">
            <button 
              className={`btn ${timeRange === 1 ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTimeRange(1)}
            >
              1 Day
            </button>
            <button 
              className={`btn ${timeRange === 7 ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTimeRange(7)}
            >
              7 Days
            </button>
            <button 
              className={`btn ${timeRange === 30 ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTimeRange(30)}
            >
              30 Days
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="chart-loading">
          <p>Loading streamflow data...</p>
        </div>
      )}

      {error && (
        <div className="chart-error">
          <p className="error-message">{error}</p>
          <p className="error-help">
            This could be due to USGS API limits or network issues. 
            Try selecting a different time range or check the USGS site directly.
          </p>
        </div>
      )}

      {!loading && !error && (
        <>
          {chartData.length === 0 ? (
            <div className="chart-no-data">
              <p>No streamflow data available for this time period.</p>
              <a 
                href={siteData.usgsUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                View on USGS
              </a>
            </div>
          ) : (
            <div className="chart-content">
              {/* Current Status */}
              <div className="current-status mb-6">
                <div className="grid grid-3">
                  <div className="stat-card">
                    <span className="stat-label">Current Flow</span>
                    <span className="stat-value">
                      {chartData.length > 0 
                        ? `${parseFloat(chartData[chartData.length - 1].value).toLocaleString()} cfs`
                        : 'N/A'
                      }
                    </span>
                    <span className={`stat-condition ${getFlowCondition(chartData[chartData.length - 1]?.value)}`}>
                      {getFlowCondition(chartData[chartData.length - 1]?.value).toUpperCase()}
                    </span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Data Points</span>
                    <span className="stat-value">{chartData.length}</span>
                    <span className="stat-condition">Last {timeRange} days</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Last Update</span>
                    <span className="stat-value">
                      {chartData.length > 0 
                        ? formatDate(chartData[chartData.length - 1].dateTime)
                        : 'N/A'
                      }
                    </span>
                    <span className="stat-condition">MST</span>
                  </div>
                </div>
              </div>

              {/* Simple Data Table */}
              <div className="data-table-container">
                <h4 className="mb-4">Recent Measurements</h4>
                <div className="data-table">
                  <div className="table-header">
                    <span>Date & Time</span>
                    <span>Flow (cfs)</span>
                    <span>Condition</span>
                  </div>
                  {chartData.slice(-10).reverse().map((point, index) => (
                    <div key={index} className="table-row">
                      <span className="table-cell">{formatDate(point.dateTime)}</span>
                      <span className="table-cell">{parseFloat(point.value).toLocaleString()}</span>
                      <span className={`table-cell condition ${getFlowCondition(point.value)}`}>
                        {getFlowCondition(point.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default StreamflowChart 