const { User, generateResetToken } = require("@models/UserModel");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const { sendResponse, validateParams } = require("@utils/responseUtil");
const { formatUserResponse } = require("@utils/userResponseUtil");
const { sendEmailViaBrevo } = require("@utils/emailUtil");
const {
  registrationOtpEmailTemplate,
  forgotPasswordOtpEmailTemplate,
} = require("@utils/emailTemplates");
const { createOrSkipDevice, Devices } = require("@models/Devices");
const validator = require("validator");
const APP_ROLES = [
  "guest",
  "parent",
  "premium",
  "contentAdmin",
  "nutritionReviewer",
  "superAdmin",
];
const STAFF_ROLES = ["contentAdmin", "nutritionReviewer", "superAdmin"];

const normalizeRole = (role) => {
  if (!role) {
    return "parent";
  }

  const normalizedRole = String(role).trim();
  return APP_ROLES.includes(normalizedRole) ? normalizedRole : "parent";
};

const canAssignStaffRole = (req) => {
  const adminToken = req.header("x-admin-access-token");
  return adminToken && adminToken === process.env.ADMIN_ACCESS_TOKEN;
};

const getFormattedUserResponse = async (user, token = null) => {
  const refreshedUser = await User.findById(user._id);
  return formatUserResponse(refreshedUser || user, token);
};
//register
const register = async (req, res) => {
  try {
    const validationOptions = {
      rawData: [
        "name",
        "email",
        "password",
        "timezone",
      ],
      minLengthFields: {
        password: 6, // Password must be at least 6 characters long
      },
    };
    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    const {
      email,
      name,
      password,
      timezone,
      language = "en",
      role,
      profileIcon = "",
      phoneNumber = "",
    } = req.body;

    if (!validator.isEmail(String(email || "").trim())) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "email_invalid",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return sendResponse({
        res,
        statusCode: 409,
        translationKey: "email_already",
      });
    }

    const requestedRole = normalizeRole(role);
    const assignedRole = STAFF_ROLES.includes(requestedRole)
      ? canAssignStaffRole(req)
        ? requestedRole
        : "parent"
      : requestedRole;

    const user = await User.create({
      email: normalizedEmail,
      name,
      password,
      phoneNumber,
      profileIcon,
      timezone,
      language,
      verificationStatus: {
        email: "verified",
        phoneNumber: phoneNumber ? "pending" : "pending",
      },
      accountState: {
        userType: assignedRole,
        status: "active",
      },
    });

    const token = user.generateAuthToken();
    const response = await getFormattedUserResponse(user, token);

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "signup_successful",
      data: response,
    });
  } catch (error) {
    const statusCode = error.name === "ValidationError" ? 400 : 500;
    const translationKey =
      error.name === "ValidationError"
        ? Object.values(error.errors)[0].message
        : error.message;

    return sendResponse({
      res,
      statusCode,
      translationKey,
      error,
    });
  }
};

//login

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const validationOptions = {
      rawData: ["email", "password"],
    };
    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    const user = await User.findByCredentials(email, password);

    // Check if an error occurred
    if (user.error) {
      if (user.error === "user_not_found") {
        return sendResponse({
          res,
          statusCode: 404,
          translationKey: "user_not_found", // Use your translation key for user not found
        });
      } else if (user.error === "incorrect_password") {
        return sendResponse({
          res,
          statusCode: 401,
          translationKey: "incorrect_password", // Use your translation key for incorrect password
        });
      }
    }

    if (
      user.accountState.status === "restricted" ||
      user.accountState.status === "suspended"
    ) {
      return sendResponse({
        res,
        statusCode: 403,
        translationKey: "your_account_2",
      });
    }

    const token = user.generateAuthToken();

    // Format the user response using the utility function
    const response = formatUserResponse(user, token, [], ["resetToken"]);

    // Send successful response with token and user data
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "login_success",
      data: response,
    });
  } catch (error) {
    console.log("error:", error);
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: error,
    });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_not",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: formatUserResponse(user),
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

