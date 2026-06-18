const express = require("express");
const router = express.Router();

const authRoutes = require("./authRoutes.js");

const babyStageRoutes = require("./babyStageRoutes.js");
const uploadRoutes = require("./uploadRoutes.js");
const uploads3Routes = require("./uploadAWSRoutes.js");
const babyRoutes = require("./babyroutes.js");
const recipeRoutes = require("./recipeRoutes.js");
const nutritionRoutes = require("./nutritionRoutes.js");
const feedingScheduleRoutes = require("./feedingScheduleRoutes.js");
const languageRoutes = require("./languageRoutes.js");
const favoriteRecipeRoutes = require("./FavoriteRecipeRoutes.js");
const groceryListRoutes = require("./groceryListRoutes.js");

router.use("/upload", uploadRoutes);
router.use("/upload/s3", uploads3Routes);
router.use("/baby-stages", babyStageRoutes);
router.use("/auth", authRoutes);
router.use("/babies", babyRoutes);
router.use("/recipes", recipeRoutes);
router.use("/nutrition", nutritionRoutes);
router.use("/feeding-schedule", feedingScheduleRoutes);
router.use("/languages", languageRoutes);
router.use("/favorites", favoriteRecipeRoutes);
router.use("/grocery-list", groceryListRoutes);

module.exports = router;
