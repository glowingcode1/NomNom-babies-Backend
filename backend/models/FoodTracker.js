const mongoose = require("mongoose");

const foodTrackerSchema = new mongoose.Schema(
  {
    baby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Baby",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    ingredientName: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    reaction: {
      type: String,
      enum: ["good", "neutral", "allergic"],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("FoodTracker", foodTrackerSchema);
