# 🌿 AgriPlan — Real-World Farm Zone Planner

A full-stack web application for agricultural planning, farm zone management, and crop optimization. AgriPlan enables farmers and agricultural managers to interactively design farm layouts, visualize crop zones with real-time sensor data, plan planting grids, and estimate yields and resource usage.

## ✨ Key Features

### 🗺️ **Interactive Farm Design**
- Draw farm boundaries and zones on a satellite/street map with Leaflet
- Assign crops to zones dynamically
- Real-time area calculation (m² / hectares)
- Persistent farm templates for reusability
- Automatic tile layer switching (satellite ↔ street) at high zoom

### 🌱 **Crop Zone Planning**
- Visualize plant grids with zoom-responsive dots (optimized for 400+ points)
- Row planner with customizable rows, columns, and spacing
- Estimated yield, revenue, and water usage calculations per zone
- Seasonal crop suitability indicators
- Transparent zone fills for clear dot visibility

### 📊 **Management Dashboard**
- View saved farm layouts with zone metadata
- Monitor sensor readings (soil moisture, temperature, humidity)
- Register and manage IoT devices (ESP32, rovers, drones)
- Simulate sensor readings for testing
- Status tracking (online, offline, error)

### 🔌 **IoT & Sensor Integration**
- REST API endpoints for sensor data ingestion
- Device registration and status tracking
- Real-time sensor visualization on the map
- Device-to-zone associations
- 30-second polling for live updates

## 🏗️ Tech Stack

### Frontend
- **React 18** + Vite (fast dev server, ESM-first bundling)
- **Leaflet** (mapping) + Leaflet Draw (zone editing)
- **Zustand** (lightweight state management)
- **TailwindCSS** (utility-first styling)
- **Web Workers** (off-thread geo projection for smooth zoom)
- **React Router** (page navigation)

### Backend
- **Node.js** + Express (REST API)
- **MongoDB** (farm layouts, zones, crops, sensor data, devices)
- **Mongoose** (ODM with schema validation)
- **async/await** patterns for clean error handling

### Infrastructure
- Docker-ready backend
- Environment-based configuration (.env)
- Optional Cloudinary integration for image hosting

## 🚀 Quick Start

### Prerequisites
- **Node.js** 16+ (npm 8+)
- **MongoDB** 5.0+ (local or Atlas)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd agri-arch

# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Environment Setup

**Backend** — Create `backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/agriplan
NODE_ENV=development
```

**Frontend** — Create `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:5000
```

### Running the Application

**Terminal 1 — Backend API**
```bash
cd backend
npm run dev
# Server starts on http://localhost:5000
```

**Terminal 2 — Frontend Dev Server**
```bash
cd frontend
npm run dev
# App starts on http://localhost:5173
```

Visit **http://localhost:5173** in your browser.

## 📁 Project Structure

```
agri-arch/
├── backend/
│   ├── controllers/          # Route handlers
│   │   ├── cropController.js
│   │   ├── farmController.js
│   │   ├── layoutController.js
│   │   ├── sensorController.js
│   │   └── zoneController.js
│   ├── models/              # Mongoose schemas
│   │   ├── Crop.js
│   │   ├── Farm.js
│   │   ├── FarmLayout.js
│   │   ├── SensorReading.js
│   │   ├── Zone.js
│   │   └── Device.js
│   ├── services/            # Business logic
│   │   ├── cropService.js
│   │   ├── farmService.js
│   │   ├── layoutService.js
│   │   ├── sensorService.js
│   │   └── zoneService.js
│   ├── middleware/          # Express middleware
│   │   ├── asyncHandler.js  # async/await error wrapper
│   │   ├── errorHandler.js  # centralized error handling
│   │   └── validate.js      # request validation
│   ├── routes/              # API endpoints
│   │   ├── cropRoutes.js
│   │   ├── farmRoutes.js
│   │   ├── layoutRoutes.js
│   │   ├── sensorRoutes.js
│   │   └── zoneRoutes.js
│   ├── seed/                # Database seeding
│   │   └── seedCrops.js
│   ├── config/              # Configuration
│   │   └── db.js            # MongoDB connection
│   ├── server.js            # Express app entry
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   │   ├── CanvasMap.jsx          # Main map with drawing
│   │   │   ├── PlantGridOverlay.jsx   # Plant grid dots (optimized)
│   │   │   ├── CropPanel.jsx          # Crop assignment UI
│   │   │   ├── InsightPanel.jsx       # Farm statistics
│   │   │   ├── ZoneInfoTooltip.jsx    # Zone hover info
│   │   │   ├── SaveFarmModal.jsx      # Save dialog
│   │   │   ├── Toolbar.jsx            # Mode selector & nav
│   │   │   ├── LocateButton.jsx       # Geolocation
│   │   │   ├── ZoneLayer.jsx          # Zone rendering
│   │   │   └── PlantGridOverlay.jsx   # Plant grid layer
│   │   ├── pages/           # Page-level components
│   │   │   ├── FarmEditorPage.jsx     # Design view
│   │   │   └── FarmManagementPage.jsx # Management view
│   │   ├── hooks/           # Custom React hooks
│   │   │   ├── useCanvasInteraction.js
│   │   │   └── useUserLocation.js
│   │   ├── store/           # Zustand state
│   │   │   ├── useFarmStore.js        # Editor state
│   │   │   └── useManagementStore.js  # Management state
│   │   ├── utils/           # Utility functions
│   │   │   ├── api.js       # API client
│   │   │   ├── calculations.js
│   │   │   └── geometry.js  # Geo helpers
│   │   ├── workers/         # Web Workers
│   │   │   └── plantGridWorker.js
│   │   ├── App.jsx          # Root component
│   │   ├── main.jsx         # Vite entry
│   │   └── index.css        # Global styles
│   ├── public/              # Static assets
│   ├── vite.config.js       # Vite configuration
│   ├── tailwind.config.js   # TailwindCSS config
│   ├── postcss.config.js    # PostCSS config
│   ├── package.json
│   └── index.html
│
├── docs/
│   ├── map.md               # Map feature documentation
│   ├── system.md            # System architecture
│   └── techdoc.md           # Technical reference
│
├── package.json             # Root package (workspace)
└── README.md
```

