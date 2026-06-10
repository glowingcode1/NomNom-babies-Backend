const express = require("express");
const auth = require("../../middlewares/authMiddleware");
const { authorizeRoles } = require("../../middlewares/roleMiddleware");
const createRateLimiter = require("@utils/rateLimiter");

const {
  getCountries,
  getCountryById,
  createCountry,
  updateCountry,
  toggleCountry,
  deleteCountry,
  adminGetCountries,
} = require("../controllers/countriesController");

const router = express.Router();

// Define rate limiters
const createCountryRateLimiter = createRateLimiter("createCountry", 15, 15); // 15 requests per 15 minutes
const updateCountryRateLimiter = createRateLimiter("updateCountry", 15, 15); // 15 requests per 15 minutes
const deleteCountryRateLimiter = createRateLimiter("deleteCountry", 15, 15); // 15 requests per 15 minutes

// ─── PUBLIC (any logged-in user) ─────────────────────────────────────────────
router.get("/", auth, getCountries);
router.get("/:id", auth, getCountryById);

// ─── CONTENT ADMIN + SUPER ADMIN ─────────────────────────────────────────────
router.get("/admin/all", auth, /**authorizeRoles("contentAdmin", "superAdmin"),**/ adminGetCountries);
router.post("/", auth, /**authorizeRoles("contentAdmin", "superAdmin"),**/ createCountryRateLimiter, createCountry);
router.put("/:id", auth, /**authorizeRoles("contentAdmin", "superAdmin"),**/ updateCountryRateLimiter, updateCountry);
router.patch("/:id/toggle", auth, /**authorizeRoles("contentAdmin", "superAdmin"),**/ toggleCountry);

// ─── SUPER ADMIN ONLY ─────────────────────────────────────────────────────────
router.delete("/:id", auth, /**authorizeRoles("superAdmin"),**/ deleteCountryRateLimiter, deleteCountry);

module.exports = router;