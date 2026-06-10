const mongoose = require("mongoose");

const nutritionSchema = new mongoose.Schema(
  {
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      required: true,
      unique: true,
      index: true,
    },
    nutrients: [
      {
        name: { type: String, required: true, trim: true },   // "Vitamin A", "Iron", etc.
        benefit: { type: String, required: true, trim: true }, // description shown under name
      },
    ],
    feedingInsight: {
      type: String,
      trim: true,
      default: "",
    },
    allergyReminder: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Nutrition = mongoose.models.Nutrition || mongoose.model("Nutrition", nutritionSchema);
module.exports = Nutrition;