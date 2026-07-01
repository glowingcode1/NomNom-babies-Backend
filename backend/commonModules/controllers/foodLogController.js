const {
  sendResponse,
  parsePaginationParams,
  generateMeta,
  validateParams,
} = require("@utils/responseUtil");
const { User } = require("@models/UserModel");
const FoodLog = require("@models/FoodLog");

const createFoodLog = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        rawData: ["foodName", "day", "description"],
      })
    )
      return;

    const user = await User.findById(req.user._id);

    if (!user.activeBaby) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "baby_not_found",
      });
    }

    const today = new Date().toISOString().split("T")[0];

    const log = await FoodLog.create({
      baby: user.activeBaby,
      user: req.user._id,
      foodName: req.body.foodName,
      day: req.body.day,
      description: req.body.description,
      date: today,
    });
    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "food_log_created",
      data: log,
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

const getFoodLogs = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.activeBaby) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "baby_not_found",
      });
    }

    const { page, limit, skip } = parsePaginationParams(req);

    const query = {
      baby: user.activeBaby,
      user: req.user._id,
    };

    const [logs, totalRecords] = await Promise.all([
      FoodLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),

      FoodLog.countDocuments(query),
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: logs,
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

const toggleFoodLogCompletion = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["logId"],
        objectIdFields: ["logId"],
      })
    )
      return;

    const log = await FoodLog.findById(req.params.logId);

    if (!log) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "food_log_not_found",
      });
    }

    if (log.completed) {
      log.badgeEarned = false;
    } else {
      log.badgeEarned = true;
    }

    log.completed = !log.completed;

    await log.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "food_log_updated",
      data: {
        completed: log.completed,
        badgeEarned: log.badgeEarned,
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
  createFoodLog,
  getFoodLogs,
  toggleFoodLogCompletion,
};
