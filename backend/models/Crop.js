const mongoose = require('mongoose');

const cropSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Crop name is required'],
      trim: true,
      unique: true,
      maxlength: [80, 'Crop name must be 80 characters or fewer'],
    },
    avgYieldPerSqm: {
      type: Number,
      required: [true, 'avgYieldPerSqm is required'],
      min: [0, 'Yield cannot be negative'],
    },
    marketPrice: {
      type: Number,
      required: [true, 'marketPrice is required'],
      min: [0, 'Market price cannot be negative'],
    },
    waterNeeds: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high'],
        message: '{VALUE} is not a valid water-need level',
      },
    },
    growthDurationDays: {
      type: Number,
      min: [1, 'Growth duration must be at least 1 day'],
    },
    suitableSeason: {
      type: [
        {
          type: String,
          enum: {
            values: ['dry', 'rainy'],
            message: '{VALUE} is not a valid season',
          },
        },
      ],
      default: [],
    },
    color: {
      type: String,
      trim: true,
      match: [/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'color must be a valid hex code'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('Crop', cropSchema);
