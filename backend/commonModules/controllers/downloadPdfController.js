const FeedingSchedule = require("@models/FeedingSchedule");
const Recipe = require("@models/Recipe");
const GroceryList = require("@models/GroceryList");
const Baby = require("@models/Baby");
const { User } = require("@models/UserModel");

const {
  generateFeedingSchedulePdf,
  generateRecipePdf,
  generateGroceryPdf,
} = require("@utils/downloadPdfUtil");

const { sendResponse } = require("@utils/responseUtil");

const downloadFeedingSchedulePdf = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const baby = await Baby.findById(user.activeBaby).populate("babyStage");

    const schedules = await FeedingSchedule.find({
      baby: user.activeBaby,
      user: req.user._id,
    }).sort({
      date: 1,
      time: 1,
    });

    const pdf = await generateFeedingSchedulePdf(baby, schedules);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="feeding.pdf"',
    });

    return res.send(pdf);
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
    const recipe = await Recipe.findById(req.params.recipeId).populate(
      "country",
    );

    if (!recipe) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "recipe_not_found",
      });
    }

    const pdf = await generateRecipePdf(recipe);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${recipe.title}.pdf"`,
    });

    return res.send(pdf);
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
    }).populate("recipes.recipe");

    if (!grocery) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "grocery_list_not_found",
      });
    }

    const pdf = await generateGroceryPdf(grocery);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="grocery.pdf"',
    });

    return res.send(pdf);
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
  downloadFeedingSchedulePdf,
  downloadRecipePdf,
  downloadGroceryPdf,
};
