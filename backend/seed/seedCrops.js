/**
 * seedCrops.js
 * Run with: npm run seed   (from the backend/ directory)
 *
 * Behaviour:
 *  - Connects to MongoDB using MONGO_URI from .env (or the default).
 *  - For each crop in SEED_DATA, checks if a crop with that name already
 *    exists.  Skips it if found (idempotent), inserts it otherwise.
 *  - Logs a clear summary and exits.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Crop = require('../models/Crop');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/agriplan';

const SEED_DATA = [
  {
    name: 'Rice',
    avgYieldPerSqm: 0.45,
    marketPrice: 0.8,
    waterNeeds: 'high',
    growthDurationDays: 120,
    suitableSeason: ['rainy'],
    color: '#f59e0b',
  },
  {
    name: 'Maize',
    avgYieldPerSqm: 0.6,
    marketPrice: 0.5,
    waterNeeds: 'medium',
    growthDurationDays: 90,
    suitableSeason: ['rainy', 'dry'],
    color: '#eab308',
  },
  {
    name: 'Wheat',
    avgYieldPerSqm: 0.35,
    marketPrice: 0.6,
    waterNeeds: 'medium',
    growthDurationDays: 110,
    suitableSeason: ['dry'],
    color: '#d97706',
  },
  {
    name: 'Sorghum',
    avgYieldPerSqm: 0.4,
    marketPrice: 0.45,
    waterNeeds: 'low',
    growthDurationDays: 100,
    suitableSeason: ['dry'],
    color: '#dc2626',
  },
  {
    name: 'Cassava',
    avgYieldPerSqm: 1.2,
    marketPrice: 0.3,
    waterNeeds: 'low',
    growthDurationDays: 270,
    suitableSeason: ['dry', 'rainy'],
    color: '#7c3aed',
  },
  {
    name: 'Tomato',
    avgYieldPerSqm: 2.5,
    marketPrice: 1.2,
    waterNeeds: 'high',
    growthDurationDays: 75,
    suitableSeason: ['dry'],
    color: '#ef4444',
  },
  {
    name: 'Pepper',
    avgYieldPerSqm: 1.8,
    marketPrice: 1.5,
    waterNeeds: 'medium',
    growthDurationDays: 90,
    suitableSeason: ['dry', 'rainy'],
    color: '#f97316',
  },
  {
    name: 'Groundnut',
    avgYieldPerSqm: 0.3,
    marketPrice: 1.1,
    waterNeeds: 'low',
    growthDurationDays: 120,
    suitableSeason: ['rainy'],
    color: '#84cc16',
  },
];

const seed = async () => {
  console.log('[Seed] Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI);
  console.log(`[Seed] Connected to: ${mongoose.connection.name}`);

  let inserted = 0;
  let skipped = 0;

  for (const cropData of SEED_DATA) {
    const existing = await Crop.findOne({ name: cropData.name }).lean();
    if (existing) {
      console.log(`  [skip]   "${cropData.name}" — already exists`);
      skipped++;
    } else {
      await Crop.create(cropData);
      console.log(`  [insert] "${cropData.name}" — added`);
      inserted++;
    }
  }

  console.log(`\n[Seed] Done. Inserted: ${inserted}  Skipped: ${skipped}`);
  await mongoose.disconnect();
  console.log('[Seed] Disconnected. Bye.');
  process.exit(0);
};

seed().catch((err) => {
  console.error('[Seed] Fatal error:', err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
