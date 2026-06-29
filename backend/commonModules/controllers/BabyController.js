const Baby = require("@models/Baby");
const BabyStage = require("@models/BabyStage");
const Country = require("@models/Country");
const { User } = require("@models/UserModel");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");

// Create a new baby profile
const createBaby = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        rawData: ["name", "stageId", "selectedCountries"],
      })
    )
      return;

    const { profileIcon, name, stageId, selectedCountries = [] } = req.body;

    // Validate stage if provided
    if (stageId) {
      const stage = await BabyStage.findOne({ _id: stageId, active: true });
      if (!stage) {
        return sendResponse({
          res,
          statusCode: 404,
          translationKey: "baby_stage_not_found",
        });
      }
    }

    // Get user and onboarding countries
    const user = await User.findById(req.user._id);

    const finalCountries =
      selectedCountries.length > 0
        ? selectedCountries
        : user.onboarding?.selectedCountries || [];

    // Validate countries
    if (finalCountries.length > 2) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "max_two_countries_allowed",
      });
    }

    if (finalCountries.length > 0) {
      const countries = await Country.find({
        _id: { $in: finalCountries },
        isEnabled: true,
      });

      if (countries.length !== finalCountries.length) {
        return sendResponse({
          res,
          statusCode: 404,
          translationKey: "country_not_found",
        });
      }
    }

    const baby = new Baby({
      user: req.user._id,
      profileIcon,
      name: name.trim(),
      babyStage: stageId || null,
      selectedCountries: finalCountries,
    });

    await baby.validate();
    await baby.save();

    user.activeBaby = baby._id;
    await user.save();

    await baby.populate([
      { path: "babyStage", select: "title features" },
      { path: "selectedCountries", select: "name signatureFoods" },
    ]);

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "baby_created_success",
      data: baby,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// Get all babies for logged-in user
const getBabies = async (req, res) => {
  try {
    const babies = await Baby.find({ user: req.user._id, isActive: true })
      .populate("babyStage", "title features")
      .populate("selectedCountries", "name signatureFoods")
      .sort({ createdAt: 1 });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: babies,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

const getUserBabies = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_not_found",
      });
    }

    const babies = await Baby.find({
      user: id,
      isActive: true,
    })
      .populate("babyStage", "title features")
      .populate("selectedCountries", "name signatureFoods")
      .sort({ createdAt: 1 });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: babies,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// Get a single baby by ID
const getBabyById = async (req, res) => {
  try {
    if (
      !validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })
    )
      return;

    const baby = await Baby.findOne({
      _id: req.params.id,
      user: req.user._id,
      isActive: true,
    })
      .populate("babyStage", "title features")
      .populate("selectedCountries", "name signatureFoods");

    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: baby,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// Update a baby profile (name, stage, countries)
const updateBaby = async (req, res) => {
  try {
    if (
      !validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })
    )
      return;

    const { profileIcon, name, stageId, countryIds } = req.body;

    const baby = await Baby.findOne({
      _id: req.params.id,
      user: req.user._id,
      isActive: true,
    });
    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    if (profileIcon !== undefined) {
      baby.profileIcon = profileIcon;
    }

    if (name) baby.name = name.trim();

    if (stageId !== undefined) {
      if (stageId) {
        const stage = await BabyStage.findOne({ _id: stageId, active: true });
        if (!stage) {
          return sendResponse({
            res,
            statusCode: 404,
            translationKey: "baby_stage_not_found",
          });
        }
      }
      baby.babyStage = stageId || null;
    }

    if (countryIds !== undefined) {
      if (countryIds.length > 2) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "max_two_countries_allowed",
        });
      }
      if (countryIds.length > 0) {
        const countries = await Country.find({
          _id: { $in: countryIds },
          isEnabled: true,
        });
        if (countries.length !== countryIds.length) {
          return sendResponse({
            res,
            statusCode: 404,
            translationKey: "country_not_found",
          });
        }
      }
      baby.selectedCountries = countryIds;
    }

    await baby.save();
    await baby.populate([
      { path: "babyStage", select: "title features" },
      { path: "selectedCountries", select: "name signatureFoods" },
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "baby_updated_success",
      data: baby,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// Delete a baby profile (soft delete)
const deleteBaby = async (req, res) => {
  try {
    if (
      !validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })
    )
      return;

    const baby = await Baby.findOne({ _id: req.params.id, user: req.user._id });
    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    baby.isActive = false;
    await baby.save();

    // If deleted baby was the active one, switch to another
    const user = await User.findById(req.user._id);
    if (String(user.activeBaby) === String(baby._id)) {
      const nextBaby = await Baby.findOne({
        user: req.user._id,
        isActive: true,
      });
      user.activeBaby = nextBaby ? nextBaby._id : null;
      await user.save();
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "baby_deleted_success",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

// Switch active baby
const switchActiveBaby = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        rawData: ["babyId"],
        objectIdFields: ["babyId"],
      })
    )
      return;

    const { babyId } = req.body;

    const baby = await Baby.findOne({
      _id: babyId,
      user: req.user._id,
      isActive: true,
    });
    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    await User.findByIdAndUpdate(req.user._id, { activeBaby: baby._id });

    await baby.populate([
      {
        path: "babyStage",
        select: "title",
      },
      {
        path: "selectedCountries",
        select: "name",
      },
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "active_baby_switched_success",
      data: {
        activeBaby: {
          _id: baby._id,
          name: baby.name,
          profileIcon: baby.profileIcon,
          stage: baby.babyStage?.title,
          countries: baby.selectedCountries.map((c) => c.name),
        },
      },
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

module.exports = {
  createBaby,
  getBabies,
  getUserBabies,
  getBabyById,
  updateBaby,
  deleteBaby,
  switchActiveBaby,
};
