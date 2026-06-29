const FeedingSchedule = require("@models/FeedingSchedule");
const FeedingLog = require("@models/FeedingLog");
const { sendResponse, validateParams } = require("@utils/responseUtil");
const Baby = require("@models/Baby");
const mongoose = require("mongoose");
const { User } = require("@models/UserModel");

// Get feeding schedule for active baby on a given date
const getFeedingSchedule = async (req, res) => {
  try {
    const { babyId, date } = req.query;
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
    }).populate("weekSchedules.slots.recipe", "_id title image prepTime");

    if (!schedule) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "feeding_schedule_not_found",
      });
    }

    const logs = await FeedingLog.find({
      baby: babyId,
      user: req.user._id,
      date,
    });

    const completedSlotIds = new Set(logs.map((l) => String(l.slotId)));

    const selectedDay = schedule.weekSchedules.find((day) => day.date === date);

    if (!selectedDay) {
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "data_fetched_successfully",
        data: {
          scheduleId: schedule._id,
          slots: [],
          progress: {
            completed: 0,
            total: 0,
          },
        },
      });
    }

    const slots = selectedDay.slots.map((slot) => ({
      _id: slot._id,
      type: slot.type,
      time: slot.time,
      title: slot.title,
      description: slot.description,
      amount: slot.amount,
      recipe: slot.recipe,
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

const getScheduleSlotDetail = async (req, res) => {
  try {
    const { slotId } = req.params;
    const schedule = await FeedingSchedule.aggregate([
      {
        $match: {
          user: req.user._id,
        },
      },
      {
        $unwind: "$weekSchedules",
      },
      {
        $unwind: "$weekSchedules.slots",
      },
      {
        $match: {
          "weekSchedules.slots._id": new mongoose.Types.ObjectId(slotId),
        },
      },
      {
        $replaceRoot: {
          newRoot: "$weekSchedules.slots",
        },
      },
    ]);

    if (!schedule.length) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "feeding_schedule_not_found",
      });
    }

    const slot = schedule?.[0]?.slot;

    if (!slot) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "feeding_slot_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: slot,
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

const removeScheduleSlot = async (req, res) => {
  try {
    const { slotId } = req.params;
    const schedule = await FeedingSchedule.findOne({
      "weekSchedules.slots._id": slotId,
      user: req.user._id,
    });

    if (!schedule) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "feeding_schedule_not_found",
      });
    }

    await FeedingSchedule.updateOne(
      {
        user: req.user._id,
        "weekSchedules.slots._id": slotId,
      },
      {
        $pull: {
          "weekSchedules.$[].slots": {
            _id: slotId,
          },
        },
      },
    );

    await schedule.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "feeding_slot_deleted_success",
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
    if (!validateParams(req, res, { rawData: ["babyId", "weekSchedules"] }))
      return;

    const { babyId, weekSchedules } = req.body;

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
      weekSchedules,
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
    if (
      !validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })
    )
      return;

    const { weekSchedules } = req.body;

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

    if (weekSchedules !== undefined) schedule.weekSchedules = weekSchedules;
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
    if (
      !validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })
    )
      return;

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

const getUserFeedingSchedules = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["userId"],
        objectIdFields: ["userId"],
      })
    )
      return;

    const schedules = await FeedingSchedule.find({
      user: req.params.userId,
    })
      .populate("baby", "_id name")
      .populate("weekSchedules.slots.recipe", "_id title image prepTime")
      .sort({ createdAt: -1 });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: schedules,
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

const getUserBabyFeedingSchedule = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["userId", "babyId"],
        objectIdFields: ["userId", "babyId"],
      })
    )
      return;

    const schedule = await FeedingSchedule.findOne({
      user: req.params.userId,
      baby: req.params.babyId,
    })
      .populate("baby", "_id name")
      .populate("weekSchedules.slots.recipe", "_id title image prepTime");

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
      translationKey: "data_fetched_successfully",
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

// Mark / unmark a slot as completed for a given date
const toggleSlotCompletion = async (req, res) => {
  try {
    if (!validateParams(req, res, { rawData: ["babyId", "slotId", "date"] }))
      return;

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

const startFeedingPlan = async (req, res) => {
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

    baby.feedingPlanStarted = true;

    baby.feedingPlanStartedAt = new Date();

    await baby.save();

    return sendResponse({
      res,

      statusCode: 200,

      translationKey: "feeding_plan_started",
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
  getUserFeedingSchedules,
  getUserBabyFeedingSchedule,
  getScheduleSlotDetail,
  removeScheduleSlot,
  createFeedingSchedule,
  updateFeedingSchedule,
  deleteFeedingSchedule,
  toggleSlotCompletion,
  startFeedingPlan,
};
