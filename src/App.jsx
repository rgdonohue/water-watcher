import React, { useState, useEffect } from 'react'
import usgsData from './data/usgs-sites.json'
import Header from './components/Header'
import MonitoringSites from './components/MonitoringSites'
import StreamflowChart from './components/StreamflowChart'

function App() {
  const [selectedSite, setSelectedSite] = useState(null)
  const [siteData, setSiteData] = useState([])

  useEffect(() => {
    // Load our USGS site data
    setSiteData(usgsData.sites)
  }, [])

  return (
    <div className="App">
      <Header />
      
      <main>
        {/* Hero Section */}
        <section className="hero">
          <div className="container">
            <div className="hero-content">
              <h1>Water Watcher</h1>
              <p className="hero-description">
                Real-time freshwater health monitoring for the Colorado Plateau region. 
                Track streamflow, water quality, and environmental conditions across 
                critical river systems in Colorado, Utah, Arizona, and New Mexico.
              </p>
              <div className="hero-stats">
                <div className="stat">
                  <span className="stat-number">{siteData.length}</span>
                  <span className="stat-label">Active Sites</span>
                </div>
                <div className="stat">
                  <span className="stat-number">{usgsData.meta.focus_area}</span>
                  <span className="stat-label">Focus Area</span>
                </div>
                <div className="stat">
                  <span className="stat-number status-online">●</span>
                  <span className="stat-label">Real-time Data</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Monitoring Sites Section */}
        <section className="monitoring-section">
          <div className="container">
            <div className="section-header mb-8">
              <h2>Active Monitoring Sites</h2>
              <p>
                Current conditions from USGS monitoring stations across the San Juan River Basin
              </p>
            </div>
            
            <MonitoringSites 
              sites={siteData}
              selectedSite={selectedSite}
              onSiteSelect={setSelectedSite}
            />
          </div>
        </section>

        {/* Chart Section */}
        {selectedSite && (
          <section className="chart-section">
            <div className="container">
              <StreamflowChart siteData={selectedSite} />
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App 