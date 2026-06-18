const GroceryList = require("@models/GroceryList");
const Recipe = require("@models/Recipe");

const { sendResponse, validateParams } = require("@utils/responseUtil");

// Add recipe ingredients to grocery list
const addRecipeToGroceryList = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        rawData: ["recipeId"],
        objectIdFields: ["recipeId"],
      })
    ) {
      return;
    }

    const { recipeId } = req.body;
    const userId = req.user._id;

    const recipe = await Recipe.findById(recipeId);

    if (!recipe) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "recipe_not_found",
      });
    }

    let groceryList = await GroceryList.findOne({
      user: userId,
    });

    if (!groceryList) {
      groceryList = await GroceryList.create({
        user: userId,
        items: [],
      });
    }

    const newItems = recipe.ingredients.map((ingredient) => ({
      recipe: recipe._id,
      name: ingredient.name,
      quantity: ingredient.quantity,
      checked: false,
    }));

    groceryList.items.push(...newItems);

    await groceryList.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "grocery_list_updated_success",
      data: groceryList,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// Get grocery list
const getGroceryList = async (req, res) => {
  try {
    const userId = req.user._id;

    const groceryList = await GroceryList.findOne({
      user: userId,
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: groceryList || { items: [] },
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// Update item checked status
const updateGroceryItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { checked } = req.body;
    const userId = req.user._id;

    const groceryList = await GroceryList.findOne({
      user: userId,
    });

    if (!groceryList) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "grocery_list_not_found",
      });
    }

    const item = groceryList.items.id(itemId);

    if (!item) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "grocery_item_not_found",
      });
    }

    item.checked = checked;

    await groceryList.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "grocery_item_updated_success",
      data: item,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// Remove item
const removeGroceryItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user._id;

    const groceryList = await GroceryList.findOne({
      user: userId,
    });

    if (!groceryList) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "grocery_list_not_found",
      });
    }

    const item = groceryList.items.id(itemId);

    if (!item) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "grocery_item_not_found",
      });
    }

    item.deleteOne();

    await groceryList.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "grocery_item_removed_success",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// Clear list
const clearGroceryList = async (req, res) => {
  try {
    const userId = req.user._id;

    const groceryList = await GroceryList.findOne({
      user: userId,
    });

    if (!groceryList) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "grocery_list_not_found",
      });
    }

    groceryList.items = [];

    await groceryList.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "grocery_list_cleared_success",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

module.exports = {
  addRecipeToGroceryList,
  getGroceryList,
  updateGroceryItem,
  removeGroceryItem,
  clearGroceryList,
};
