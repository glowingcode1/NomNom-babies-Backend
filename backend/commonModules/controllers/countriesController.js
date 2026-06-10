const Country = require('@models/Country');
const { User } = require("@models/UserModel");
const { sendResponse, validateParams, parsePaginationParams, generateMeta } = require('@utils/responseUtil');

const getCountries = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);

  try {
    const [countries, totalCountries] = await Promise.all([
      Country.find({ isEnabled: true })
        .sort({ name: 1 })
        .select('name signatureFoods')
        .skip((page - 1) * limit)
        .limit(limit),
      Country.countDocuments({ isEnabled: true }),
    ]);

    const meta = generateMeta(page, limit, totalCountries);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: 'data_fetched_successfully',
      data: countries,
      meta,
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, translationKey: error.message, error });
  }
};

const getCountryById = async (req, res) => {
  try {
    const country = await Country.findById(req.params.id);

    if (!country) {
      return sendResponse({ res, statusCode: 404, translationKey: 'country_not_found' });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: 'data_fetched_successfully',
      data: country,
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, translationKey: error.message, error });
  }
};

// Select up to 2 countries (logged-in user)
const selectCountries = async (req, res) => {
  try {
    if (!validateParams(req, res, { rawData: ["countryIds"] })) return;

    const { countryIds } = req.body;

    // Must be an array
    if (!Array.isArray(countryIds)) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "country_ids_must_be_array",
      });
    }

    // Max 2 countries
    if (countryIds.length > 2) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "max_two_countries_allowed",
      });
    }

    // Validate all IDs are valid ObjectIds
    const mongoose = require("mongoose");
    const allValid = countryIds.every((id) => mongoose.Types.ObjectId.isValid(id));
    if (!allValid) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "invalid_country_id",
      });
    }

    // Ensure all countries exist and are enabled
    const countries = await Country.find({
      _id: { $in: countryIds },
      isEnabled: true,
    }).select("name signatureFoods");

    if (countries.length !== countryIds.length) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "country_not_found",
      });
    }

    // Save to user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { "onboarding.selectedCountries": countryIds },
      { new: true }
    ).populate("onboarding.selectedCountries", "name signatureFoods");

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "countries_selected_success",
      data: { onboarding: user.onboarding },
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


const createCountry = async (req, res) => {
  try {
    if (!validateParams(req, res, { rawData: ['name'] })) return;

    const { name, signatureFoods = [] } = req.body;

    const existing = await Country.findOne({ name: name.trim() });
    if (existing) {
      return sendResponse({ res, statusCode: 409, translationKey: 'country_already_exists' });
    }

    const country = await Country.create({
      name: name.trim(),
      signatureFoods,
    });

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: 'country_created',
      data: country,
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, translationKey: error.message, error });
  }
};

const updateCountry = async (req, res) => {
  try {
    const { name, signatureFoods, isEnabled } = req.body;

    if (name) {
      const clash = await Country.findOne({
        name: name.trim(),
        _id: { $ne: req.params.id },
      });
      if (clash) {
        return sendResponse({ res, statusCode: 409, translationKey: 'country_already_exists' });
      }
    }

    const country = await Country.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          ...(name !== undefined && { name: name.trim() }),
          ...(signatureFoods !== undefined && { signatureFoods }),
          ...(isEnabled !== undefined && { isEnabled }),
        },
      },
      { new: true, runValidators: true }
    );

    if (!country) {
      return sendResponse({ res, statusCode: 404, translationKey: 'country_not_found' });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: 'country_updated',
      data: country,
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, translationKey: error.message, error });
  }
};

const toggleCountry = async (req, res) => {
  try {
    const country = await Country.findById(req.params.id);

    if (!country) {
      return sendResponse({ res, statusCode: 404, translationKey: 'country_not_found' });
    }

    country.isEnabled = !country.isEnabled;
    await country.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: country.isEnabled ? 'country_enabled' : 'country_disabled',
      data: country,
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, translationKey: error.message, error });
  }
};

const deleteCountry = async (req, res) => {
  try {
    const country = await Country.findByIdAndDelete(req.params.id);

    if (!country) {
      return sendResponse({ res, statusCode: 404, translationKey: 'country_not_found' });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: 'country_deleted',
      data: { id: req.params.id },
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, translationKey: error.message, error });
  }
};

const adminGetCountries = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);

  try {
    const { search = '' } = req.query;

    const query = search ? { name: { $regex: search, $options: 'i' } } : {};

    const [countries, totalCountries] = await Promise.all([
      Country.find(query)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Country.countDocuments(query),
    ]);

    const meta = generateMeta(page, limit, totalCountries);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: 'data_fetched_successfully',
      data: countries,
      meta,
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, translationKey: error.message, error });
  }
};

module.exports = {
  getCountries,
  getCountryById,
  selectCountries,
  createCountry,
  updateCountry,
  toggleCountry,
  deleteCountry,
  adminGetCountries,
};