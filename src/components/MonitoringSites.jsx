import React, { useState, useEffect } from 'react'
import { fetchStreamflowData } from '../services/usgsService'

const MonitoringSites = ({ sites, selectedSite, onSiteSelect }) => {
  const [siteStatus, setSiteStatus] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSiteData = async () => {
      setLoading(true)
      const statusData = {}
      
      for (const site of sites) {
        try {
          const data = await fetchStreamflowData(site.siteNo, 1) // Last 1 day
          statusData[site.siteNo] = {
            status: 'online',
            currentFlow: data.length > 0 ? data[data.length - 1].value : 'N/A',
            lastUpdate: data.length > 0 ? data[data.length - 1].dateTime : null
          }
        } catch (error) {
          statusData[site.siteNo] = {
            status: 'offline',
            currentFlow: 'N/A',
            lastUpdate: null
          }
        }
      }
      
      setSiteStatus(statusData)
      setLoading(false)
    }

    if (sites.length > 0) {
      loadSiteData()
    }
  }, [sites])

  if (loading) {
    return (
      <div className="monitoring-sites-loading">
        <p>Loading monitoring site data...</p>
      </div>
    )
  }

  return (
    <div className="monitoring-sites">
      <div className="grid grid-3">
        {sites.map((site) => {
          const status = siteStatus[site.siteNo] || { status: 'loading', currentFlow: 'N/A' }
          const isSelected = selectedSite?.siteNo === site.siteNo
          
          return (
            <div 
              key={site.siteNo}
              className={`site-card card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSiteSelect(site)}
            >
              <div className="card-header">
                <div className="site-header">
                  <h3 className="site-name">{site.name}</h3>
                  <div className={`site-status ${status.status}`}>
                    <span className={`status-dot status-${status.status}`}></span>
                    <span className="status-text">
                      {status.status === 'online' ? 'Live' : 'Offline'}
                    </span>
                  </div>
                </div>
                <div className="site-location">
                  <span className="location-text">
                    {site.state} • {site.latitude.toFixed(4)}°, {site.longitude.toFixed(4)}°
                  </span>
                </div>
              </div>

              <div className="site-metrics">
                <div className="metric">
                  <span className="metric-label">Current Flow</span>
                  <span className="metric-value">
                    {status.currentFlow !== 'N/A' 
                      ? `${parseFloat(status.currentFlow).toLocaleString()} cfs`
                      : 'N/A'
                    }
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Site ID</span>
                  <span className="metric-value">{site.siteNo}</span>
                </div>
              </div>

              <div className="site-actions">
                <button className="btn btn-secondary">
                  View Details
                </button>
                <a 
                  href={site.usgsUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  USGS Data
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MonitoringSites 