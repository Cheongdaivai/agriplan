const mongoose = require('mongoose');

// Reuse coordinate schema
const coordSchema = new mongoose.Schema({ lat: Number, lng: Number }, { _id: false });

// Row planting plan per zone
const rowPlanSchema = new mongoose.Schema({
  rows:        { type: Number, default: 0 },
  columns:     { type: Number, default: 0 },
  spacingM:    { type: Number, default: 0.5 },  // metres between plants
  orientation: { type: String, enum: ['horizontal', 'vertical'], default: 'horizontal' },
}, { _id: false });

// Zone snapshot embedded in layout
const layoutZoneSchema = new mongoose.Schema({
  zoneId:      String,           // original zone UUID from frontend
  name:        { type: String, required: true },
  cropName:    { type: String, default: null },
  cropColor:   { type: String, default: '#6b7280' },
  areaSqm:     { type: Number, default: 0 },
  coordinates: [coordSchema],
  rowPlan:     { type: rowPlanSchema, default: () => ({}) },
}, { _id: false });

const farmLayoutSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, default: '', maxlength: 500 },
  farmId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', default: null },
  boundary:    [coordSchema],
  zones:       [layoutZoneSchema],
  metadata: {
    totalAreaSqm:   { type: Number, default: 0 },
    totalYieldKg:   { type: Number, default: 0 },
    totalRevenue:   { type: Number, default: 0 },
    totalWaterL:    { type: Number, default: 0 },
    season:         { type: String, default: 'dry' },
    soilType:       { type: String, default: 'loam' },
    zoneCount:      { type: Number, default: 0 },
  },
  tags:        [String],
  isTemplate:  { type: Boolean, default: false },  // true = reusable template
}, { timestamps: true, versionKey: false });

farmLayoutSchema.index({ farmId: 1 });
farmLayoutSchema.index({ isTemplate: 1 });

module.exports = mongoose.model('FarmLayout', farmLayoutSchema);
