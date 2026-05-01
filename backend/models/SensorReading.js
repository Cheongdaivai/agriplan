const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema({
  farmId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
  layoutId:   { type: mongoose.Schema.Types.ObjectId, ref: 'FarmLayout', default: null },
  zoneId:     { type: String, default: null },    // zone UUID string (not ObjectId)
  deviceId:   { type: String, required: true },   // e.g. "ESP32-001"
  deviceType: { type: String, enum: ['esp32', 'rover', 'drone', 'manual'], default: 'esp32' },
  sensorType: { type: String, required: true },   // 'soil_moisture' | 'temperature' | 'humidity' | 'ph' | 'npk' | 'light'
  value:      { type: Number, required: true },
  unit:       { type: String, default: '' },       // '%', '°C', 'pH', 'lux', etc.
  location:   {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  recordedAt: { type: Date, default: Date.now },
}, { timestamps: true, versionKey: false });

sensorReadingSchema.index({ farmId: 1, recordedAt: -1 });
sensorReadingSchema.index({ deviceId: 1, recordedAt: -1 });
sensorReadingSchema.index({ farmId: 1, zoneId: 1, sensorType: 1, recordedAt: -1 });

module.exports = mongoose.model('SensorReading', sensorReadingSchema);