// Generate OTP
const generateOtp = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { email, phoneNumber, type } = req.body;
    const validationOptions = {
      rawData: [type === "email" ? "email" : "phoneNumber"],
    };
    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    // Validate phone number format
    if (
      type === "phoneNumber" &&
      phoneNumber &&
      !validator.isMobilePhone(phoneNumber, "any", { strictMode: true })
    ) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "invalid_phone",
      });
    }

    let user;
    if (type === "email") {
      user = await User.findOne({ email: email.toLowerCase() }).select(
        "email accountState otpInfo"
      );
    } else if (type === "phoneNumber") {
      user = await User.findOne({ phoneNumber }).select(
        "phoneNumber accountState otpInfo"
      );
    }

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_not",
      });
    }

    // Check if account is restricted
    if (["restricted", "suspended"].includes(user.accountState.status)) {
      return sendResponse({
        res,
        statusCode: 403,
        translationKey: "your_account_4",
      });
    }

    const otp = user.generateOtp(type, user.timezone);

    if (otp.error) {
      if (otp.error === "too_many_otp_requests") {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "too_many_otp_requests",
        });
      }
    }

    await user.save({ session });

    // Send email or SMS within the transaction
    const subject = "Password Reset OTP";
    const mBody = forgotPasswordOtpEmailTemplate(otp);
    //await sendEmailViaBrevo([email], subject, mBody);

    await session.commitTransaction();
    session.endSession();

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "otp_generated",
      data: { otp },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error: error,
    });
  }
};

//Verify otp
const verifyOtp = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { email, phoneNumber, type, otp } = req.body;
    const validationOptions = {
      rawData: [type === "email" ? "email" : "phoneNumber"],
    };
    if (type === "email") {
      validationOptions.rawData.push("otp");
    }
    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    // Validate phone number format if the OTP is for phone
    if (
      type === "phoneNumber" &&
      phoneNumber &&
      !validator.isMobilePhone(phoneNumber, "any", { strictMode: true })
    ) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "invalid_phone",
      });
    }

    let user;
    if (type === "email") {
      user = await User.findOne({ email: email.toLowerCase() }).select(
        "email accountState otpInfo verificationStatus timezone"
      );
    } else if (type === "phoneNumber") {
      user = await User.findOne({ phoneNumber }).select(
        "phoneNumber accountState otpInfo verificationStatus timezone"
      );
    }

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_not",
      });
    }

    // Access the correct OTP based on the type (email or phone)
    const userOtpInfo =
      type === "email" ? user.otpInfo.emailOtp : user.otpInfo.phoneNumberOtp;

    if (type === "email") {
      // Check if the OTP matches
      if (userOtpInfo.otp !== otp.toString()) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "invalid_otp",
        });
      }

      // Check if the OTP has expired
      const currentTime = moment.tz(Date.now(), user.timezone).valueOf();
      if (userOtpInfo.otpExpires && userOtpInfo.otpExpires < currentTime) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "otp_has",
        });
      }
    }

    // Clear the OTP and OTP expiration after successful verification
    userOtpInfo.otp = "";
    userOtpInfo.otpExpires = "";
    userOtpInfo.otpUsed = true; // Mark OTP as used
    user.verificationStatus[type] = "verified"; // Mark verification as complete

    // Generate a password reset token (JWT or a UUID)
    const resetToken = generateResetToken(); // Function to generate a secure token
    user.resetToken = resetToken; // Save the token to the user model

    await user.save({ session });
    await session.commitTransaction();
    session.endSession();

    // Fetch the updated user and profile icon simultaneously
    const updatedUser = await User.findById(user._id);

    // Generate a new auth token for the user
    const token = user.generateAuthToken();

    // Format the user response using the utility function
    const response = formatUserResponse(updatedUser, token);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "otp_verified",
      data: response,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error during OTP verification:", error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "an_error",
      error: error,
    });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  try {
    const { email, newPassword, resetToken } = req.body;

    const validationOptions = {
      rawData: ["email", "newPassword", "resetToken"],
    };
    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    // Find the user by email
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      resetToken: resetToken,
    });

    if (!user) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "no_valid",
      });
    }

    // Update the password and mark OTP as used
    user.password = newPassword;
    user.otpInfo.otpUsed = true; // Mark OTP as used
    user.otpInfo.otp = ""; // Clear OTP
    user.otpInfo.otpExpires = ""; // Clear OTP expiration
    user.resetToken = ""; // Clear OTP token

    await user.save();

    // Fetch the updated user with profile icon populated and generate a token simultaneously
    const [updatedUser, token] = await Promise.all([
      User.findById(user._id),
      user.generateAuthToken(),
    ]);

    // Format the user response using the utility function
    const response = formatUserResponse(updatedUser, token);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "password_has",
      data: response,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "an_error_1",
      error: error,
    });
  }
};

