const FeedingSchedule = require("@models/FeedingSchedule");
const Recipe = require("@models/Recipe");
const GroceryList = require("@models/GroceryList");
const Baby = require("@models/Baby");
const { User } = require("@models/UserModel");

const {
  generateFeedingTimeTablePdf,
} = require("@utils/downloadPdf/feedingTimeTablePdf");

const { generateRecipePdf } = require("@utils/downloadPdf/recipeDetailPdf");

const { generateGroceryPdf } = require("@utils/downloadPdf/groceryListPdf");

const { sendResponse } = require("@utils/responseUtil");
const { babyPopulate } = require("@utils/babyUtil");
const FeedingLog = require("@models/FeedingLog");
const { savePdf } = require("@utils/downloadPdf/pdfStorage");

const downloadFeedingTimeTablePdf = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }
    const today = new Date().toISOString().split("T")[0];

    const baby = await Baby.findById(user.activeBaby).populate(babyPopulate);

    const schedules = await FeedingSchedule.find({
      baby: baby._id,
      user: req.user._id,
      date: today,
    }).sort({ time: 1 });

    const logs = await FeedingLog.find({
      baby: baby._id,
      user: req.user._id,
      date: today,
    });

    const completedIds = new Set(logs.map((log) => String(log.slotId)));

    const recommendedToday = schedules.map((slot) => ({
      _id: slot._id,
      type: slot.type,
      title: slot.title,
      description: slot.description,
      time: slot.time,
      completed: completedIds.has(String(slot._id)),
    }));

    const completionRate =
      recommendedToday.length === 0
        ? 0
        : Math.round(
            (recommendedToday.filter((m) => m.completed).length /
              recommendedToday.length) *
              100,
          );

    const babyInfo = {
      _id: baby._id,
      name: baby.name,
      profileIcon: baby.profileIcon,
      stage: {
        _id: baby.babyStage._id,
        title: baby.babyStage.title,
      },
      countries: baby.selectedCountries,
    };

    const feedingNotes = [
      "Introduce one new food at a time to track allergies",
      "Use soft puree texture",
      "Observe reactions carefully",
    ];

    const pdf = await generateFeedingTimeTablePdf({
      babyInfo,
      completionRate,
      recommendedToday,
      feedingNotes,
    });

    const relativePath = await savePdf(pdf, `feeding-${baby._id}.pdf`);

    const pdfUrl = `${req.protocol}://${req.get("host")}${relativePath}`;

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        pdfUrl,
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

const downloadRecipePdf = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.recipeId)
      .populate("country", "_id name")
      .populate("babyStage", "_id title");

    if (!recipe) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "recipe_not_found",
      });
    }

    const recipeResponse = {
      recipeId: recipe._id,

      title: recipe.title,

      image: recipe.image,

      prepTime: `${recipe.prepTime}`,

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

      nutritionTags: recipe.nutritionTags || [],

      ingredients: recipe.ingredients.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        icon: item.icon,
      })),

      instructions: recipe.method.map((step) => ({
        step: step.step,

        description: step.instruction,
      })),

      notes: recipe.notes,

      acceptanceLabel: recipe.acceptanceLabel,
    };

    const pdf = await generateRecipePdf(recipeResponse);

    const filename = `recipe-${recipe._id}.pdf`;

    const relativePath = await savePdf(pdf, filename);

    const pdfUrl = `${req.protocol}://${req.get("host")}${relativePath}`;

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        pdfUrl,
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

const downloadGroceryPdf = async (req, res) => {
  try {
    const grocery = await GroceryList.findOne({
      user: req.user._id,
    }).populate("recipes.recipe", "_id title image");

    if (!grocery) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "grocery_list_not_found",
      });
    }

    ////////////////////////////////////////////

    const recipesIncluded = grocery.recipes.map((recipe) => ({
      recipeId: recipe.recipe._id,

      title: recipe.recipe.title,

      image: recipe.recipe.image || "",
    }));

    ////////////////////////////////////////////

    const groceryChecklist = [];

    const categoriesMap = {};

    grocery.recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ingredient) => {
        groceryChecklist.push({
          _id: ingredient._id,

          name: ingredient.name,

          icon: ingredient.icon || "",

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

    ////////////////////////////////////////////

    const ingredientCategories = Object.keys(categoriesMap).map((category) => ({
      category,

      items: [...new Set(categoriesMap[category])],
    }));

    ////////////////////////////////////////////

    const groceryResponse = {
      recipesIncluded,

      groceryChecklist,

      ingredientCategories,
    };

    const pdf = await generateGroceryPdf(groceryResponse);

    const relativePath = await savePdf(pdf, `grocery-${req.user._id}.pdf`);

    const pdfUrl = `${req.protocol}://${req.get("host")}${relativePath}`;

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        pdfUrl,
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

module.exports = {
  downloadFeedingTimeTablePdf,
  downloadRecipePdf,
  downloadGroceryPdf,
};
