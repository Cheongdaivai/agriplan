/**
 * server.js — AgriPlan API Entry Point
 *
 * Start (production):  npm start
 * Start (dev/watch):   npm run dev
 * Seed crops:          npm run seed
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");

// Route modules
const farmRoutes = require("./routes/farmRoutes");
const zoneRoutes = require("./routes/zoneRoutes");
const cropRoutes = require("./routes/cropRoutes");
const layoutRoutes = require("./routes/layoutRoutes");
const sensorRoutes = require("./routes/sensorRoutes");

// ---------------------------------------------------------------------------
// App configuration
// ---------------------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 5000;

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Health-check / root
// ---------------------------------------------------------------------------
app.get("/", (req, res) => {
  res.json({
    success: true,
    data: {
      service: "AgriPlan API",
      version: "1.0.0",
      status: "running",
      timestamp: new Date().toISOString(),
    },
    error: null,
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    data: { status: "ok", uptime: process.uptime() },
    error: null,
  });
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use("/api/farms", farmRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/crops", cropRoutes);
app.use("/api/layouts", layoutRoutes);
app.use("/api/sensors", sensorRoutes);

// ---------------------------------------------------------------------------
// 404 handler — must come after all routes
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    error: { message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
});

// ---------------------------------------------------------------------------
// Global error handler — must be LAST and have 4 params
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Bootstrap: connect DB then start listening
// ---------------------------------------------------------------------------
const start = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(
      `[Server] AgriPlan API listening on port ${PORT}  (${process.env.NODE_ENV || "development"})`,
    );
    console.log(`[Server] Base URL: http://localhost:${PORT}`);
  });
};

start().catch((err) => {
  console.error("[Server] Failed to start:", err.message);
  process.exit(1);
});

module.exports = app; // exported for testing
