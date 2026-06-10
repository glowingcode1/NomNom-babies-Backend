const express = require("express");
const router = express.Router();


const bulkInsertRoutes = require("./dbRoutes.js");
const adminSettingsRoutes = require("./settingsRoutes.js");
router.use("/settings", adminSettingsRoutes);
//db utils routes
router.use("/util", bulkInsertRoutes);


module.exports = router;
