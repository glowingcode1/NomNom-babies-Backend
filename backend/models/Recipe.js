const mongoose = require("mongoose");

const recipeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    emoji: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      default: "",
    },
    views: {
      type: Number,
      default: 0,
    },
    prepTime: {
      type: Number, // in minutes
      required: true,
    },
    country: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Country",
      required: true,
    },
    babyStage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BabyStage",
      required: true,
    },
    mealType: {
      type: String,
      trim: true, // e.g. "Smooth Puree", "First Tastes", "Beginner Meal"
      default: "",
    },
    nutritionTags: {
      type: [String], // e.g. ["Vitamin A", "Iron", "Protein"]
      default: [],
    },
    ingredients: [
      {
        name: { type: String, required: true },
        quantity: { type: String, default: "" },
      },
    ],
    method: [
      {
        step: { type: Number, required: true },
        instruction: { type: String, required: true },
      },
    ],
    notes: {
      type: String,
      default: "",
    },
    acceptanceLabel: {
      type: String,
      default: "", // e.g. "Parent Tested"
    },
    status: {
      type: String,
      enum: ["draft", "pending", "published", "archived"],
      default: "draft",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const Recipe = mongoose.models.Recipe || mongoose.model("Recipe", recipeSchema);
module.exports = Recipe;
