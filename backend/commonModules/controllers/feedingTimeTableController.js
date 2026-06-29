const Baby = require("@models/Baby");
const FeedingSchedule = require("@models/FeedingSchedule");
const FeedingLog = require("@models/FeedingLog");
const { User } = require("@models/UserModel");
const { sendResponse } = require("@utils/responseUtil");
const { getBabyInfo } = require("@utils/babyUtil");

const getFeedingTimetable = async (req, res) => {
  try {
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

    const baby = await Baby.findById(user.activeBaby)
      .populate("babyStage", "_id title")
      .populate("selectedCountries", "_id name");

    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const today = new Date().toISOString().split("T")[0];

    const [schedule, logs] = await Promise.all([
      FeedingSchedule.findOne({
        baby: baby._id,
        user: req.user._id,
      }).populate(
        "weekSchedules.slots.recipe",
        "_id title image mealType prepTime",
      ),

      FeedingLog.find({
        baby: baby._id,
        user: req.user._id,
        date: today,
      }),
    ]);

    const completedIds = new Set(logs.map((log) => String(log.slotId)));

    const todaySchedule = schedule?.weekSchedules?.find(
      (day) => day.date === today,
    );

    const recommendedToday =
      todaySchedule?.slots?.map((slot) => ({
        slotId: slot._id,

        type: slot.type,

        time: slot.time,

        title: slot.title,

        description: slot.description,

        amount: slot.amount,

        recipe: slot.recipe
          ? {
              _id: slot.recipe._id,
              title: slot.recipe.title,
              image: slot.recipe.image,
              mealType: slot.recipe.mealType,
              prepTime: slot.recipe.prepTime,
            }
          : null,

        completed: completedIds.has(String(slot._id)),
      })) || [];

    const nextMeal = recommendedToday.find((meal) => !meal.completed) || null;

    const completionRate =
      recommendedToday.length === 0
        ? 0
        : Math.round(
            (recommendedToday.filter((meal) => meal.completed).length /
              recommendedToday.length) *
              100,
          );

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",

      data: {
        babyInfo: getBabyInfo(baby),

        completionRate,

        recommendedToday,

        nextMeal,

        feedingNotes: [
          "Introduce one new food at a time to track allergies",

          "Use soft puree texture",

          "Observe reactions carefully",
        ],
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
  getFeedingTimetable,
};
