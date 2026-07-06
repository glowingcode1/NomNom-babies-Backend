const Baby = require("@models/Baby");
const GroceryList = require("@models/GroceryList");
const Recipe = require("@models/Recipe");
const { User } = require("@models/UserModel");
const { babyPopulate } = require("@utils/babyUtil");

const {
  sendResponse,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");

// Add recipe ingredients to grocery list
const addRecipeToGroceryList = async (req, res) => {
  try {
    const { recipeId, ingredients } = req.body;

    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "data_fetched_successfully",
        data: {
          hasBaby: false,
          recommendedToday: [],
        },
      });
    }

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
      baby: user.activeBaby,
    });

    if (!groceryList) {
      groceryList = await GroceryList.create({
        user: req.user._id,
        baby: user.activeBaby,
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
        ingredientId: ingredient.ingredientId,
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
      translationKey: "grocery_list_updated_successfully",
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
    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "data_fetched_successfully",
        data: {
          recipesIncluded: [],

          groceryChecklist: [],

          ingredientCategories: [],
        },
      });
    }

    const { page, limit, skip } = parsePaginationParams(req);

    const groceryList = await GroceryList.findOne({
      user: req.user._id,
      baby: user.activeBaby,
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
        meta: generateMeta(page, limit, 0),
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

          categoriesMap[ingredient.category] = [
            ...(categoriesMap[ingredient.category] || []),
            ingredient.name,
          ];
        }
      });
    });

    const totalRecords = groceryChecklist.length;

    const paginatedChecklist = groceryChecklist.slice(skip, skip + limit);

    const ingredientCategories = Object.keys(categoriesMap).map((category) => ({
      category,

      items: [...new Set(categoriesMap[category])],
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
      meta: generateMeta(page, limit, totalRecords),
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

    const userId = req.user._id;

    const user = await User.findById(userId);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const groceryList = await GroceryList.findOne({
      user: req.user._id,
      baby: user.activeBaby,
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
    const user = await User.findById(userId);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const groceryList = await GroceryList.findOne({
      user: userId,
      baby: user.activeBaby,
    });

    if (!groceryList) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "grocery_list_not_found",
      });
    }

    let ingredient = null;

    groceryList.recipes.forEach((recipe) => {
      const found = recipe.ingredients.id(itemId);

      if (found) {
        ingredient = found;
      }
    });

    if (!ingredient) {
      return sendResponse({
        res,

        statusCode: 404,

        translationKey: "ingredient_not_found",
      });
    }

    ingredient.checked = checked;

    await groceryList.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "grocery_item_updated_success",
      data: ingredient,
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

    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const groceryList = await GroceryList.findOne({
      user: req.user._id,
      baby: user.activeBaby,
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
    const user = await User.findById(userId);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const groceryList = await GroceryList.findOne({
      user: userId,
      baby: user.activeBaby,
    });

    if (!groceryList) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "grocery_list_not_found",
      });
    }

    let ingredientFound = false;

    groceryList.recipes.forEach((recipe) => {
      const ingredient = recipe.ingredients.id(itemId);

      if (ingredient) {
        ingredient.deleteOne();
        ingredientFound = true;
      }
    });

    if (!ingredientFound) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "ingredient_not_found",
      });
    }

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
    const user = await User.findById(userId);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    await GroceryList.findOneAndUpdate(
      {
        user: userId,
        baby: user.activeBaby,
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
