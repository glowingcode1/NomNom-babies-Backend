const {
  downloadFeedingSchedulePdf,
  downloadRecipePdf,
  downloadGroceryPdf,
} = require("@controllersCommonModules/downloadPdfController");
const auth = require("@middlewares/authMiddleware");
const express = require("express");

const router = express.Router();

router.get("/feeding-schedule", auth, downloadFeedingSchedulePdf);

router.get("/recipe/:recipeId", auth, downloadRecipePdf);

router.get("/grocery-list", auth, downloadGroceryPdf);

module.exports = router;
