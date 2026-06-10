const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Country name is required'],
      trim: true,
    },
    signatureFoods: {
      type: [String],
      default: [],
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Country', countrySchema);