const mongoose = require("mongoose");
const Recipe = require("@models/Recipe");
const Nutrition = require("@models/Nutrition");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");
const Baby = require("@models/Baby");
const { User } = require("@models/UserModel");
const { babyPopulate } = require("@utils/babyUtil");
const FavoriteRecipe = require("@models/FavoriteRecipe");
const GroceryList = require("@models/GroceryList");

const validateNutritionTagIds = async (nutritionTags = []) => {
  if (!nutritionTags.length) return { valid: true };

  const uniqueIds = [...new Set(nutritionTags.map((id) => String(id)))];

  const found = await Nutrition.find({ _id: { $in: uniqueIds } }).select("_id");

  const foundIds = new Set(found.map((doc) => String(doc._id)));

  const invalidIds = uniqueIds.filter((id) => !foundIds.has(id));

  if (invalidIds.length > 0) {
    return { valid: false, invalidIds };
  }

  return { valid: true };
};

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

// Get recipes filtered by baby's countries and stage (main recipe list screen)
const getRecipes = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);

  try {
    const { countryId, stageId, search = "", filter } = req.query;

    const query = {
      status: "published",
      isActive: true,
    };

    if (countryId) query.country = countryId;

    if (stageId) query.babyStage = stageId;

    if (search) {
      query.title = {
        $regex: search,
        $options: "i",
      };
    }

    if (filter === "favorite") {
      const userId = req.user._id;

      const user = await User.findById(userId);

      if (!user?.activeBaby) {
        return sendResponse({
          res,

          statusCode: 200,

          translationKey: "data_fetched_successfully",

          data: [],

          meta: generateMeta(page, limit, 0),
        });
      }

      const favoriteIds = await FavoriteRecipe.find({
        user: userId,

        baby: user.activeBaby,
      }).distinct("recipe");

      query._id = {
        $in: favoriteIds,
      };
    }

    const [recipes, totalRecords] = await Promise.all([
      Recipe.find(query)

        .populate("country", "_id name")

        .populate("babyStage", "_id title")

        .populate("nutritionTags", "_id name benefit")

        .select(
          `
            title
            image
            prepTime
            mealType
            nutritionTags
            country
            babyStage
          `,
        )

        .sort({
          createdAt: -1,
        })

        .skip((page - 1) * limit)

        .limit(limit),

      Recipe.countDocuments(query),
    ]);

    return sendResponse({
      res,

      statusCode: 200,

      translationKey: "data_fetched_successfully",

      data: recipes,

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

// Get single recipe detail
const getRecipeById = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["id"],
        objectIdFields: ["id"],
      })
    ) {
      return;
    }

    const recipe = await Recipe.findOne({
      _id: req.params.id,
      status: "published",
      isActive: true,
    })
      .populate("country", "_id name")
      .populate("babyStage", "_id title features")
      .populate("nutritionTags", "_id name benefit");

    if (!recipe) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "recipe_not_found",
      });
    }

    const user = await User.findById(req.user._id);

    let isFavorite = false;

    let isAddedToGroceryList = false;

    let groceryIngredients = [];

    if (user?.activeBaby) {
      const [favorite, groceryList] = await Promise.all([
        FavoriteRecipe.exists({
          user: req.user._id,
          baby: user.activeBaby,
          recipe: recipe._id,
        }),

        GroceryList.findOne({
          user: req.user._id,
          baby: user.activeBaby,
        }),
      ]);

      isFavorite = Boolean(favorite);

      if (groceryList) {
        const groceryRecipe = groceryList.recipes.find(
          (item) => item.recipe.toString() === recipe._id.toString(),
        );

        if (groceryRecipe) {
          isAddedToGroceryList = true;

          groceryIngredients = groceryRecipe.ingredients;
        }
      }
    }

    const groceryMap = new Map();

    groceryIngredients.forEach((ingredient) => {
      groceryMap.set(String(ingredient.ingredient), ingredient);
    });

    const formatRecipeIngredients = (ingredients, groceryMap) => {
      return ingredients.map((ingredient) => {
        const groceryIngredient = groceryMap.get(String(ingredient._id));

        return {
          _id: ingredient._id,
          name: ingredient.name,
          quantity: ingredient.quantity,
          icon: ingredient.icon,
          isAddedToGroceryList: Boolean(groceryIngredient),
          checked: groceryIngredient?.checked ?? false,
          groceryItem: groceryIngredient
            ? {
                _id: groceryIngredient._id,
                category: groceryIngredient.category,
              }
            : null,
        };
      });
    };

    const formatRecipeResponse = ({
      recipe,
      groceryMap,
      isFavorite,
      isAddedToGroceryList,
    }) => ({
      recipeId: recipe._id,

      title: recipe.title,

      image: recipe.image,

      prepTime: String(recipe.prepTime),

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

      nutritionTags: recipe.nutritionTags.map((tag) => ({
        _id: tag._id,
        name: tag.name,
        benefit: tag.benefit,
      })),

      feedingInsight: recipe.feedingInsight,

      allergyReminder: recipe.allergyReminder,

      ingredients: formatRecipeIngredients(recipe.ingredients, groceryMap),

      instructions: recipe.method.map((step) => ({
        step: step.step,
        title: `Step ${step.step}`,
        description: step.instruction,
      })),

      notes: recipe.notes,

      acceptanceLabel: recipe.acceptanceLabel,

      isFavorite,

      isAddedToGroceryList,

      actions: {
        nutritionFacts: true,
        downloadPdf: true,
        addToGroceryList: true,
      },
    });

    return sendResponse({
      res,

      statusCode: 200,

      translationKey: "data_fetched_successfully",

      data: formatRecipeResponse({
        recipe,
        groceryMap,
        isFavorite,
        isAddedToGroceryList,
      }),
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

  const { search = "", country } = req.query;

  try {
    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }
    const baby = await Baby.findOne({
      _id: user.activeBaby,
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
    };

    const selectedCountryId = baby.selectedCountries.map((country) =>
      country._id.toString(),
    );

    if (country) {
      if (!selectedCountryId.includes(country)) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "invalid_country",
        });
      }

      query.country = country;
    } else {
      query.country = {
        $in: selectedCountryId,
      };
    }

    if (search.trim()) {
      query.title = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    const favoriteIds = await FavoriteRecipe.find({
      user: req.user._id,

      baby: baby._id,
    }).distinct("recipe");

    const [recipes, totalRecords] = await Promise.all([
      Recipe.find(query)
        .populate("country", "_id name")
        .populate("babyStage", "_id title")
        .populate("nutritionTags", "_id name benefit")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      Recipe.countDocuments(query),
    ]);

    const data = recipes.map((recipe) => ({
      _id: recipe._id,

      title: recipe.title,

      image: recipe.image,

      prepTime: recipe.prepTime,

      mealType: recipe.mealType,

      nutritionTags: recipe.nutritionTags,

      country: recipe.country,

      babyStage: recipe.babyStage,

      isFavorite: favoriteIds.some(
        (id) => id.toString() === recipe._id.toString(),
      ),
    }));

    const meta = generateMeta(page, limit, totalRecords);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data,
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
      _id: recipe._id,
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
        .populate("nutritionTags", "_id name benefit")
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

const adminGetRecipeById = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["id"],
        objectIdFields: ["id"],
      })
    ) {
      return;
    }

    const recipe = await Recipe.findById(req.params.id)
      .populate("country", "_id name")
      .populate("babyStage", "_id title")
      .populate("nutritionTags", "_id name benefit");

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
      .populate("nutritionTags", "_id name benefit")
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
      .populate("nutritionTags", "_id name benefit")
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
        objectIdFields: [
          "country",
          "babyStage",
          ...(req.body.nutritionTags || []),
        ],
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
      feedingInsight,
      allergyReminder,
      ingredients,
      method,
      notes,
      acceptanceLabel,
    } = req.body;

    const { valid, invalidIds } = await validateNutritionTagIds(nutritionTags);

    if (!valid) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "invalid_nutrition_tags",
        data: { invalidIds },
      });
    }

    const recipe = await Recipe.create({
      title: title.trim(),
      image,
      prepTime,
      country,
      babyStage,
      mealType: mealType || "",
      nutritionTags,
      feedingInsight: feedingInsight || "",
      allergyReminder: allergyReminder || "",
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
      "feedingInsight",
      "allergyReminder",
      "ingredients",
      "method",
      "notes",
      "acceptanceLabel",
      "status",
      "isActive",
    ];

    if (
      req.body.country &&
      !mongoose.Types.ObjectId.isValid(req.body.country)
    ) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "invalid_country",
      });
    }

    if (
      req.body.babyStage &&
      !mongoose.Types.ObjectId.isValid(req.body.babyStage)
    ) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "invalid_baby_stage",
      });
    }

    if (req.body.status) {
      const allowedStatuses = ["draft", "pending", "published", "archived"];

      if (!allowedStatuses.includes(req.body.status)) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "invalid_status",
        });
      }
    }

    if (req.body.nutritionTags) {
      const { valid, invalidIds } = await validateNutritionTagIds(
        req.body.nutritionTags,
      );

      if (!valid) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "invalid_nutrition_tags",
          data: { invalidIds },
        });
      }
    }

    fields.forEach((field) => {
      if (req.body[field] !== undefined) recipe[field] = req.body[field];
    });

    await recipe.save();

    // const updatedRecipe = await Recipe.findById(recipe._id)
    //   .populate("country", "_id name")
    //   .populate("babyStage", "_id title")
    //   .populate("nutritionTags", "_id name benefit");

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
  getBabyRecipes,
  adminGetRecipes,
  adminGetRecipeById,
  getUserRecipes,
  getUserBabyRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  getCustomCulturalPicks,
};
