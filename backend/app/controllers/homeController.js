const Baby = require("@models/Baby");
const Recipe = require("@models/Recipe");
const Nutrition = require("@models/Nutrition");
const FeedingLog = require("@models/FeedingLog");
const FeedingSchedule = require("@models/FeedingSchedule");
const FoodIntroduction = require("@models/FoodIntroduction");

const { User } = require("@models/UserModel");
const { sendResponse } = require("@utils/responseUtil");
const FoodTracker = require("@models/FoodTracker");

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
      allLogs,
      culturalRecipes,
      weeklyFocus,
      foodTracker,
    ] = await Promise.all([
      FeedingSchedule.findOne({
        baby: baby._id,
      }).populate({
        path: "weekSchedules.slots.recipe",
        populate: [{ path: "country" }, { path: "babyStage" }],
      }),

      FeedingLog.find({
        baby: baby._id,
        user: userId,
        date: today,
      }),

      FeedingLog.find({
        baby: baby._id,
        user: userId,
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

      FoodTracker.find({
        baby: baby._id,
        user: userId,
      })
        .sort({ date: -1 })
        .limit(5),
    ]);

    console.log(JSON.stringify(feedingSchedule?.weekSchedules, null, 2));
    console.log("TODAY:", today);
    console.log(
      "AVAILABLE DATES:",
      feedingSchedule?.weekSchedules?.map((d) => d.date),
    );

    const completedSlotIds = new Set(
      todayLogs.map((log) => String(log.slotId)),
    );

    let todaySchedule = feedingSchedule?.weekSchedules?.find(
      (day) => day.date === today,
    );

    // If today doesn't exist in schedule,
    // take nearest upcoming schedule day
    if (!todaySchedule) {
      todaySchedule = feedingSchedule?.weekSchedules
        ?.filter((day) => day.date >= today)
        ?.sort((a, b) => a.date.localeCompare(b.date))[0];
    }

    // If all schedule dates are in the past,
    // take first available day
    if (!todaySchedule) {
      todaySchedule = feedingSchedule?.weekSchedules?.[0];
    }

    const recommendedMeals =
      todaySchedule?.slots?.map((slot) => ({
        id: slot._id,
        type: slot.type,
        title: slot.title,
        description: slot.description,
        time: slot.time,
        completed: completedSlotIds.has(String(slot._id)),
      })) || [];

    const incompleteSlots =
      todaySchedule?.slots?.filter(
        (slot) => !completedSlotIds.has(String(slot._id)),
      ) || [];

    const nextMeal =
      incompleteSlots.sort((a, b) => a.time.localeCompare(b.time))[0] || null;

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        babyInfo: {
          babyId: baby._id,
          babyName: baby.name,
          stage: baby.babyStage?.title || "",
          countries: baby.selectedCountries.map((country) => country.name),
        },

        recommendedToday: recommendedMeals,

        weeklyJourney:
          feedingSchedule?.weekSchedules?.map((day) => {
            const totalSlots = day.slots.length;

            const completedSlots = day.slots.filter((slot) =>
              allLogs.some(
                (log) =>
                  String(log.slotId) === String(slot._id) &&
                  log.date === day.date,
              ),
            ).length;

            return {
              dayNumber: day.dayNumber,
              dayName: dayNames[day.dayNumber - 1],
              date: day.date,
              totalSlots,
              completedSlots,
              completed: totalSlots > 0 && completedSlots === totalSlots,
            };
          }) || [],

        customCulturalPicks: culturalRecipes.map((recipe) => ({
          id: recipe._id,
          title: recipe.title,
          image: recipe.image,
          mealType: recipe.mealType,
          prepTime: recipe.prepTime,
          country: recipe.country?.name || "",
        })),

        foodTracker: foodTracker.map((item) => ({
          id: item._id,
          ingredientName: item.ingredientName,
          image: item.image,
          date: item.date,
          reaction: item.reaction,
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
