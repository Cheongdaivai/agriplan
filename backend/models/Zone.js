const mongoose = require("mongoose");

const coordinateSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false },
);

const zoneSchema = new mongoose.Schema(
  {
    farmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      required: [true, "farmId is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Zone name is required"],
      trim: true,
      maxlength: [120, "Zone name must be 120 characters or fewer"],
    },
    cropId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Crop",
      default: null,
    },
    coordinates: {
      type: [coordinateSchema],
      default: [],
    },
    area: {
      type: Number,
      default: 0,
      min: [0, "Area cannot be negative"],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Compound index: list zones for a farm quickly
zoneSchema.index({ farmId: 1, createdAt: -1 });

module.exports = mongoose.model("Zone", zoneSchema);
