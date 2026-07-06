const Baby = require("@models/Baby");
const Nutrition = require("@models/Nutrition");
const Recipe = require("@models/Recipe");
const { User } = require("@models/UserModel");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

// Get nutrition facts & benefits for a recipe (nutrition page screen)
const getNutritionByRecipe = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["recipeId"],
        objectIdFields: ["recipeId"],
      })
    )
      return;

    const nutrition = await Nutrition.findOne({
      recipe: req.params.recipeId,
      isActive: true,
    }).populate("recipe", "_id title");

    if (!nutrition) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "nutrition_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        nutrients: nutrition.nutrients,

        feedingInsight: nutrition.feedingInsight,

        allergyReminder: nutrition.allergyReminder,
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

const getNutrition = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const baby = await Baby.findById(user.activeBaby);

    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const recipes = await Recipe.find({
      babyStage: baby.babyStage,

      status: "published",

      isActive: true,
    }).select("_id");

    const recipeIds = recipes.map((r) => r._id);

    const nutritions = await Nutrition.find({
      recipe: {
        $in: recipeIds,
      },

      isActive: true,
    });

    const nutrientMap = new Map();

    nutritions.forEach((nutrition) => {
      nutrition.nutrients.forEach((nutrient) => {
        if (!nutrientMap.has(nutrient.name)) {
          nutrientMap.set(
            nutrient.name,

            {
              name: nutrient.name,

              benefit: nutrient.benefit,
            },
          );
        }
      });
    });

    const nutrients = Array.from(nutrientMap.values());

    return sendResponse({
      res,

      statusCode: 200,

      translationKey: "data_fetched_successfully",

      data: {
        nutrients,

        feedingInsight: nutritions[0]?.feedingInsight || "",
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

// Get all nutrition entries with pagination (admin)
const adminGetNutritions = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);

  try {
    const { search = "", status } = req.query;

    const match = {};

    if (status) {
      match.status = status;
    }

    const pipeline = [
      {
        $match: match,
      },

      {
        $addFields: {
          tagName: {
            $arrayElemAt: ["$nutrients.name", 0],
          },

          benefit: {
            $arrayElemAt: ["$nutrients.benefit", 0],
          },
        },
      },

      {
        $lookup: {
          from: "recipes",

          let: {
            tag: "$tagName",
          },

          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$$tag", "$nutritionTags"],
                },
              },
            },
          ],

          as: "recipeDocs",
        },
      },

      {
        $addFields: {
          recipes: {
            $size: "$recipeDocs",
          },
        },
      },

      {
        $match: {
          ...(search && {
            $or: [
              {
                tagName: {
                  $regex: search,

                  $options: "i",
                },
              },

              {
                benefit: {
                  $regex: search,

                  $options: "i",
                },
              },
            ],
          }),
        },
      },

      {
        $project: {
          name: "$tagName",

          benefit: 1,

          recipes: 1,

          status: 1,
        },
      },

      {
        $sort: {
          name: 1,
        },
      },

      {
        $facet: {
          data: [{ $skip: (page - 1) * limit }, { $limit: limit }],

          total: [{ $count: "count" }],
        },
      },
    ];

    const result = await Nutrition.aggregate(pipeline);

    const rows = result[0].data;

    const totalRecords = result[0].total[0]?.count || 0;
    const meta = generateMeta(page, limit, totalRecords);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: rows,
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

// Get single nutrition entry by ID (admin)
const adminGetNutritionById = async (req, res) => {
  try {
    if (
      !validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })
    )
      return;

    const nutrition = await Nutrition.findById(req.params.id).populate(
      "recipe",
      "title",
    );

    if (!nutrition) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "nutrition_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: nutrition,
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

// Create nutrition entry for a recipe
const createNutrition = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        rawData: ["recipe", "nutrients"],
        objectIdFields: ["recipe"],
      })
    )
      return;

    const { recipe, nutrients, feedingInsight, allergyReminder } = req.body;

    const recipeDoc = await Recipe.findById(recipe);

    if (!recipeDoc) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "recipe_not_found",
      });
    }

    // Validate nutrient names exist in recipe tags
    const recipeTags = recipeDoc.nutritionTags || [];

    const invalidNutrients = nutrients.filter(
      (n) => !recipeTags.includes(n.name),
    );

    if (invalidNutrients.length > 0) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "invalid_nutrition_tags",
        data: {
          invalidNutrients: invalidNutrients.map((n) => n.name),
          allowedTags: recipeTags,
        },
      });
    }

    const existing = await Nutrition.findOne({ recipe });
    if (existing) {
      return sendResponse({
        res,
        statusCode: 409,
        translationKey: "nutrition_already_exists",
      });
    }

    const nutrition = await Nutrition.create({
      recipe,
      nutrients,
      feedingInsight: feedingInsight || "",
      allergyReminder: allergyReminder || "",
    });

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "nutrition_created_success",
      data: nutrition,
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

// Update nutrition entry
const updateNutrition = async (req, res) => {
  try {
    if (
      !validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })
    )
      return;

    const nutrition = await Nutrition.findById(req.params.id);
    if (!nutrition) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "nutrition_not_found",
      });
    }

    const fields = [
      "nutrients",
      "feedingInsight",
      "allergyReminder",
      "isActive",
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) nutrition[field] = req.body[field];
    });

    if (req.body.nutrients) {
      const recipeDoc = await Recipe.findById(nutrition.recipe);

      const recipeTags = recipeDoc.nutritionTags || [];

      const invalidNutrients = req.body.nutrients.filter(
        (n) => !recipeTags.includes(n.name),
      );

      if (invalidNutrients.length > 0) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "invalid_nutrition_tags",
          data: {
            invalidNutrients: invalidNutrients.map((n) => n.name),
            allowedTags: recipeTags,
          },
        });
      }
    }

    await nutrition.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "nutrition_updated_success",
      data: nutrition,
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

// Delete nutrition entry
const deleteNutrition = async (req, res) => {
  try {
    if (
      !validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })
    )
      return;

    const nutrition = await Nutrition.findByIdAndDelete(req.params.id);
    if (!nutrition) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "nutrition_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "nutrition_deleted_success",
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
  getNutritionByRecipe,
  getNutrition,
  adminGetNutritions,
  adminGetNutritionById,
  createNutrition,
  updateNutrition,
  deleteNutrition,
};
