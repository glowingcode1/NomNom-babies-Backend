const Baby = require("@models/Baby");
const FeedingSchedule = require("@models/FeedingSchedule");
const FeedingLog = require("@models/FeedingLog");
const { User } = require("@models/UserModel");
const {
  sendResponse,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");
const { getBabyInfo, babyPopulate } = require("@utils/babyUtil");

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
      baby: baby._id,
      user: req.user._id,
      date: today,
    };

    const today = new Date().toISOString().split("T")[0];

    const [totalRecords, schedule, logs] = await Promise.all([
      FeedingSchedule.find(query).sort({ time: 1 }).skip(skip).limit(limit),

      FeedingLog.find({
        baby: baby._id,
        user: req.user._id,
        date: today,
      }),
    ]);

    const completedIds = new Set(logs.map((log) => String(log.slotId)));

    const todaySchedule = schedule.query((item) => item.date === today);

    const recommendedToday =
      todaySchedule.map((slot) => ({
        id: slot._id,
        type: slot.type,
        title: slot.title,
        description: slot.description,
        time: slot.time,
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
      meta: generateMeta({
        page,
        limit,
        totalRecords,
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

module.exports = {
  getFeedingTimetable,
};
