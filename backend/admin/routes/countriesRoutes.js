const express = require("express");

const auth = require("@middlewares/authMiddleware");
const createRateLimiter = require("@utils/rateLimiter");
const roleMiddleware = require("@middlewares/roleMiddleware");
const {
  adminGetCountries,
  createCountry,
  updateCountry,
  deleteCountry,
} = require("@controllersCommonModules/countriesController");

const router = express.Router();

const createCountryRateLimiter = createRateLimiter("createCountry");
const updateCountryRateLimiter = createRateLimiter("updateCountry");
const deleteCountryRateLimiter = createRateLimiter("deleteCountry");

router.get("/", auth, roleMiddleware(["admin"]), adminGetCountries);

router.post(
  "/",
  auth,
  roleMiddleware(["admin"]),
  createCountryRateLimiter,
  createCountry,
);

router.put(
  "/:id",
  auth,
  roleMiddleware(["admin"]),
  updateCountryRateLimiter,
  updateCountry,
);

router.delete(
  "/:id",
  auth,
  roleMiddleware(["admin"]),
  deleteCountryRateLimiter,
  deleteCountry,
);

module.exports = router;
