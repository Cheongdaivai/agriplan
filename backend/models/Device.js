const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  farmId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
  deviceId:    { type: String, required: true, unique: true, trim: true },  // e.g. "ESP32-001"
  name:        { type: String, required: true, trim: true },
  deviceType:  { type: String, enum: ['esp32', 'rover', 'drone', 'manual'], required: true },
  zoneId:      { type: String, default: null },    // which zone it monitors
  status:      { type: String, enum: ['online', 'offline', 'error', 'idle'], default: 'offline' },
  lastSeen:    { type: Date, default: null },
  location:    { lat: { type: Number, default: null }, lng: { type: Number, default: null } },
  config: {
    reportIntervalSec: { type: Number, default: 60 },
    sensors:           [String],   // ['soil_moisture', 'temperature']
  },
  batteryPct:  { type: Number, default: null, min: 0, max: 100 },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Device', deviceSchema);
