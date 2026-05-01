const mongoose = require("mongoose");

const boundaryPointSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false },
);

const farmSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Farm name is required"],
      trim: true,
      maxlength: [120, "Farm name must be 120 characters or fewer"],
    },
    soilType: {
      type: String,
      enum: {
        values: ["clay", "sandy", "loam", "silt", "peaty"],
        message: "{VALUE} is not a recognised soil type",
      },
      default: "loam",
    },
    season: {
      type: String,
      enum: {
        values: ["dry", "rainy"],
        message: "{VALUE} is not a valid season",
      },
      required: [true, "Season is required"],
    },
    boundary: {
      type: [boundaryPointSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Virtual: total number of boundary points
farmSchema.virtual("boundaryLength").get(function () {
  return this.boundary.length;
});

module.exports = mongoose.model("Farm", farmSchema);
