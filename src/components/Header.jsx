import React from 'react'

const Header = ({ currentPage, onPageChange }) => {
  const currentTime = new Date().toLocaleString('en-US', {
    timeZone: 'America/Denver',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  })

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="header-brand">
            <h3 className="brand-title">Water Watcher</h3>
            <span className="brand-subtitle">Colorado Plateau</span>
          </div>
          
          <nav className="header-nav">
            <button 
              className={`nav-link ${currentPage === 'map' ? 'active' : ''}`}
              onClick={() => onPageChange('map')}
            >
              Map
            </button>
            <button 
              className={`nav-link ${currentPage === 'about' ? 'active' : ''}`}
              onClick={() => onPageChange('about')}
            >
              About
            </button>
          </nav>
          
          <div className="header-status">
            <div className="status-indicator">
              <span className="status-dot status-online"></span>
              <span className="status-text">Live Data</span>
            </div>
            <div className="current-time">
              <span className="time-label">Updated:</span>
              <span className="time-value">{currentTime}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header 