const logout = async (req, res) => {
  try {
    const { deviceId } = req.body;
    const userId = req.user._id;

    if (deviceId) {
      // Use $pull to remove the specific device from the devices array
      await Devices.updateOne(
        { userId: userId },
        { $pull: { devices: { deviceId: deviceId } } }
      );
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "logged_out",
    });
  } catch (err) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: err.message,
      error: err.message,
    });
  }
};
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const email = req.user.email;

    // Generate a random email using the userId and original email
    const randomEmail = `deleted_user_${userId}_${Date.now()}@example.com`;

    // Update the user's account state to hardDeleted and set the finalDeletionDate
    await User.findByIdAndUpdate(
      userId,
      {
      $set: {
        email: randomEmail, // replace with random email
        previousEmail: email, // store the original email
        "accountState.status": "hardDeleted", 
        "accountState.finalDeletionDate": new Date(), // set to now or your logic
      },
      },
      { new: true }
    );

    await Devices.updateOne(
      { userId: userId },
      { $set: { devices: [] } } // This will empty the array of devices for the user
    );

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "account_deleted",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error: error,
    });
  }
};

const socialAuth = async (req, res) => {
  const { provider, socialId, email, name, deviceId, deviceType, timezone } =
    req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const validationOptions = {
      rawData: [
        "provider",
        "socialId",
        "email",
        "name",
        "deviceId",
        "deviceType",
        "timezone",
      ],
      enumFields: {
        provider: ["google", "facebook", "apple"], // Allowed values for provider
      },
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    // Check for existing user by email
    const existingUser = await User.findOne({ email });

    // If user exists, update or link the social provider
    if (existingUser) {
      let providerLinked = false;

      if (
        existingUser.accountState.status === "restricted" ||
        existingUser.accountState.status === "suspended"
      ) {
        return sendResponse({
          res,
          statusCode: 403,
          translationKey: "your_account_2",
        });
      }


      // Check if the social ID is already linked, if not, link it
      if (provider === "google" && !existingUser.googleId) {
        existingUser.googleId = socialId; // Link Google account
        providerLinked = true;
      } else if (provider === "facebook" && !existingUser.facebookId) {
        existingUser.facebookId = socialId; // Link Facebook account
        providerLinked = true;
      } else if (provider === "apple" && !existingUser.appleId) {
        existingUser.appleId = socialId; // Link Apple account
        providerLinked = true;
      }

      // Always update the provider and timezone, regardless of providerLinked status
      existingUser.provider = provider; // Update the provider field to reflect the latest social login
      existingUser.timezone = timezone; // Update the timezone to reflect the user's current login
      existingUser.accountState.status = "active"; // Ensure the account is active

      await existingUser.save({ session });
      const token = existingUser.generateAuthToken();

      const response = formatUserResponse(existingUser, token);

      // Save device information
      createOrSkipDevice(existingUser._id, deviceId, deviceType);

      await session.commitTransaction();
      session.endSession();

      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "login_success",
        data: response,
      });
    } else {
      // If user does not exist, treat this as a signup
      const newUser = new User({
        email,
        name,
        provider, // Set the initial provider
        [`${provider}Id`]: socialId, // Dynamically store the provider ID
        timezone,
        verificationStatus: {
          email: "verified", // Mark email as verified
        },
      });

      await newUser.save({ session });

      // Generate a token for the new user
      const token = newUser.generateAuthToken();

      const response = formatUserResponse(newUser, token);

      // Save device information
      createOrSkipDevice(newUser._id, deviceId, deviceType);

      await session.commitTransaction();
      session.endSession();

      return sendResponse({
        res,
        statusCode: 201,
        translationKey: "signup_successful",
        data: response,
      });
    }
  } catch (error) {
    // Rollback transaction in case of any error
    await session.abortTransaction();
    session.endSession();
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error: error,
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  generateOtp,
  verifyOtp,
  resetPassword,
  logout,
  deleteAccount,
  socialAuth,
};
