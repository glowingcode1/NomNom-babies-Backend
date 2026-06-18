const Recipe = require("@models/Recipe");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

// Get recipes filtered by baby's countries and stage (main recipe list screen)
const getRecipes = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);

  try {
    const { countryId, stageId, search = "" } = req.query;

    const query = { status: "published", isActive: true };

    if (countryId) query.country = countryId;
    if (stageId) query.babyStage = stageId;
    if (search) query.title = { $regex: search, $options: "i" };

    const [recipes, total] = await Promise.all([
      Recipe.find(query)
        .populate("country", "name")
        .populate("babyStage", "title")
        .select(
          "title emoji image prepTime mealType nutritionTags country babyStage difficulty",
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Recipe.countDocuments(query),
    ]);

    const meta = generateMeta(page, limit, total);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: recipes,
      meta,
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

// Get single recipe detail
const getRecipeById = async (req, res) => {
  try {
    if (
      !validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })
    )
      return;

    const recipe = await Recipe.findOne({
      _id: req.params.id,
      status: "published",
      isActive: true,
    })
      .populate("country", "name")
      .populate("babyStage", "title features");

    if (!recipe) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "recipe_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: recipe,
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

// ─── ADMIN ────────────────────────────────────────────────────────────────────

// Get all recipes with pagination + filters (admin)
const adminGetRecipes = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);

  try {
    const { search = "", status, countryId, stageId } = req.query;

    const query = {};
    if (search) query.title = { $regex: search, $options: "i" };
    if (status) query.status = status;
    if (countryId) query.country = countryId;
    if (stageId) query.babyStage = stageId;

    const [recipes, total] = await Promise.all([
      Recipe.find(query)
        .populate("country", "name")
        .populate("babyStage", "title")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Recipe.countDocuments(query),
    ]);

    const meta = generateMeta(page, limit, total);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: recipes,
      meta,
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

// Create a recipe
const createRecipe = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        rawData: ["title", "prepTime", "country", "babyStage", "nutritionTags"],
        objectIdFields: ["country", "babyStage"],
      })
    )
      return;

    const {
      title,
      emoji,
      prepTime,
      country,
      babyStage,
      mealType,
      nutritionTags,
      ingredients,
      method,
      notes,
      acceptanceLabel,
    } = req.body;

    const recipe = await Recipe.create({
      title: title.trim(),
      emoji: emoji || "",
      prepTime,
      country,
      babyStage,
      mealType: mealType || "",
      nutritionTags,
      ingredients: ingredients || [],
      method: method || [],
      notes: notes || "",
      acceptanceLabel: acceptanceLabel || "",
    });

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "recipe_created_success",
      data: recipe,
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

// Update a recipe
const updateRecipe = async (req, res) => {
  try {
    if (
      !validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })
    )
      return;

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "recipe_not_found",
      });
    }

    const fields = [
      "title",
      "emoji",
      "prepTime",
      "country",
      "babyStage",
      "mealType",
      "nutritionTags",
      "ingredients",
      "method",
      "notes",
      "acceptanceLabel",
      "isActive",
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) recipe[field] = req.body[field];
    });

    await recipe.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "recipe_updated_success",
      data: recipe,
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

// Change recipe status (draft → pending → published → archived)
const updateRecipeStatus = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["id"],
        objectIdFields: ["id"],
        rawData: ["status"],
      })
    )
      return;

    const { status } = req.body;
    const allowed = ["draft", "pending", "published", "archived"];

    if (!allowed.includes(status)) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "invalid_status",
      });
    }

    const recipe = await Recipe.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );

    if (!recipe) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "recipe_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "recipe_status_updated_success",
      data: recipe,
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

// Delete a recipe
const deleteRecipe = async (req, res) => {
  try {
    if (
      !validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })
    )
      return;

    const recipe = await Recipe.findByIdAndDelete(req.params.id);
    if (!recipe) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "recipe_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "recipe_deleted_success",
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
  getRecipes,
  getRecipeById,
  adminGetRecipes,
  createRecipe,
  updateRecipe,
  updateRecipeStatus,
  deleteRecipe,
};