## 🎯 Usage Guide

### Farm Editor (`/`)
1. **Draw Boundary** — Click on the map to draw a farm boundary (≥3 points)
2. **Draw Zones** — Double-click to close, then draw crop zones inside the boundary
3. **Assign Crops** — Select a zone, pick a crop from the panel on the right
4. **Save Farm** — Click "Save Farm" in the toolbar to persist to the database
5. **Name & Metadata** — Update farm name, season, soil type before saving

### Farm Management (`/management`)
1. **Load Layout** — Pick a saved farm from the left sidebar
2. **Select Zone** — Click a zone to view details
3. **Plan Row Grid** — Enter rows/columns/spacing, click "Apply Row Plan"
4. **Monitor Sensors** — View live sensor readings for the zone
5. **Register Devices** — Add IoT devices (ESP32, rovers, drones) to zones
6. **Simulate Readings** — Test sensor data ingestion

## 🔧 Performance Optimizations

### Plant Grid Dots
- **Web Worker**: Geo projection runs off-thread (non-blocking)
- **Leaflet Pane**: Canvas in dedicated pane → CSS transforms handle pan/zoom
- **Batch Rendering**: Single `beginPath()` + `fill()` for all dots
- **Viewport Culling**: Only draw dots in visible viewport + margin
- **Dynamic Visibility**: Dots hidden below zoom level 17 (configurable `MIN_DOT_ZOOM`)

### Map Rendering
- **Auto Tile Switching**: Satellite at low zoom, street at high zoom
- **Lazy Loading**: Components load only when needed
- **Debounced Events**: Pan/zoom events coalesced via rAF

## 🌐 API Endpoints

### Farms
- `GET /api/farms` — List all farms
- `POST /api/farms` — Create a new farm
- `GET /api/farms/:id` — Get farm by ID
- `PATCH /api/farms/:id` — Update farm metadata
- `DELETE /api/farms/:id` — Delete farm

### Layouts
- `GET /api/layouts` — List farm layouts
- `POST /api/layouts` — Save a layout
- `GET /api/layouts/:id` — Get layout by ID
- `PATCH /api/layouts/:id/zones/:zoneId/rowplan` — Update row plan

### Crops
- `GET /api/crops` — List all available crops
- `POST /api/crops` — Create a new crop (admin)

### Sensors
- `POST /api/sensors/ingest` — Submit a sensor reading
- `GET /api/sensors/latest/:farmId` — Get latest readings
- `GET /api/sensors/devices/:farmId` — List devices in farm
- `POST /api/sensors/devices/register` — Register a new device

## 🔐 Error Handling

- **Centralized async wrapper** (`asyncHandler.js`) catches all route errors
- **Global error handler** sends consistent JSON error responses
- **Validation errors** include field-level feedback
- **User-friendly messages** in the UI with retry prompts

## 📚 Documentation

- **[System Architecture](docs/system.md)** — High-level design and data flow
- **[Technical Reference](docs/techdoc.md)** — API specs and database schemas
- **[Map Features](docs/map.md)** — Leaflet integration details

## 🚢 Deployment

### Docker (Backend)
```bash
cd backend
docker build -t agriplan-api .
docker run -p 5000:5000 \
  -e MONGODB_URI=mongodb://mongo:27017/agriplan \
  agriplan-api
```

### Frontend (Static Build)
```bash
cd frontend
npm run build
# Output in dist/ — deploy to any static host (Vercel, Netlify, etc.)
```

## 🤝 Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit changes (`git commit -m 'Add amazing feature'`)
3. Push to branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## 📄 License

This project is open source under the MIT License.

## 🎓 Learn More

- [Leaflet Documentation](https://leafletjs.com)
- [Zustand Guide](https://github.com/pmndrs/zustand)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [MongoDB Reference](https://docs.mongodb.com)
- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)

---

**Built with ❤️ for sustainable agriculture**
