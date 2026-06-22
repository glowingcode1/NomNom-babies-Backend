const mongoose = require("mongoose");

const feedingSlotSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["milk", "meal"],
    required: true,
  },
  time: {
    type: String,
    required: true, // e.g. "07:00 AM"
  },
  title: {
    type: String,
    required: true, // e.g. "Morning Feed"
  },
  description: {
    type: String,
    default: "", // e.g. "Breast Milk / Formula • Light morning feeding"
  },

  amount: {
    type: String,
    default: "",
  },
  recipe: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Recipe",
    default: null,
  },
  isOptional: {
    type: Boolean,
    default: false,
  },
});

const feedingScheduleSchema = new mongoose.Schema(
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
    slots: [feedingSlotSchema],
  },
  { timestamps: true },
);

const FeedingSchedule =
  mongoose.models.FeedingSchedule ||
  mongoose.model("FeedingSchedule", feedingScheduleSchema);

module.exports = FeedingSchedule;
