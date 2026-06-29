const FoodTracker = require("@models/FoodTracker");
const {
  generateMeta,
  parsePaginationParams,
  sendResponse,
  validateParams,
} = require("@utils/responseUtil");

const createFoodTracker = async (req, res) => {
  try {

    if (
      !validateParams(req, res, {
        rawData: ["baby", "ingredientName", "date", "reaction"],
      })
    ) {
      return;
    }

    const { image, baby, ingredientName, date, reaction } = req.body;

    const foodTracker = await FoodTracker.create({
      image,
      baby,
      user: req.user._id,
      ingredientName,
      date,
      reaction,
    });

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "food_tracker_created_successfully",
      data: foodTracker,
    });
  } catch (error) {

    return sendResponse({
      res,
      statusCode: 500,
      trasnlationKey: error.message,
      error,
    });
  }
};

const getFoodTracker = async (req, res) => {
  try {
    const { babyId } = req.params;

    const foodTracker = await FoodTracker.find({
      baby: babyId,
      user: req.user._id,
    }).sort({ date: -1 });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "food_tracker_fetched_successfully",
      data: foodTracker,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      trasnlationKey: error.message,
      error,
    });
  }
};

const getAllFoodTrackers = async (req, res) => {
  try {
    const { page, limit } = parsePaginationParams(req);

    const [foodTrackers, totalRecords] = await Promise.all([
      FoodTracker.find()
        .populate("baby", "name")
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      FoodTracker.countDocuments(),
    ]);

    const meta = generateMeta(page, limit, totalRecords);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "food_trackers_fetched_successfully",
      data: foodTrackers,
      meta,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error,
    });
  }
};

module.exports = {
  createFoodTracker,
  getFoodTracker,

  getAllFoodTrackers,
};
