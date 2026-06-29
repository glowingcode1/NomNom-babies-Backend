const { User } = require("@models/UserModel");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");
const Recipe = require("@models/Recipe");
const Country = require("@models/Country");
const BabyStage = require("@models/BabyStage");
const NutritionTag = require("@models/Nutrition");
const SupportRequest = require("@models/SupportRequest");
const AdminActivity = require("@models/AdminActivity");

// Add or Update Document
const dashboard = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,

      totalCountries,
      activeCountries,

      totalRecipes,
      publishedRecipes,
      pendingRecipes,

      totalAgeGroups,
      activeAgeGroups,

      totalNutritionTags,

      openSupportTickets,

      totalDownloads,
    ] = await Promise.all([
      User.countDocuments({
        "accountState.UserType": { $ne: "admin" },
      }),

      User.countDocuments({
        "accountState.status": "active",
        "accountState.userType": { $ne: "admin" },
      }),

      Country.countDocuments(),

      Country.countDocuments({
        status: "active",
        isEnabled: true,
      }),

      Recipe.countDocuments(),

      Recipe.countDocuments({
        status: "published",
      }),

      Recipe.countDocuments({
        status: "pending",
      }),

      BabyStage.countDocuments(),
      BabyStage.countDocuments({
        active: true,
      }),

      NutritionTag.countDocuments(),

      SupportRequest.countDocuments({
        status: {
          $in: ["pending", "open"],
        },
      }),
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        widgets: {
          totalUsers,
          activeUsers,
          inactiveUsers,

          totalCountries,
          activeCountries,

          totalRecipes,
          publishedRecipes,
          pendingRecipes,

          totalAgeGroups,
          activeAgeGroups,

          totalNutritionTags,

          openSupportTickets,

          downloadedResources: totalDownloads,
        },
      },
    });
  } catch (error) {
    sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server_error",
      error: error.message,
    });
  }
};

const userStatusStats = async (req, res) => {
  try {
    const [active, suspended, inactive] = await Promise.all([
      User.countDocuments({
        "accountState.status": "active",
      }),

      User.countDocuments({
        "accountState.status": "suspended",
      }),

      User.countDocuments({
        "accountState.status": "inactive",
      }),
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      data: {
        active,
        suspended,
        inactive,
      },
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      error: error.message,
    });
  }
};

const platformHealth = async (req, res) => {
  try {
    const [
      totalCountries,
      activeCountries,

      totalAgeGroups,
      activeAgeGroups,

      totalRecipes,
      publishedRecipes,
    ] = await Promise.all([
      Country.countDocuments(),
      Country.countDocuments({ isActive: true }),

      BabyStage.countDocuments(),
      BabyStage.countDocuments({ isActive: true }),

      Recipe.countDocuments(),
      Recipe.countDocuments({
        status: "published",
      }),
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      data: {
        countriesRate:
          totalCountries > 0
            ? Math.round((activeCountries / totalCountries) * 100)
            : 0,

        ageGroupsRate:
          totalAgeGroups > 0
            ? Math.round((activeAgeGroups / totalAgeGroups) * 100)
            : 0,

        recipesRate:
          totalRecipes > 0
            ? Math.round((publishedRecipes / totalRecipes) * 100)
            : 0,
      },
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      error: error.message,
    });
  }
};

const topViewedRecipes = async (req, res) => {
  try {
    const recipes = await Recipe.find({
      status: "published",
    })
      .populate("country", "_id name")
      .sort({ views: -1 })
      .limit(10)
      .select("title mealType views");

    return sendResponse({
      res,
      statusCode: 200,
      data: recipes,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      error: error.message,
    });
  }
};

