const express = require("express");

const auth = require("../../middlewares/authMiddleware");

const {
  getFeedingTimetable,
} = require("../controllers/feedingTimeTableController");

const router = express.Router();

router.get(
  "/",

  auth,

  getFeedingTimetable,
);

module.exports = router;
