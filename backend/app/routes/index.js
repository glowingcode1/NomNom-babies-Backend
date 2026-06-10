const express = require("express");
const router = express.Router();


const homeRoutes = require("./homeRoutes");
const usersRoutes = require("./userRoutes");
const notificationsRoutes = require("./notificationsRoutes");
const settingsRoutes = require("./settingsRoutes");
const supportRoutes = require("./supportRoutes");


router.use("/support", supportRoutes);
router.use("/settings", settingsRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/home", homeRoutes);
router.use("/users", usersRoutes);


module.exports = router;