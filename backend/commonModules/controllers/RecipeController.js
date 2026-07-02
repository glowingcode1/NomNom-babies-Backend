const Recipe = require("@models/Recipe");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");
const Baby = require("@models/Baby");
const { User } = require("@models/UserModel");
const { babyPopulate } = require("@utils/babyUtil");

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

    const [recipes, totalRecords] = await Promise.all([
      Recipe.find(query)
        .populate("country", "_id name")
        .populate("babyStage", "_id title")
        .select("title image prepTime mealType nutritionTags country babyStage")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Recipe.countDocuments(query),
    ]);

    const meta = generateMeta(page, limit, totalRecords);

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
      .populate("country", "_id name")
      .populate("babyStage", "_id title features");

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
      data: {
        recipeId: recipe._id,

        title: recipe.title,

        image: recipe.image,

        prepTime: `${recipe.prepTime} min`,

        mealType: recipe.mealType,

        stage: recipe.babyStage
          ? {
              _id: recipe.babyStage._id,
              title: recipe.babyStage.title,
            }
          : null,

        country: recipe.country
          ? {
              _id: recipe.country._id,
              name: recipe.country.name,
            }
          : null,

        nutritionTags: recipe.nutritionTags,

        ingredients: recipe.ingredients.map((item) => ({
          name: item.name,

          quantity: item.quantity,

          icon: item.icon,
        })),

        instructions: recipe.method.map((step) => ({
          step: step.step,

          title: `Step ${step.step}`,

          description: step.instruction,
        })),

        notes: recipe.notes,

        acceptanceLabel: recipe.acceptanceLabel,

        actions: {
          nutritionFacts: true,

          downloadPdf: true,

          addToGroceryList: true,
        },
      },
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

    const [recipes, totalRecords] = await Promise.all([
      Recipe.find(query)
        .populate("country", "_id name")
        .populate("babyStage", "_id title")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Recipe.countDocuments(query),
    ]);

    const meta = generateMeta(page, limit, totalRecords);

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

const getUserRecipes = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["userId"],
        objectIdFields: ["userId"],
      })
    )
      return;

    const babies = await Baby.find({
      user: req.params.userId,
      isActive: true,
    });

    if (!babies.length) {
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "data_fetched_successfully",
        data: [],
      });
    }

    const stageIds = babies.map((baby) => baby.babyStage).filter(Boolean);

    const countryIds = babies.flatMap((baby) => baby.selectedCountries || []);

    const recipes = await Recipe.find({
      status: "published",
      isActive: true,
      $or: [{ babyStage: { $in: stageIds } }, { country: { $in: countryIds } }],
    })
      .populate("country", "_id name")
      .populate("babyStage", "_id title")
      .select("title image prepTime mealType nutritionTags country babyStage")
      .sort({ createdAt: -1 });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: recipes,
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

const getUserBabyRecipes = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["userId", "babyId"],
        objectIdFields: ["userId", "babyId"],
      })
    )
      return;

    const baby = await Baby.findOne({
      _id: req.params.babyId,
      user: req.params.userId,
      isActive: true,
    });

    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const recipes = await Recipe.find({
      status: "published",
      isActive: true,
      babyStage: baby.babyStage,
      country: { $in: baby.selectedCountries },
    })
      .populate("country", "_id name")
      .populate("babyStage", "_id title")
      .sort({ createdAt: -1 });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: recipes,
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
      image,
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
      image,
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
      "image",
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

const getBabyRecipes = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);

  try {
    if (
      !validateParams(req, res, {
        pathParams: ["babyId"],
        objectIdFields: ["babyId"],
      })
    )
      return;

    const baby = await Baby.findOne({
      _id: req.params.babyId,
      user: req.user._id,
      isActive: true,
    });

    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const query = {
      status: "published",
      isActive: true,
      babyStage: baby.babyStage,
      country: { $in: baby.selectedCountries },
    };

    const [recipes, totalRecords] = await Promise.all([
      Recipe.find(query)
        .populate("country", "_id name")
        .populate("babyStage", "_id title")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      Recipe.countDocuments(query),
    ]);

    const meta = generateMeta(page, limit, totalRecords);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: recipes,
      meta: meta,
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

const getCustomCulturalPicks = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
        data: {
          hasBaby: false,
        },
      });
    }

    const baby = await Baby.findById(user.activeBaby).populate(babyPopulate);

    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const { page, limit, skip } = parsePaginationParams(req);

    const query = {
      country: {
        $in: baby.selectedCountries.map((c) => c._id),
      },
      babyStage: baby.babyStage?._id,
      isActive: true,
      status: "published",
    };

    const [recipes, totalRecords] = await Promise.all([
      Recipe.find(query)
        .populate("country", "_id name")
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit),

      Recipe.countDocuments(query),
    ]);

    const customCulturalPicks = recipes.map((recipe) => ({
      id: recipe._id,
      title: recipe.title,
      image: recipe.image,
      mealType: recipe.mealType,
      prepTime: recipe.prepTime,
      country: recipe.country?.name || "",
    }));

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: customCulturalPicks,
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

module.exports = {
  getRecipes,
  getRecipeById,
  getBabyRecipes,
  adminGetRecipes,
  getUserRecipes,
  getUserBabyRecipes,
  createRecipe,
  updateRecipe,
  updateRecipeStatus,
  deleteRecipe,
  getCustomCulturalPicks,
};
