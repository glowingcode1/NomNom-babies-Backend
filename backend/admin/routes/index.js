const express = require("express");
const router = express.Router();


const bulkInsertRoutes = require("./dbRoutes.js");
const adminSettingsRoutes = require("./settingsRoutes.js");
const userRoutes = require("./userRoutes.js");
router.use("/settings", adminSettingsRoutes);
router.use("/users", userRoutes);
//db utils routes
router.use("/util", bulkInsertRoutes);


module.exports = router;
