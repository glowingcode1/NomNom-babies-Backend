const mongoose = require("mongoose");

const nutrientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    benefit: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const nutritionSchema = new mongoose.Schema(
  {
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      default: null,
      index: true,
    },

    babyStage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BabyStage",
      default: null,
      index: true,
    },

    nutrients: {
      type: [nutrientSchema],
      default: [],
    },

    feedingInsight: {
      type: String,
      default: "",
    },

    allergyReminder: {
      type: String,
      default: "",
    },

    isWeeklyFocus: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

nutritionSchema.index(
  { recipe: 1 },
  {
    unique: true,
    partialFilterExpression: {
      recipe: { $exists: true },
    },
  },
);

nutritionSchema.index(
  { babyStage: 1 },
  {
    unique: true,
    partialFilterExpression: {
      babyStage: { $exists: true },
    },
  },
);

module.exports =
  mongoose.models.Nutrition || mongoose.model("Nutrition", nutritionSchema);
