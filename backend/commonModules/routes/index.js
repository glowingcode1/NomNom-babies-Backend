const express = require("express");
const router = express.Router();


const authRoutes = require("./authRoutes.js");


const countriesRoutes = require("./countriesRoutes.js");
const babyStageRoutes = require("./babyStageRoutes.js"); 
const uploadRoutes = require("./uploadRoutes.js");
const uploads3Routes = require("./uploadAWSRoutes.js");
const babyRoutes = require("./babyroutes.js");
const recipeRoutes = require("./recipeRoutes.js");
const nutritionRoutes = require("./nutritionRoutes.js");
const feedingScheduleRoutes = require("./feedingScheduleRoutes.js");

router.use("/upload", uploadRoutes);
router.use("/upload/s3", uploads3Routes);
router.use("/countries", countriesRoutes); 
router.use("/baby-stages", babyStageRoutes);
router.use("/auth", authRoutes);
router.use("/babies", babyRoutes);
router.use("/recipes", recipeRoutes);
router.use("/nutrition", nutritionRoutes);
router.use("/feeding-schedule", feedingScheduleRoutes);

module.exports = router;