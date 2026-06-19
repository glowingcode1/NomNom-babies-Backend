const express = require("express");
const auth = require("../../middlewares/authMiddleware");
const { authorizeRoles } = require("../../middlewares/roleMiddleware");
const createRateLimiter = require("@utils/rateLimiter");

const {
  getRecipes,
  getRecipeById,
  adminGetRecipes,
  createRecipe,
  updateRecipe,
  updateRecipeStatus,
  deleteRecipe,
  getUserRecipes,
  getUserBabyRecipes,
} = require("../controllers/RecipeController");

const router = express.Router();

const createRecipeRateLimiter = createRateLimiter("createRecipe", 15, 15);
const updateRecipeRateLimiter = createRateLimiter("updateRecipe", 15, 15);
const deleteRecipeRateLimiter = createRateLimiter("deleteRecipe", 15, 15);

// PUBLIC (logged-in users)
router.get("/", auth, getRecipes);
router.get("/admin/users/:userId", auth, getUserRecipes);
router.get("/admin/users/:userId/baby/:babyId", auth, getUserBabyRecipes);
router.get("/:id", auth, getRecipeById);

// CONTENT ADMIN + SUPER ADMIN
router.get(
  "/admin/all",
  auth,
  /**authorizeRoles("contentAdmin", "superAdmin"),**/ adminGetRecipes,
);
router.post(
  "/",
  auth,
  /**authorizeRoles("contentAdmin", "superAdmin"),**/ createRecipeRateLimiter,
  createRecipe,
);
router.put(
  "/:id",
  auth,
  /**authorizeRoles("contentAdmin", "superAdmin"),**/ updateRecipeRateLimiter,
  updateRecipe,
);
router.patch(
  "/:id/status",
  auth,
  /**authorizeRoles("contentAdmin", "superAdmin", "nutritionReviewer"),**/ updateRecipeStatus,
);

// SUPER ADMIN ONLY
router.delete(
  "/:id",
  auth,
  /**authorizeRoles("superAdmin"),**/ deleteRecipeRateLimiter,
  deleteRecipe,
);

module.exports = router;
