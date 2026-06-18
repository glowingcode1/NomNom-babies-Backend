const express = require("express");
const router = express.Router();

const bulkInsertRoutes = require("./dbRoutes.js");
const adminSettingsRoutes = require("./settingsRoutes.js");
const userRoutes = require("./userRoutes.js");
const countriesRoutes = require("./countriesRoutes.js");
const languageRoutes = require("./languageRoutes.js");

router.use("/settings", adminSettingsRoutes);
router.use("/users", userRoutes);
router.use("/countries", countriesRoutes);
router.use("/languages", languageRoutes);
//db utils routes
router.use("/util", bulkInsertRoutes);

module.exports = router;
