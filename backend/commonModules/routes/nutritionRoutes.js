const express = require("express");
const auth = require("../../middlewares/authMiddleware");
const { authorizeRoles } = require("../../middlewares/roleMiddleware");
const createRateLimiter = require("@utils/rateLimiter");

const {
  getNutritionByRecipe,
  adminGetNutritions,
  adminGetNutritionById,
  createNutrition,
  updateNutrition,
  deleteNutrition,
} = require("../controllers/nutritionController");

const router = express.Router();

const createNutritionRateLimiter = createRateLimiter("createNutrition", 15, 15);
const updateNutritionRateLimiter = createRateLimiter("updateNutrition", 15, 15);
const deleteNutritionRateLimiter = createRateLimiter("deleteNutrition", 15, 15);

// ─── PUBLIC (logged-in users) ─────────────────────────────────────────────────

router.get("/recipe/:recipeId", auth, getNutritionByRecipe);

// ─── CONTENT ADMIN + SUPER ADMIN ─────────────────────────────────────────────

router.get("/admin/all", auth, /**authorizeRoles("contentAdmin", "superAdmin"),**/ adminGetNutritions);
router.get("/admin/:id", auth, /**authorizeRoles("contentAdmin", "superAdmin"),**/ adminGetNutritionById);
router.post("/", auth, /**authorizeRoles("contentAdmin", "superAdmin"),**/ createNutritionRateLimiter, createNutrition);
router.put("/:id", auth, /**authorizeRoles("contentAdmin", "superAdmin"),**/ updateNutritionRateLimiter, updateNutrition);

// ─── SUPER ADMIN ONLY ─────────────────────────────────────────────────────────

router.delete("/:id", auth, /**authorizeRoles("superAdmin"),**/ deleteNutritionRateLimiter, deleteNutrition);

module.exports = router;