const GroceryList = require("@models/GroceryList");
const Recipe = require("@models/Recipe");
const Baby = require("@models/Baby");

const {
  sendResponse,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");

// Add recipe ingredients to grocery list
const addRecipeToGroceryList = async (req, res) => {
  try {
    const { recipeId, ingredients } = req.body;

    const recipe = await Recipe.findById(recipeId);

    if (!recipe) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "recipe_not_found",
      });
    }

    let groceryList = await GroceryList.findOne({
      user: req.user._id,
    });

    if (!groceryList) {
      groceryList = await GroceryList.create({
        user: req.user._id,
        recipes: [],
      });
    }

    const alreadyExists = groceryList.recipes.find(
      (r) => String(r.recipe) === String(recipeId),
    );

    if (alreadyExists) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "recipe_already_added",
      });
    }

    groceryList.recipes.push({
      recipe: recipeId,

      ingredients: ingredients.map((ingredient) => ({
        name: ingredient.name,
        quantity: ingredient.quantity,
        category: ingredient.category,
        icon: ingredient.icon,
        checked: false,
      })),
    });

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
    const { page, limit, skip } = parsePaginationParams(req);

    const groceryList = await GroceryList.findOne({
      user: req.user._id,
    }).populate("recipes.recipe", "_id title image");

    if (!groceryList) {
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "data_fetched_successfully",
        data: {
          recipesIncluded: [],
          groceryChecklist: [],
          ingredientCategories: [],
        },
        meta: generateMeta(0, page, limit),
      });
    }

    const recipesIncluded = groceryList.recipes.map((r) => ({
      recipeId: r.recipe._id,
      title: r.recipe.title,
      image: r.recipe.image,
    }));

    const groceryChecklist = [];
    const categoriesMap = {};

    groceryList.recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ingredient) => {
        groceryChecklist.push({
          _id: ingredient._id,
          name: ingredient.name,
          icon: ingredient.icon,
          quantity: ingredient.quantity,
          checked: ingredient.checked,
          category: ingredient.category,
        });

        if (ingredient.category) {
          if (!categoriesMap[ingredient.category]) {
            categoriesMap[ingredient.category] = [];
          }

          categoriesMap[ingredient.category].push(ingredient.name);
        }
      });
    });

    const totalRecords = groceryChecklist.length;

    const paginatedChecklist = groceryChecklist.slice(skip, skip + limit);

    const ingredientCategories = Object.keys(categoriesMap).map((category) => ({
      category,
      items: categoriesMap[category],
    }));

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        recipesIncluded,
        groceryChecklist: paginatedChecklist,
        ingredientCategories,
      },
      meta: generateMeta(totalRecords, page, limit),
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

const updateIngredientStatus = async (req, res) => {
  try {
    const { ingredientId } = req.params;
    const { checked } = req.body;

    const groceryList = await GroceryList.findOne({
      user: req.user._id,
    });

    if (!groceryList) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "grocery_list_not_found",
      });
    }

    let targetIngredient = null;

    groceryList.recipes.forEach((recipe) => {
      const ingredient = recipe.ingredients.id(ingredientId);

      if (ingredient) {
        targetIngredient = ingredient;
      }
    });

    if (!targetIngredient) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "ingredient_not_found",
      });
    }

    targetIngredient.checked = checked;

    await groceryList.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "ingredient_updated_success",
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

const removeRecipeFromGroceryList = async (req, res) => {
  try {
    const { recipeId } = req.params;

    const groceryList = await GroceryList.findOne({
      user: req.user._id,
    });

    if (!groceryList) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "grocery_list_not_found",
      });
    }

    groceryList.recipes = groceryList.recipes.filter(
      (recipe) => String(recipe.recipe) !== String(recipeId),
    );

    await groceryList.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "recipe_removed_success",
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
    await GroceryList.findOneAndUpdate(
      {
        user: req.user._id,
      },
      {
        recipes: [],
      },
    );

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
  updateIngredientStatus,
  updateGroceryItem,
  removeRecipeFromGroceryList,
  removeGroceryItem,
  clearGroceryList,
};
