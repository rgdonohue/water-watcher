# 🛠️ Project PRD: Water Watcher — Interactive Freshwater Health Explorer

## Summary
A lightweight, web-based map app that visualizes freshwater health indicators across the Colorado Plateau (CO, NM, AZ, UT). Pulls open datasets like EPA Water Quality, USGS Streamflow, and overlays drought indicators dynamically. Users can click a watershed or stream gauge to see health metrics, trends, and historical comparison charts.

---

## Problem Statement
Environmental and water resource managers — and everyday citizens — often struggle to easily access and understand the health of nearby water bodies. Most tools are clunky, government-sourced, or deeply technical. We need an accessible, beautiful, interactive tool to democratize water health awareness.

---

## Target Audience
- Environmental planners
- Outdoor recreationists
- Concerned citizens
- Portfolio reviewers and hiring managers

---

## Features (MVP Scope)
- Interactive map (Leaflet.js, MapLibre, or OpenLayers) showing:
  - Watersheds / stream gauges
  - Real-time or recent water quality metrics (e.g., pH, dissolved oxygen, nitrates)
  - Streamflow (USGS)
  - Drought severity overlays (NOAA)
- On-click popups with:
  - Current water quality rating (good/moderate/poor)
  - Latest streamflow
  - 7-day historical trends (small embedded chart)
- Simple layer toggles:
  - Water quality
  - Drought severity
  - Streamflow velocity
- Basic search (by watershed, river, or city; supports fuzzy matching)
- Mobile responsive design
- Accessibility: color contrast, keyboard navigation

---

## Nice-to-Haves (Stretch Goals)
- Animating trends over time (time slider)
- Story popups ("This river is critical habitat for ___")
- "Report a Concern" form (fake/demo)

---

## Data Sources
- USGS National Water Dashboard API (streamflow, water quality)
- EPA Water Quality Portal (DO, pH, nitrates, etc.)
- NOAA Drought Monitor Shapefiles
- Public watershed shapefiles (USGS HUC boundaries)

---

## Tech Stack
| Layer         | Tools                           |
|---------------|---------------------------------|
| Frontend      | Next.js or simple Vite+React app |
| Mapping       | Leaflet.js / OpenLayers          |
| Charts        | Chart.js or ECharts              |
| Backend (optional) | FastAPI for API caching      |
| Hosting       | Vercel / Netlify / GitHub Pages  |
| Testing       | Jest, React Testing Library, pytest, Cypress/Playwright |
| Linting/Static| ESLint, Prettier, mypy (if Python) |

---

## 🧪 Testing & Test-Driven Development

### Philosophy
- Adopt TDD for core features: Write tests before implementing new functionality to ensure reliability and guide development.

### Testing Stack
- **Frontend:** Jest, React Testing Library
- **Backend (if used):** pytest, httpx, FastAPI TestClient
- **E2E/Integration:** Cypress or Playwright
- **Linting/Static:** ESLint, Prettier, mypy (if Python)

---

## Timeline
| Day         | Tasks |
|-------------|-------|
| Day 1–2 | Project setup, base map rendering, initial dataset download |
| Day 3 | Build click popups + simple charts |
| Day 4 | Add layer toggles + simple search |
| Day 5 | Polish frontend: mobile responsiveness, design tweaks |
| Day 6 | Write project description, set up live demo, record 2-min walkthrough video |
| Day 7 | Push portfolio update, soft launch on LinkedIn/github/blog |

---

## Success Metrics
- ✔️ Functional interactive map and popups
- ✔️ Live public demo link
- ✔️ Clean, documented GitHub repo
- ✔️ 1–2 paragraph writeup + 2-minute demo video
- ✔️ Optional LinkedIn post to showcase project
- ✔️ Data updates at least daily
- ✔️ Loads on mobile in <3s
- ✔️ No user login required
- ✔️ Basic accessibility (color contrast, keyboard navigation)
- ✔️ 80%+ test coverage on core features
- ✔️ All critical user flows covered by automated tests
- ✔️ Tests run automatically on each PR/commit

---

## Risks & Dependencies
- API rate limits or outages
- Data source schema changes
- Map library or charting bugs
- Test flakiness due to external API changes or rate limits
- Time required to maintain tests as features evolve

---

## Why This Project?
- **Relevant:** Focused on environmental data, water resources, spatial analysis.
- **Showcases:** Python, JavaScript mapping, API integration, data visualization.
- **Expandable:** Add ML, climate overlays, or more community tools later.
- **Political:** Reflects values around environment, justice, and open data.

---

## Final Thought
_"Rushing streams carve deepest not by speed, but by steady intention."_

---

## 📋 Comprehensive Task List

### 1. Project Setup
- [ ] Create GitHub repo, set up README, add PRD
- [ ] Choose frontend stack (Next.js or Vite+React)
- [ ] Set up project structure, install dependencies (map, chart, UI libraries)
- [ ] Set up basic CI (optional)

### 2. Base Map & Data Integration
- [ ] Render base map (Leaflet/OpenLayers)
- [ ] Download and preprocess initial datasets (USGS, EPA, NOAA, HUC shapefiles)
- [ ] Display watershed boundaries and stream gauges as map layers

### 3. Data Fetching & Processing
- [ ] Implement API calls for USGS streamflow and EPA water quality
- [ ] Parse and normalize data for frontend use
- [ ] (Optional) Set up FastAPI backend for caching/aggregation

### 4. Map Interactivity
- [ ] Add clickable features (watersheds, gauges)
- [ ] Show popups with current metrics (quality, streamflow)
- [ ] Implement 7-day trend charts in popups

### 5. Layer Controls & Search
- [ ] Add layer toggles (water quality, drought, streamflow)
- [ ] Implement search (by watershed, river, city; fuzzy matching)
- [ ] Highlight search results on map

### 6. UI/UX & Responsiveness
- [ ] Style map and UI for clarity and beauty
- [ ] Ensure mobile responsiveness (test on devices/emulators)
- [ ] Add accessibility features (color contrast, keyboard navigation)

### 7. Polish & Documentation
- [ ] Write clear documentation (README, code comments)
- [ ] Add project description and usage instructions
- [ ] Record 2-min walkthrough video

### 8. Deployment
- [ ] Set up hosting (Vercel/Netlify/GitHub Pages)
- [ ] Deploy live demo
- [ ] Test on multiple browsers/devices

### 9. Launch & Portfolio
- [ ] Write 1–2 paragraph project summary
- [ ] Update portfolio site with demo link and video
- [ ] (Optional) Post on LinkedIn, GitHub, or blog

### 10. Stretch Goals (if time)
- [ ] Add time slider for animated trends
- [ ] Implement story popups
- [ ] Add "Report a Concern" demo form

### 6.5. Testing & Quality Assurance
- [ ] Set up testing framework (Jest/RTL for React, pytest for Python)
- [ ] Write initial smoke tests for app load and map rendering
- [ ] Add unit tests for data fetching and parsing logic
- [ ] Add component tests for map popups, layer toggles, and search
- [ ] Add integration tests for user flows (e.g., search, click popup, view chart)
- [ ] (Optional) Add E2E tests for mobile responsiveness and accessibility
- [ ] Integrate tests into CI pipeline
