import React, { useState, useEffect } from 'react'
import usgsData from './data/usgs-sites.json'
import Header from './components/Header'
import WaterMap from './components/WaterMap'
import StreamflowChart from './components/StreamflowChart'
import About from './components/About'

function App() {
  const [selectedSite, setSelectedSite] = useState(null)
  const [siteData, setSiteData] = useState([])
  const [currentPage, setCurrentPage] = useState('map')

  useEffect(() => {
    // Load our USGS site data
    setSiteData(usgsData.sites)
  }, [])

  const renderPage = () => {
    switch (currentPage) {
      case 'about':
        return <About />
      case 'map':
      default:
        return (
          <>
            {/* Interactive Map Section */}
            <section className="map-section">
              <div className="container">
                <div className="section-header mb-8">
                  <h2>San Juan River Basin Monitoring</h2>
                  <p>
                    Explore real-time water conditions across the San Juan River Basin. 
                    Click on markers to view detailed streamflow data and trends.
                  </p>
                </div>
                
                <WaterMap 
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
          </>
        )
    }
  }

  return (
    <div className="App">
      <Header currentPage={currentPage} onPageChange={setCurrentPage} />
      
      <main>
        {renderPage()}
      </main>
    </div>
  )
}

export default App 