import React from 'react'
import usgsData from '../data/usgs-sites.json'

const About = () => {
  return (
    <div className="about-page">
      {/* Hero Section */}
      <section className="about-hero">
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
                <span className="stat-number">{usgsData.sites.length}</span>
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

      {/* Mission Section */}
      <section className="mission-section">
        <div className="container">
          <div className="content-container">
            <h2>Our Mission</h2>
            <p className="lead">
              Environmental and water resource managers — and everyday citizens — often struggle 
              to easily access and understand the health of nearby water bodies. Most tools are 
              clunky, government-sourced, or deeply technical. We need an accessible, beautiful, 
              interactive tool to democratize water health awareness.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2>Features</h2>
          <div className="grid grid-3">
            <div className="feature-card">
              <div className="feature-icon">🗺️</div>
              <h3>Interactive Mapping</h3>
              <p>
                Explore watersheds and stream gauges with real-time data visualization. 
                Click markers to dive deep into site-specific metrics and trends.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Real-time Data</h3>
              <p>
                Live streamflow data from USGS monitoring stations, updated continuously 
                to provide the most current water conditions.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Mobile Ready</h3>
              <p>
                Responsive design optimized for field use. Access critical water data 
                on any device, anywhere in the watershed.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">♿</div>
              <h3>Accessible Design</h3>
              <p>
                Built with accessibility in mind, featuring high color contrast, 
                keyboard navigation, and screen reader compatibility.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Focus on Quality</h3>
              <p>
                Curated selection of high-quality monitoring sites across the San Juan 
                River Basin for reliable, consistent data.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>Historical Trends</h3>
              <p>
                View 7-day historical trends and understand seasonal patterns in 
                streamflow and water conditions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Data Sources Section */}
      <section className="data-sources-section">
        <div className="container">
          <div className="content-container">
            <h2>Data Sources</h2>
            <p>
              Water Watcher integrates multiple authoritative data sources to provide 
              comprehensive water health insights:
            </p>
            <div className="data-sources-grid">
              <div className="data-source">
                <h4>USGS National Water Information System</h4>
                <p>
                  Real-time streamflow data from the U.S. Geological Survey's extensive 
                  monitoring network, providing accurate and up-to-date discharge measurements.
                </p>
                <span className="data-badge">Real-time</span>
              </div>
              <div className="data-source">
                <h4>EPA Water Quality Portal</h4>
                <p>
                  Water quality metrics including pH, dissolved oxygen, and nutrient levels 
                  from the Environmental Protection Agency's comprehensive database.
                </p>
                <span className="data-badge">Quality Assured</span>
              </div>
              <div className="data-source">
                <h4>NOAA Drought Monitor</h4>
                <p>
                  Drought severity indicators and climate data from the National Oceanic 
                  and Atmospheric Administration for environmental context.
                </p>
                <span className="data-badge">Climate Data</span>
              </div>
              <div className="data-source">
                <h4>USGS HUC Boundaries</h4>
                <p>
                  Hydrologic Unit Code watershed boundaries providing geographic context 
                  for understanding drainage areas and basin characteristics.
                </p>
                <span className="data-badge">Geographic</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Target Audience Section */}
      <section className="audience-section">
        <div className="container">
          <h2>Who We Serve</h2>
          <div className="grid grid-2">
            <div className="audience-card">
              <h3>Environmental Professionals</h3>
              <p>
                Water resource managers, environmental consultants, and researchers who need 
                quick access to reliable water data for decision-making and analysis.
              </p>
            </div>
            <div className="audience-card">
              <h3>Outdoor Enthusiasts</h3>
              <p>
                Recreationists, anglers, and river guides who want to understand current 
                water conditions for safety and planning purposes.
              </p>
            </div>
            <div className="audience-card">
              <h3>Concerned Citizens</h3>
              <p>
                Community members interested in understanding the health of their local 
                waterways and staying informed about environmental conditions.
              </p>
            </div>
            <div className="audience-card">
              <h3>Students & Educators</h3>
              <p>
                Academic users who need accessible tools for environmental education 
                and research in water resources and hydrology.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="technology-section">
        <div className="container">
          <div className="content-container">
            <h2>Built with Modern Technology</h2>
            <p>
              Water Watcher leverages cutting-edge web technologies to deliver a fast, 
              reliable, and user-friendly experience:
            </p>
            <div className="tech-stack">
              <div className="tech-group">
                <h4>Frontend</h4>
                <ul>
                  <li>React + Vite for fast development and performance</li>
                  <li>Leaflet.js for interactive mapping</li>
                  <li>Chart.js for data visualization</li>
                  <li>Modern CSS with responsive design</li>
                </ul>
              </div>
              <div className="tech-group">
                <h4>Data & APIs</h4>
                <ul>
                  <li>Real-time USGS API integration</li>
                  <li>Client-side caching for performance</li>
                  <li>Error handling and data validation</li>
                  <li>Progressive data loading</li>
                </ul>
              </div>
              <div className="tech-group">
                <h4>Quality Assurance</h4>
                <ul>
                  <li>Jest and React Testing Library</li>
                  <li>ESLint for code quality</li>
                  <li>Accessibility testing and validation</li>
                  <li>Cross-browser compatibility</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Explore Water Health Today</h2>
            <p>
              Start exploring real-time water conditions across the San Juan River Basin. 
              Discover patterns, understand trends, and stay informed about freshwater health.
            </p>
            <div className="cta-buttons">
              <a href="#map" className="btn btn-primary">
                View Interactive Map
              </a>
              <a href="https://github.com/your-username/water-watcher" className="btn btn-secondary">
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default About 