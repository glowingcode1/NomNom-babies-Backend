const FeedingSchedule = require("@models/FeedingSchedule");
const FeedingLog = require("@models/FeedingLog");
const {
  sendResponse,
  validateParams,
} = require("@utils/responseUtil");

// Get feeding schedule for active baby on a given date
const getFeedingSchedule = async (req, res) => {
  try {
    const { babyId, date } = req.query; // date: "YYYY-MM-DD"

    if (!babyId || !date) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "baby_id_and_date_required",
      });
    }

    const schedule = await FeedingSchedule.findOne({
      baby: babyId,
      user: req.user._id,
    });

    if (!schedule) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "feeding_schedule_not_found",
      });
    }

    // Get completion logs for this baby on this date
    const logs = await FeedingLog.find({
      baby: babyId,
      user: req.user._id,
      date,
    });

    const completedSlotIds = new Set(logs.map((l) => String(l.slotId)));

    // Merge completion status into slots
    const slots = schedule.slots.map((slot) => ({
      _id: slot._id,
      time: slot.time,
      title: slot.title,
      description: slot.description,
      completed: completedSlotIds.has(String(slot._id)),
    }));

    const completedCount = slots.filter((s) => s.completed).length;

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        scheduleId: schedule._id,
        slots,
        progress: {
          completed: completedCount,
          total: slots.length,
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

// Create feeding schedule for a baby
const createFeedingSchedule = async (req, res) => {
  try {
    if (!validateParams(req, res, { rawData: ["babyId", "slots"] })) return;

    const { babyId, slots } = req.body;

    // Only one schedule per baby
    const existing = await FeedingSchedule.findOne({
      baby: babyId,
      user: req.user._id,
    });

    if (existing) {
      return sendResponse({
        res,
        statusCode: 409,
        translationKey: "feeding_schedule_already_exists",
      });
    }

    const schedule = await FeedingSchedule.create({
      baby: babyId,
      user: req.user._id,
      slots,
    });

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "feeding_schedule_created_success",
      data: schedule,
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

// Update feeding schedule slots
const updateFeedingSchedule = async (req, res) => {
  try {
    if (!validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })) return;

    const { slots } = req.body;

    const schedule = await FeedingSchedule.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!schedule) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "feeding_schedule_not_found",
      });
    }

    if (slots !== undefined) schedule.slots = slots;
    await schedule.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "feeding_schedule_updated_success",
      data: schedule,
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

// Delete feeding schedule
const deleteFeedingSchedule = async (req, res) => {
  try {
    if (!validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })) return;

    const schedule = await FeedingSchedule.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!schedule) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "feeding_schedule_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "feeding_schedule_deleted_success",
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

// Mark / unmark a slot as completed for a given date
const toggleSlotCompletion = async (req, res) => {
  try {
    if (!validateParams(req, res, { rawData: ["babyId", "slotId", "date"] })) return;

    const { babyId, slotId, date } = req.body;

    const existing = await FeedingLog.findOne({
      baby: babyId,
      user: req.user._id,
      slotId,
      date,
    });

    if (existing) {
      // Toggle: if already logged, remove it (unmark)
      await existing.deleteOne();
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "feeding_slot_unmarked",
        data: { completed: false },
      });
    }

    // Mark as completed
    await FeedingLog.create({
      baby: babyId,
      user: req.user._id,
      slotId,
      date,
      completed: true,
    });

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "feeding_slot_completed",
      data: { completed: true },
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
  getFeedingSchedule,
  createFeedingSchedule,
  updateFeedingSchedule,
  deleteFeedingSchedule,
  toggleSlotCompletion,
};