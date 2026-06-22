const Baby = require("@models/Baby");
const Recipe = require("@models/Recipe");
const Journey = require("@models/Journey");
const Nutrition = require("@models/Nutrition");
const FeedingLog = require("@models/FeedingLog");
const FeedingSchedule = require("@models/FeedingSchedule");
const FoodIntroduction = require("@models/FoodIntroduction");

const { User } = require("@models/UserModel");
const { sendResponse } = require("@utils/responseUtil");

const getHome = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "data_fetched_successfully",
        data: {
          hasBaby: false,
        },
      });
    }

    const baby = await Baby.findById(user.activeBaby)
      .populate("babyStage")
      .populate("selectedCountries");

    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const today = new Date().toISOString().split("T")[0];

    const [
      feedingSchedule,
      todayLogs,
      culturalRecipes,
      weeklyFocus,
      journey,
      foodTracker,
    ] = await Promise.all([
      FeedingSchedule.findOne({
        baby: baby._id,
      }).populate({
        path: "slots.recipe",
        populate: [
          {
            path: "country",
          },
          {
            path: "babyStage",
          },
        ],
      }),

      FeedingLog.find({
        baby: baby._id,
        date: today,
      }),

      Recipe.find({
        country: {
          $in: baby.selectedCountries.map((c) => c._id),
        },
        babyStage: baby.babyStage?._id,
        status: "published",
        isActive: true,
      })
        .populate("country")
        .limit(6),

      Nutrition.findOne({
        isWeeklyFocus: true,
        isActive: true,
      }).populate("recipe"),

      Journey.findOne({
        babyStage: baby.babyStage?._id,
        isActive: true,
      }),

      FoodIntroduction.find({
        baby: baby._id,
      })
        .populate("recipe")
        .sort({
          introducedAt: -1,
        })
        .limit(5),
    ]);

    const completedSlotIds = new Set(
      todayLogs.map((log) => String(log.slotId)),
    );

    const recommendedMeals =
      feedingSchedule?.slots?.map((slot) => ({
        id: slot._id,
        type: slot.type,
        title: slot.title,
        description: slot.description,
        time: slot.time,
        completed: completedSlotIds.has(String(slot._id)),
      })) || [];

    const completionRate =
      recommendedMeals.length === 0
        ? 0
        : Math.round(
            (recommendedMeals.filter((meal) => meal.completed).length /
              recommendedMeals.length) *
              100,
          );

    const currentTime = new Date();

    const nextMeal = feedingSchedule?.slots?.find(() => true) || null;

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        babyCard: {
          babyId: baby._id,
          babyName: baby.name,
          stage: baby.babyStage?.title || "",
          countries: baby.selectedCountries.map((country) => country.name),
        },

        recommendedToday: {
          completionRate,
          meals: recommendedMeals,
        },

        weeklyJourney: journey
          ? {
              currentDay: journey.dayNumber,
              totalDays: 7,
              title: journey.title,
              description: journey.description,
            }
          : null,

        customCulturalPicks: culturalRecipes.map((recipe) => ({
          id: recipe._id,
          title: recipe.title,
          emoji: recipe.emoji,
          image: recipe.image,
          mealType: recipe.mealType,
          difficulty: recipe.difficulty,
          prepTime: recipe.prepTime,
          country: recipe.country?.name || "",
        })),

        foodTracker: foodTracker.map((item) => ({
          recipeId: item.recipe?._id,
          title: item.recipe?.title,
          image: item.recipe?.image,
          introducedAt: item.introducedAt,
          introducedDaysAgo: Math.floor(
            (Date.now() - new Date(item.introducedAt).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        })),

        weeklyFocus: weeklyFocus
          ? {
              recipe: weeklyFocus.recipe?.title || "",
              nutrients: weeklyFocus.nutrients || [],
              feedingInsight: weeklyFocus.feedingInsight,
              allergyReminder: weeklyFocus.allergyReminder,
            }
          : null,

        nextMeal,

        downloads: {
          enabled: true,
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

module.exports = {
  getHome,
};