const topCountries = async (req, res) => {
  try {
    const countries = await User.aggregate([
      {
        $match: {
          "onboarding.selectedCountries.0": { $exists: true },
        },
      },

      {
        $unwind: "$onboarding.selectedCountries",
      },

      {
        $group: {
          _id: "$onboarding.selectedCountries",
          users: { $sum: 1 },
        },
      },

      {
        $sort: {
          users: -1,
        },
      },

      {
        $limit: 10,
      },

      {
        $lookup: {
          from: "countries",
          localField: "_id",
          foreignField: "_id",
          as: "country",
        },
      },

      {
        $unwind: "$country",
      },

      {
        $project: {
          _id: 0,
          countryId: "$country._id",
          name: "$country.name",
          flag: "$country.flag",
          users: 1,
        },
      },
    ]);

    const totalSelections = countries.reduce(
      (sum, item) => sum + item.users,
      0,
    );

    const result = countries.map((country) => ({
      ...country,
      selectionRate:
        totalSelections > 0
          ? Number(((country.users / totalSelections) * 100).toFixed(1))
          : 0,
    }));

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: result,
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

const recentActivities = async (req, res) => {
  try {
    const activities = await AdminActivity.find()
      .populate("user", "_id name email")
      .sort({ createdAt: -1 })
      .limit(10);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: activities,
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

const getUserStatsByRegion = async (req, res) => {
  try {
    const year = req.query.year
      ? parseInt(req.query.year, 10)
      : new Date().getFullYear();

    //validate year
    const validationOptions1 = {
      dateFields: {
        year: "YYYY",
      },
    };
    if (!validateParams(req, res, validationOptions1)) {
      return;
    }

    // Define a mapping for countries to regions (adjust this according to your actual data)
    const regionMapping = {
      Asia: [
        "Asia/Kabul",
        "Asia/Yerevan",
        "Asia/Baku",
        "Asia/Bahrain",
        "Asia/Dhaka",
        "Asia/Thimphu",
        "Asia/Brunei",
        "Asia/Phnom_Penh",
        "Asia/Shanghai",
        "Asia/Tbilisi",
        "Asia/Hong_Kong",
        "Asia/Kolkata",
        "Asia/Jakarta",
        "Asia/Tehran",
        "Asia/Baghdad",
        "Asia/Jerusalem",
        "Asia/Tokyo",
        "Asia/Amman",
        "Asia/Almaty",
        "Asia/Kuwait",
        "Asia/Bishkek",
        "Asia/Vientiane",
        "Asia/Beirut",
        "Asia/Macau",
        "Asia/Kuala_Lumpur",
        "Asia/Male",
        "Asia/Ulaanbaatar",
        "Asia/Yangon",
        "Asia/Kathmandu",
        "Asia/Pyongyang",
        "Asia/Muscat",
        "Asia/Karachi",
        "Asia/Gaza",
        "Asia/Manila",
        "Asia/Qatar",
        "Asia/Riyadh",
        "Asia/Singapore",
        "Asia/Seoul",
        "Asia/Colombo",
        "Asia/Damascus",
        "Asia/Taipei",
        "Asia/Dushanbe",
        "Asia/Bangkok",
        "Asia/Dili",
        "Asia/Istanbul",
        "Asia/Ashgabat",
        "Asia/Dubai",
        "Asia/Tashkent",
        "Asia/Ho_Chi_Minh",
        "Asia/Aden",
      ],
      Europe: [
        "Europe/Mariehamn",
        "Europe/Tirane",
        "Europe/Andorra",
        "Europe/Vienna",
        "Europe/Minsk",
        "Europe/Brussels",
        "Europe/Sarajevo",
        "Europe/Sofia",
        "Europe/Zagreb",
        "Europe/Nicosia",
        "Europe/Prague",
        "Europe/Copenhagen",
        "Europe/Tallinn",
        "Europe/Torshavn",
        "Europe/Helsinki",
        "Europe/Paris",
        "Europe/Berlin",
        "Europe/Gibraltar",
        "Europe/Athens",
        "Europe/Guernsey",
        "Europe/Budapest",
        "Europe/Reykjavik",
        "Europe/Dublin",
        "Europe/Rome",
        "Europe/Jersey",
        "Europe/Pristina",
        "Europe/Riga",
        "Europe/Vaduz",
        "Europe/Vilnius",
        "Europe/Luxembourg",
        "Europe/Valletta",
        "Europe/Isle_of_Man",
        "Europe/Chisinau",
        "Europe/Monaco",
        "Europe/Podgorica",
        "Europe/Amsterdam",
        "Europe/Skopje",
        "Europe/Oslo",
        "Europe/Warsaw",
        "Europe/Lisbon",
        "Europe/Bucharest",
        "Europe/Moscow",
        "Europe/San_Marino",
        "Europe/Belgrade",
        "Europe/Bratislava",
        "Europe/Ljubljana",
        "Europe/Madrid",
        "Europe/Longyearbyen",
        "Europe/Stockholm",
        "Europe/Zurich",
        "Europe/Kiev",
        "Europe/London",
        "Europe/Vatican",
      ],
      Africa: [
        "Africa/Algiers",
        "Africa/Luanda",
        "Africa/Porto-Novo",
        "Africa/Gaborone",
        "Indian/Chagos",
        "Africa/Ouagadougou",
        "Africa/Bujumbura",
        "Africa/Douala",
        "Atlantic/Cape_Verde",
        "Africa/Bangui",
        "Africa/Ndjamena",
        "Indian/Comoro",
        "Africa/Brazzaville",
        "Africa/Abidjan",
        "Africa/Kinshasa",
        "Africa/Djibouti",
        "Africa/Cairo",
        "Africa/Malabo",
        "Africa/Asmara",
        "Africa/Mbabane",
        "Africa/Addis_Ababa",
        "Indian/Mayotte",
        "Africa/Libreville",
        "Africa/Banjul",
        "Africa/Accra",
        "Africa/Conakry",
        "Africa/Bissau",
        "Africa/Nairobi",
        "Africa/Maseru",
        "Africa/Monrovia",
        "Africa/Tripoli",
        "Indian/Antananarivo",
        "Africa/Blantyre",
        "Africa/Bamako",
        "Africa/Nouakchott",
        "Indian/Mauritius",
        "Indian/Mayotte",
        "Africa/Casablanca",
        "Africa/Maputo",
        "Africa/Windhoek",
        "Africa/Niamey",
        "Africa/Lagos",
        "Indian/Reunion",
        "Africa/Kigali",
        "Atlantic/St_Helena",
        "Africa/Sao_Tome",
        "Africa/Dakar",
        "Indian/Mahe",
        "Africa/Freetown",
        "Africa/Mogadishu",
        "Africa/Johannesburg",
        "Africa/Juba",
        "Africa/Khartoum",
        "Africa/Dar_es_Salaam",
        "Africa/Lome",
        "Africa/Tunis",
        "Africa/Kampala",
        "Africa/El_Aaiun",
        "Africa/Lusaka",
        "Africa/Harare",
      ],
      Oceania: [
        "Pacific/Pago_Pago",
        "Australia/Sydney",
        "Indian/Christmas",
        "Indian/Cocos",
        "Pacific/Rarotonga",
        "Pacific/Fiji",
        "Pacific/Tahiti",
        "Pacific/Guam",
        "Pacific/Tarawa",
        "Pacific/Majuro",
        "Pacific/Pohnpei",
        "Pacific/Nauru",
        "Pacific/Noumea",
        "Pacific/Auckland",
        "Pacific/Niue",
        "Pacific/Norfolk",
        "Pacific/Saipan",
        "Pacific/Ngerulmud",
        "Pacific/Port_Moresby",
        "Pacific/Pitcairn",
        "Pacific/Apia",
        "Pacific/Honiara",
        "Pacific/Fakaofo",
        "Pacific/Tongatapu",
        "Pacific/Funafuti",
        "Pacific/Efate",
        "Pacific/Wallis",
      ],
      Americas: [
        "America/Anguilla",
        "America/Antigua",
        "America/Argentina/Buenos_Aires",
        "America/Aruba",
        "America/Barbados",
        "America/Belize",
        "Atlantic/Bermuda",
        "America/La_Paz",
        "America/Kralendijk",
        "America/Sao_Paulo",
        "America/Toronto",
        "America/Cayman",
        "America/Santiago",
        "America/Bogota",
        "America/Costa_Rica",
        "America/Havana",
        "America/Curacao",
        "America/Dominica",
        "America/Santo_Domingo",
        "America/Guayaquil",
        "America/El_Salvador",
        "Atlantic/Stanley",
        "America/Cayenne",
        "America/Godthab",
        "America/Grenada",
        "America/Guadeloupe",
        "America/Guatemala",
        "America/Guyana",
        "America/Port-au-Prince",
        "America/Tegucigalpa",
        "America/Jamaica",
        "America/Martinique",
        "America/Mexico_City",
        "America/Montserrat",
        "America/Managua",
        "America/Panama",
        "America/Asuncion",
        "America/Lima",
        "America/Puerto_Rico",
        "America/St_Kitts",
        "America/St_Lucia",
        "America/Miquelon",
        "America/St_Vincent",
        "America/St_Barthelemy",
        "America/Marigot",
        "America/Lower_Princes",
        "Atlantic/South_Georgia",
        "America/Paramaribo",
        "America/Nassau",
        "America/Port_of_Spain",
        "America/Grand_Turk",
        "America/New_York",
        "America/Adak",
        "America/Montevideo",
        "America/Caracas",
        "America/Tortola",
        "America/St_Thomas",
      ],
      Polar: ["Antarctica/McMurdo"],
      Unknown: ["Etc/GMT+2", "Etc/GMT+3"],
    };

    // Create branches dynamically from regionMapping
    const branches = Object.keys(regionMapping).map((region) => ({
      case: {
        $in: ["$timezone", regionMapping[region]],
      },
      then: region,
    }));

    // MongoDB aggregation pipeline
    const pipeline = [
      {
        $match: {
          "accountState.status": "active", // Only consider active users
          createdAt: {
            $gte: new Date(`${year}-01-01T00:00:00.000Z`),
            $lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
          },
        },
      },
      {
        $addFields: {
          region: {
            $switch: {
              branches: branches,
              default: "Other", // Default case if the country doesn't match
            },
          },
        },
      },
      {
        $group: {
          _id: {
            region: "$region",
            month: { $month: "$createdAt" },
          },
          userCount: { $sum: 1 }, // Count users for each month and region
        },
      },
      {
        $group: {
          _id: "$_id.region",
          monthlyData: {
            $push: {
              month: "$_id.month",
              count: "$userCount",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          region: "$_id",
          monthlyData: {
            $map: {
              input: { $range: [1, 13] }, // Ensure data for all 12 months (Jan to Dec)
              as: "month",
              in: {
                month: "$$month",
                count: {
                  $reduce: {
                    input: {
                      $filter: {
                        input: "$monthlyData",
                        as: "data",
                        cond: { $eq: ["$$data.month", "$$month"] },
                      },
                    },
                    initialValue: 0,
                    in: { $add: ["$$value", "$$this.count"] }, // If no users for the month, default to 0
                  },
                },
              },
            },
          },
        },
      },
    ];

    const [userStatsResult, availableYearsResult] = await Promise.allSettled([
      User.aggregate(pipeline),
      User.distinct("createdAt").then((dates) => {
        return [...new Set(dates.map((date) => new Date(date).getFullYear()))];
      }),
    ]);

    const userStats =
      userStatsResult.status === "fulfilled" ? userStatsResult.value : [];
    const availableYears =
      availableYearsResult.status === "fulfilled"
        ? availableYearsResult.value
        : [];
    // Format the data for charting
    const formattedData = userStats.map((regionData) => {
      const region = regionData.region;
      const monthlyData = regionData.monthlyData.map((data) => data.count);

      return { region: region, data: monthlyData };
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "User stats fetched successfully",
      data: {
        stats: formattedData,
        months: [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ],
        year,
        availableYears,
      },
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error,
    });
  }
};

const topRatedUsers = async (req, res) => {
  try {
    const reviews = await Review.find({ reviewType: "user" })
      .populate({
        path: "object",
        model: "User",
        select: "_id name email profileIcon",
      })
      .sort({ rating: -1 })
      .limit(10);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Top rated users fetched successfully",
      data: reviews,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error,
    });
  }
};

const allUsers = async (req, res) => {
  try {
    const { page, limit } = parsePaginationParams(req);
    const { status } = req.query;
    const { keyword } = req.query; // Get keyword from query

    // Initialize query object with base condition
    let queryConditions = {
      "accountState.status": { $in: ["active", "inactive"] },
      "accountState.userType": { $ne: "admin" },
    };
    const query = status ? { "accountState.status": status } : {};
    Object.assign(queryConditions, query);

    // Apply keyword search on both `name` and `anonymousName` if keyword is provided
    if (keyword && keyword.trim() !== "") {
      queryConditions.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { email: { $regex: keyword, $options: "i" } },
        { phoneNumber: { $regex: keyword, $options: "i" } },
      ];
    }

    const [
      users,
      totalRecords,
      allUsers,
      allActiveUsers,
      allInactiveUsers,
      allSuspendedUsers,
    ] = await Promise.all([
      User.find(queryConditions)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("name email profileIcon accountState.status phoneNumber"),
      User.countDocuments(queryConditions),
      User.countDocuments({
        "accountState.status": { $in: ["active", "inactive", "suspended"] },
        "accountState.userType": { $ne: "admin" },
      }),
      User.countDocuments({
        "accountState.status": "active",
        "accountState.userType": { $ne: "admin" },
      }),
      User.countDocuments({
        "accountState.status": "inactive",
        "accountState.userType": { $ne: "admin" },
      }),
      User.countDocuments({
        "accountState.status": "suspended",
        "accountState.userType": { $ne: "admin" },
      }),
    ]);

    let meta = generateMeta(page, limit, totalRecords);
    // Send response with users data
    //append allusers in meta response
    meta.usersCount = {
      total: allUsers,
      active: allActiveUsers,
      inactive: allInactiveUsers,
      suspended: allSuspendedUsers,
    };

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Users fetched successfully",
      data: users,
      meta,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "something_went_wrong",
      error,
    });
  }
};

// Get all support requests (Admin)
const getSupportRequests = async (req, res) => {
  try {
    const { keyword, status } = req.query; // Get keyword from query
    let applyLimit = true;
    if (req.query.limit == undefined) {
      applyLimit = false;
    }

    const { page, limit } = parsePaginationParams(req);

    let queryConditions = {};
    if (status) {
      queryConditions.status = status;
    }
    // If a keyword is provided, apply a search filter on multiple fields
    if (keyword) {
      queryConditions.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { email: { $regex: keyword, $options: "i" } },
        { subject: { $regex: keyword, $options: "i" } },
        { message: { $regex: keyword, $options: "i" } },
      ];
    }
    const [
      supportRequests,
      totalRecords,
      totalPending,
      totalResponded,
      totalResolved,
      totalClosed,
      totalDocs,
    ] = await Promise.all([
      SupportRequest.find(queryConditions)
        .sort({ createdAt: -1 })
        .skip(applyLimit ? (page - 1) * limit : 0)
        .limit(applyLimit ? limit : 0),
      SupportRequest.countDocuments(queryConditions),
      SupportRequest.countDocuments({ status: "pending" }),
      SupportRequest.countDocuments({ status: "responded" }),
      SupportRequest.countDocuments({ status: "resolved" }),
      SupportRequest.countDocuments({ status: "closed" }),
      SupportRequest.countDocuments(),
    ]);

    let meta = generateMeta(page, limit, totalRecords);
    meta.requestsCount = {
      totalDocs,
      totalPending,
      totalResponded,
      totalResolved,
      totalClosed,
    };

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "support_requests",
      data: supportRequests,
      meta,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Update support request status (Admin)
const updateSupportRequestStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validationOptions = {
    pathParams: ["id"],
    rawData: ["status"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return; // Invalid request data response already sent by validateParams
  }

  try {
    const supportRequest = await SupportRequest.findById(id);
    if (!supportRequest) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "support_request_1",
      });
    }

    supportRequest.status = status;
    await supportRequest.save();
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "support_request_2",
      data: supportRequest,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Delete support request (Admin)
const deleteSupportRequest = async (req, res) => {
  const { id } = req.params;

  const validationOptions = {
    pathParams: ["id"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return; // Invalid request data response already sent by validateParams
  }

  try {
    const supportRequest = await SupportRequest.findById(id);
    if (!supportRequest) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "support_request_1",
      });
    }

    await supportRequest.deleteOne();
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "support_request_3",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Get all contact requests (Admin)
const getContactRequests = async (req, res) => {
  try {
    let applyLimit = true;
    if (req.query.limit == undefined) {
      applyLimit = false;
    }
    const { page, limit } = parsePaginationParams(req);
    const { keyword, status } = req.query; // Get keyword from query

    // Initialize the query conditions
    let queryConditions = {};
    if (status) {
      queryConditions.status = status;
    }

    // If a keyword is provided, apply a search filter on multiple fields
    if (keyword) {
      queryConditions.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { email: { $regex: keyword, $options: "i" } },
        { phoneNumber: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
      ];
    }
    // enum: ['pending', 'responded', 'resolved', 'closed'],
    const [
      contactRequests,
      totalRecords,
      totalPending,
      totalResponded,
      totalResolved,
      totalClosed,
      totalDocs,
    ] = await Promise.all([
      ContactUs.find(queryConditions)
        .sort({ createdAt: -1 })
        .skip(applyLimit ? (page - 1) * limit : 0)
        .limit(applyLimit ? limit : 0),
      ContactUs.countDocuments(queryConditions),
      ContactUs.countDocuments({ status: "pending" }),
      ContactUs.countDocuments({ status: "responded" }),
      ContactUs.countDocuments({ status: "resolved" }),
      ContactUs.countDocuments({ status: "closed" }),
      ContactUs.countDocuments(),
    ]);
    // Calculate pagination meta

    let meta = generateMeta(page, limit, totalRecords);

    meta.requestsCount = {
      totalDocs: totalDocs,
      pending: totalPending,
      responded: totalResponded,
      resolved: totalResolved,
      closed: totalClosed,
    };

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "contact_requests",
      data: contactRequests,
      meta,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Update contact request status (Admin)
const updateContactRequestStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validationOptions = {
    pathParams: ["id"],
    rawData: ["status"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    const contactRequest = await ContactUs.findById(id);
    if (!contactRequest) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "contact_request_1",
      });
    }

    contactRequest.status = status;
    await contactRequest.save();
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "contact_request_2",
      data: contactRequest,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Delete contact request (Admin)
const deleteContactRequest = async (req, res) => {
  const { id } = req.params;

  try {
    const validationOptions = {
      pathParams: ["id"],
      objectIdFields: ["id"],
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }
    const contactRequest = await ContactUs.findById(id);
    if (!contactRequest) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "contact_request_1",
      });
    }

    await contactRequest.deleteOne();
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "contact_request_3",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

//faqs crud
const getFaqs = async (req, res) => {
  try {
    const { page, limit } = parsePaginationParams(req);
    const { keyword } = req.query; // Get keyword from query

    // Initialize query object with base condition
    let queryConditions = {};
    // Apply keyword search on both `name` and `anonymousName` if keyword is provided
    if (keyword && keyword.trim() !== "") {
      queryConditions.$or = [
        { question: { $regex: keyword, $options: "i" } },
        { answer: { $regex: keyword, $options: "i" } },
      ];
    }

    const [faqs, totalRecords] = await Promise.all([
      Faq.find(queryConditions)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Faq.countDocuments(queryConditions),
    ]);

    let meta = generateMeta(page, limit, totalRecords);
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Faqs fetched successfully",
      data: faqs,
      meta,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "something_went_wrong",
      error,
    });
  }
};

