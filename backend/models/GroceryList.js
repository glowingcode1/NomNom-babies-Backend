const mongoose = require("mongoose");

const groceryListSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    items: [
      {
        recipe: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Recipe",
        },
        name: {
          type: String,
          required: true,
          trim: true,
        },
        quantity: {
          type: String,
          default: "",
          trim: true,
        },

        checked: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports =
  mongoose.models.GroceryList ||
  mongoose.model("GroceryList", groceryListSchema);
