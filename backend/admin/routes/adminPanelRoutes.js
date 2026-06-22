const express = require("express");
const {
  dashboard,
  userStatusStats,
  platformHealth,
  topViewedRecipes,
  topCountries,
  recentActivities,
  getUserStatsByRegion,
} = require("../controllers/adminPanelController");
const auth = require("@middlewares/authMiddleware");
const router = express.Router();

router.get("/dashboard", auth, dashboard);

router.get("/dashboard/user-status", auth, userStatusStats);

router.get("/dashboard/platform-health", auth, platformHealth);

router.get("/dashboard/top-recipes", auth, topViewedRecipes);

router.get("/dashboard/top-countries", auth, topCountries);

router.get("/dashboard/recent-activities", auth, recentActivities);

router.get("/dashboard/user-growth", auth, getUserStatsByRegion);

module.exports = router;