const createFaq = async (req, res) => {
  try {
    const { question, answer } = req.body;

    //validate params
    const validationOptions = {
      rawData: ["question", "answer"],
    };
    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    const faq = new Faq({
      question,
      answer,
    });
    await faq.save();
    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "Faq created successfully",
      data: faq,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "something_went_wrong",
      error,
    });
  }
};

const updateFaq = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer } = req.body;
    //validate params
    const validationOptions = {
      rawData: ["question", "answer"],
    };
    if (!validateParams(req, res, validationOptions)) {
      return;
    }
    const faq = await Faq.findById(id);
    if (!faq) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "Faq not found",
      });
    }
    faq.question = question;
    faq.answer = answer;
    await faq.save();
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Faq updated successfully",
      data: faq,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "something_went_wrong",
      error,
    });
  }
};

const deleteFaq = async (req, res) => {
  try {
    const { id } = req.params;
    //validate params
    const validationOptions = {
      pathParams: ["id"],
      objectIdFields: ["id"],
    };
    if (!validateParams(req, res, validationOptions)) {
      return;
    }
    const faq = await Faq.findById(id);
    if (!faq) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "Faq not found",
      });
    }
    await faq.deleteOne();
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Faq deleted successfully",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "something_went_wrong",
      error,
    });
  }
};

//update user account state
const updateUserAccountState = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    const validationOptions = {
      pathParams: ["userId"],
      objectIdFields: ["userId"],
      rawData: ["status"],
      enumFields: {
        status: [
          "active",
          "inactive",
          "suspended",
          "softDeleted",
          "hardDeleted",
          "restricted",
        ],
      },
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_not",
      });
    }

    user.accountState.status = status;
    await user.save();
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "user_account_state_updated",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "something_went_wrong",
      error,
    });
  }
};

module.exports = {
  dashboard,
  getUserStatsByRegion,
  topRatedUsers,
  allUsers,
  getSupportRequests,
  updateSupportRequestStatus,
  deleteSupportRequest,
  getContactRequests,
  updateContactRequestStatus,
  deleteContactRequest,
  getFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  updateUserAccountState,
  userStatusStats,
  platformHealth,
  topCountries,
  topViewedRecipes,
  recentActivities,
};
