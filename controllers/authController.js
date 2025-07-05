const crypto = require("crypto");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const Host = require("../models/HostModel");
const Vendor = require("../models/VendorModel");
const WhiteLabel = require("../models/WhiteLabelModel");
const OTP = require("../models/OTPModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const sendEmail = require("../utils/email");
const {
  getRelativeFilePath,
  processVendorFiles,
} = require("../utils/fileUpload");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, res, userType) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("jwt", token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    userType,
    data: {
      user,
    },
  });
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send SMS function (placeholder - you'll need to implement with your SMS provider)
const sendSMS = async (phoneNumber, message) => {
  // TODO: Implement SMS sending with your preferred SMS service
  // For now, just log the OTP (remove this in production)
  console.log(`SMS to ${phoneNumber}: ${message}`);
  return true;
};

// SIGNUP CONTROLLERS
exports.signupHost = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        status: "fail",
        message: "Phone number is required",
      });
    }

    // Check if host already exists
    const existingHost = await Host.findOne({ phoneNumber });

    if (existingHost) {
      return res.status(400).json({
        status: "fail",
        message: "Host with this phone number already exists",
      });
    }

    // Create new host with minimal data
    const newHost = await Host.create({
      phoneNumber,
      profileCompleted: false, // Track if profile is completed
    });

    // Send token and minimal host details
    createSendToken(newHost, 201, res, "host");
  } catch (err) {
    console.error("Host signup error:", err);
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};

// Complete host profile
exports.completeHostProfile = async (req, res) => {
  try {
    let { username, email, password, passwordConfirm } = req.body;

    if (!username || !email || !password || !passwordConfirm) {
      return res.status(400).json({
        status: "fail",
        message:
          "All fields are required: username, email, password, passwordConfirm",
      });
    }

    // Trim whitespace from username
    username = username.trim();

    // Validate passwords match
    if (password !== passwordConfirm) {
      return res.status(400).json({
        status: "fail",
        message: "Passwords do not match",
      });
    }

    // Check if email or username already exists (excluding current user)
    const existingHost = await Host.findOne({
      $and: [
        { _id: { $ne: req.user._id } },
        { $or: [{ email }, { username }] },
      ],
    });

    if (existingHost) {
      return res.status(400).json({
        status: "fail",
        message: "Email or username already exists",
      });
    }

    // Get the current user and update fields manually
    const hostToUpdate = await Host.findById(req.user._id);

    if (!hostToUpdate) {
      return res.status(404).json({
        status: "fail",
        message: "Host not found",
      });
    }

    // Update fields
    hostToUpdate.username = username;
    hostToUpdate.email = email;
    hostToUpdate.password = password;
    hostToUpdate.passwordConfirm = passwordConfirm;
    hostToUpdate.profileCompleted = true;

    // Save the updated host (this will trigger pre-save middleware for password hashing)
    const updatedHost = await hostToUpdate.save();

    // Send new token with updated host details
    createSendToken(updatedHost, 200, res, "host");
  } catch (err) {
    console.error("Complete host profile error:", err);
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};

exports.signupVendor = async (req, res) => {
  try {
    console.log("Vendor signup request body:", req.body);
    console.log("Uploaded files:", req.files);

    // Parse form data (JSON strings from FormData)
    const {
      identity,
      serviceData,
      samplesAndPackages,
      commercialVerification,
      paymentData,
      otherLinksAndData,
    } = req.body;

    // Parse JSON strings if they come as strings (from FormData)
    const parsedIdentity =
      typeof identity === "string" ? JSON.parse(identity) : identity;
    const parsedServiceData =
      typeof serviceData === "string" ? JSON.parse(serviceData) : serviceData;
    const parsedSamplesAndPackages =
      typeof samplesAndPackages === "string"
        ? JSON.parse(samplesAndPackages)
        : samplesAndPackages;
    const parsedCommercialVerification =
      typeof commercialVerification === "string"
        ? JSON.parse(commercialVerification)
        : commercialVerification;
    const parsedPaymentData =
      typeof paymentData === "string" ? JSON.parse(paymentData) : paymentData;
    const parsedOtherLinksAndData =
      typeof otherLinksAndData === "string"
        ? JSON.parse(otherLinksAndData)
        : otherLinksAndData;

    // Validate password fields
    if (!parsedIdentity.password || !parsedIdentity.passwordConfirm) {
      return res.status(400).json({
        status: "fail",
        message: "Password and password confirmation are required",
      });
    }

    if (parsedIdentity.password !== parsedIdentity.passwordConfirm) {
      return res.status(400).json({
        status: "fail",
        message: "Passwords do not match",
      });
    }

    // Process uploaded files
    const uploadedFiles = processVendorFiles(req.files);

    // Merge file paths with parsed data
    if (uploadedFiles.portfolioImages) {
      parsedSamplesAndPackages.portfolioImages = uploadedFiles.portfolioImages;
    }
    if (uploadedFiles.businessLogo) {
      parsedSamplesAndPackages.businessLogo = uploadedFiles.businessLogo;
    }
    if (uploadedFiles.pricePackages) {
      parsedSamplesAndPackages.pricePackages = uploadedFiles.pricePackages;
    }
    if (uploadedFiles.commercialRecord) {
      parsedCommercialVerification.commercialRecord =
        uploadedFiles.commercialRecord;
    }
    if (uploadedFiles.cv) {
      parsedOtherLinksAndData.cv = uploadedFiles.cv;
    }
    if (uploadedFiles.profileFile) {
      parsedOtherLinksAndData.profileFile = uploadedFiles.profileFile;
    }

    // Check if vendor already exists
    const existingVendor = await Vendor.findOne({
      $or: [
        { "identity.email": parsedIdentity.email },
        { "identity.phoneNumber": parsedIdentity.phoneNumber },
      ],
    });

    if (existingVendor) {
      return res.status(400).json({
        status: "fail",
        message: "Vendor with this email or phone number already exists",
      });
    }

    // Create new vendor
    const newVendor = await Vendor.create({
      identity: parsedIdentity,
      serviceData: parsedServiceData,
      samplesAndPackages: parsedSamplesAndPackages,
      commercialVerification: parsedCommercialVerification,
      paymentData: parsedPaymentData,
      otherLinksAndData: parsedOtherLinksAndData,
      password: parsedIdentity.password,
      passwordConfirm: parsedIdentity.passwordConfirm,
    });

    // Just send success message for vendor signup
    res.status(201).json({
      status: "success",
      message: "Vendor account created successfully",
      data: {
        id: newVendor._id,
        identity: {
          brandName: newVendor.identity.brandName,
          email: newVendor.identity.email,
        },
      },
    });
  } catch (err) {
    console.error("Vendor signup error:", err);
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};

exports.signupWhiteLabel = async (req, res) => {
  try {
    console.log("WhiteLabel signup request body:", req.body);
    console.log("Uploaded file:", req.file);

    const {
      identity,
      loginData,
      systemRequirements,
      additionalServices,
      paymentData,
    } = req.body;

    // Parse JSON strings if they come as strings (from FormData)
    const parsedIdentity =
      typeof identity === "string" ? JSON.parse(identity) : identity;
    const parsedLoginData =
      typeof loginData === "string" ? JSON.parse(loginData) : loginData;
    const parsedSystemRequirements =
      typeof systemRequirements === "string"
        ? JSON.parse(systemRequirements)
        : systemRequirements;
    const parsedAdditionalServices =
      typeof additionalServices === "string"
        ? JSON.parse(additionalServices)
        : additionalServices;
    const parsedPaymentData =
      typeof paymentData === "string" ? JSON.parse(paymentData) : paymentData;

    // Handle logo upload
    if (req.file) {
      const logoPath = getRelativeFilePath(req.file);
      parsedIdentity.logo = logoPath;
    }

    // Check if whitelabel already exists
    const existingWhiteLabel = await WhiteLabel.findOne({
      $or: [
        { "loginData.email": parsedLoginData.email },
        { "identity.arabic_name": parsedIdentity.arabic_name },
        { "identity.english_name": parsedIdentity.english_name },
      ],
    });

    if (existingWhiteLabel) {
      return res.status(400).json({
        status: "fail",
        message: "WhiteLabel with this email or company name already exists",
      });
    }

    // Create new whitelabel
    const newWhiteLabel = await WhiteLabel.create({
      identity: parsedIdentity,
      loginData: parsedLoginData,
      systemRequirements: parsedSystemRequirements,
      additionalServices: parsedAdditionalServices || [],
      paymentData: parsedPaymentData,
    });

    // Just send success message for whitelabel signup
    res.status(201).json({
      status: "success",
      message: "WhiteLabel account created successfully",
      data: {
        id: newWhiteLabel._id,
        identity: {
          arabic_name: newWhiteLabel.identity.arabic_name,
          english_name: newWhiteLabel.identity.english_name,
          logo: newWhiteLabel.identity.logo,
        },
        loginData: newWhiteLabel.loginData,
      },
    });
  } catch (err) {
    console.error("WhiteLabel signup error:", err);
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};

// LOGIN CONTROLLERS
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: "fail",
      message: "Please provide email and password",
    });
  }

  // First, search in Host collection
  let user = await Host.findOne({ email }).select("+password");
  let userType = "host";

  // If not found in Host, search in Vendor collection
  if (!user) {
    user = await Vendor.findOne({ email }).select("+password");
    userType = "vendor";
  }

  // If still not found, return error
  if (!user || !(await user.correctPassword(password, user.password))) {
    return res.status(401).json({
      status: "fail",
      message: "Incorrect email or password",
    });
  }

  createSendToken(user, 200, res, userType);
});

exports.sendOTP = catchAsync(async (req, res, next) => {
  const { phoneNumber, type } = req.body; // type can be "login" or "signup"

  if (!phoneNumber) {
    return res.status(400).json({
      status: "fail",
      message: "Please provide phone number",
    });
  }

  if (!type || !["login", "signup"].includes(type)) {
    return res.status(400).json({
      status: "fail",
      message: "Please provide valid purpose (login or signup)",
    });
  }

  let user = null;
  let userType = "signup";
  let userId = null;

  if (type === "login") {
    // First, search in Host collection
    user = await Host.findOne({ phoneNumber });
    userType = "host";

    // If not found in Host, search in Vendor collection
    if (!user) {
      user = await Vendor.findOne({ phoneNumber });
      userType = "vendor";
    }

    // If still not found for login, return error
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "No account found with this phone number",
      });
    }

    userId = user._id;
  } else if (type === "signup") {
    // For signup, check if phone number already exists
    const existingHost = await Host.findOne({ phoneNumber });
    const existingVendor = await Vendor.findOne({ phoneNumber });

    if (existingHost || existingVendor) {
      return res.status(400).json({
        status: "fail",
        message: "Phone number already registered. Please use login instead.",
      });
    }

    userType = "signup";
    userId = null;
  }

  // Generate OTP
  const otpCode = generateOTP();

  // Delete any existing OTP for this phone number
  await OTP.deleteMany({ phoneNumber });

  // Save OTP to database
  await OTP.create({
    phoneNumber,
    otpCode,
    userType,
    userId,
  });

  // Send OTP via SMS
  const smsMessage = `Your OTP code is: ${otpCode}. Valid for 5 minutes.`;
  await sendSMS(phoneNumber, smsMessage);

  res.status(200).json({
    status: "success",
    message: "OTP sent successfully to your phone number",
    type,
  });
});

exports.verifyOTP = catchAsync(async (req, res, next) => {
  const { phoneNumber, otpCode } = req.body;

  if (!phoneNumber || !otpCode) {
    return res.status(400).json({
      status: "fail",
      message: "Please provide phone number and OTP code",
    });
  }

  // Find OTP record
  const otpRecord = await OTP.findOne({ phoneNumber, otpCode });

  if (!otpRecord) {
    return res.status(400).json({
      status: "fail",
      message: "Invalid or expired OTP",
    });
  }

  // Handle signup scenario
  if (otpRecord.userType === "signup") {
    // Delete OTP record after successful verification
    await OTP.deleteOne({ _id: otpRecord._id });

    // Return success for signup phone verification
    return res.status(200).json({
      status: "success",
      message: "Phone number verified successfully",
      phoneNumber,
      verified: true,
    });
  }

  // Handle login scenario - Find user based on userType and userId from OTP record
  let user;
  if (otpRecord.userType === "host") {
    user = await Host.findById(otpRecord.userId);
  } else if (otpRecord.userType === "vendor") {
    user = await Vendor.findById(otpRecord.userId);
  }

  if (!user) {
    return res.status(404).json({
      status: "fail",
      message: "User not found",
    });
  }

  // Delete OTP record after successful verification
  await OTP.deleteOne({ _id: otpRecord._id });

  // Login the user
  createSendToken(user, 200, res, otpRecord.userType);
});

// EXISTING CONTROLLERS (unchanged)
exports.logout = (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: "success" });
};

exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 2) Check if user still exists (check in both Host and Vendor collections)
      let currentUser = await Host.findById(decoded.id);
      if (!currentUser) {
        currentUser = await Vendor.findById(decoded.id);
      }
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

exports.protect = catchAsync(async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return res.status(401).json({
        status: "fail",
        message: "You are not logged in! Please log in to get access.",
      });
    }

    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // Check in both Host and Vendor collections
    let currentUser = await Host.findById(decoded.id);
    if (!currentUser) {
      currentUser = await Vendor.findById(decoded.id);
    }

    if (!currentUser) {
      return res.status(401).json({
        status: "fail",
        message: "The user belonging to this token no longer exists.",
      });
    }

    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({
        status: "fail",
        message: "User recently changed password! Please log in again.",
      });
    }

    req.user = currentUser;
    next();
  } catch (err) {
    res.status(401).json({
      status: "fail",
      message: "Invalid token. Please log in again!",
    });
  }
});

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    // roles ['admin', 'lead-guide']. role='user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }

    next();
  };

exports.forgotPassword = async (req, res) => {
  try {
    // Check in both Host and Vendor collections
    let user = await Host.findOne({ email: req.body.email });
    if (!user) {
      user = await Vendor.findOne({ email: req.body.email });
    }

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "There is no user with email address.",
      });
    }

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Use frontend URL instead of backend URL
    const resetURL = `${process.env.FRONTEND_URL}/changePassword?token=${resetToken}`;

    try {
      await sendEmail({
        email: user.email,
        subject: "Your password reset token (valid for 10 min)",
        message: resetURL, // This will trigger the password reset template in email.js
      });

      res.status(200).json({
        status: "success",
        message: "Token sent to email!",
      });
    } catch (err) {
      console.error("Email sending error:", err);
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        status: "fail",
        message: "There was an error sending the email. Try again later!",
      });
    }
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};

exports.resetPassword = catchAsync(async (req, res, next) => {
  try {
    // Get user based on the token
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    console.log("Attempting to reset password with token:", req.params.token);
    console.log("Hashed token:", hashedToken);

    // Check in both Host and Vendor collections
    let user = await Host.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      user = await Vendor.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
      });
    }

    if (!user) {
      console.log("No user found with token or token expired");
      return res.status(400).json({
        status: "fail",
        message: "Token is invalid or has expired",
      });
    }

    // Set new password
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Determine user type for token response
    let userType = "host";
    if (user.constructor.modelName === "Vendor") {
      userType = "vendor";
    }

    // Log the user in, send JWT
    createSendToken(user, 200, res, userType);
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  try {
    // Check in both Host and Vendor collections
    let user = await Host.findById(req.user.id).select("+password");
    let userType = "host";

    if (!user) {
      user = await Vendor.findById(req.user.id).select("+password");
      userType = "vendor";
    }

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    if (
      !(await user.correctPassword(req.body.passwordCurrent, user.password))
    ) {
      return res.status(401).json({
        status: "fail",
        message: "Your current password is wrong.",
      });
    }

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();

    createSendToken(user, 200, res, userType);
  } catch (err) {
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
});

exports.adminProtection = catchAsync(async (req, res, next) => {
  // Check in both Host and Vendor collections
  let user = await Host.findById(req.params.id);
  if (!user) {
    user = await Vendor.findById(req.params.id);
  }

  if (user && user.role === "Admin") {
    return next(new AppError(`admin acc can't be changed`, 401));
  }
  next();
});

exports.updateData = catchAsync(async (req, res, next) => {
  try {
    const { username, email, password, passwordConfirm } = req.body;

    console.log("Update data request:", {
      username,
      email,
      hasPassword: !!password,
    });

    if (!username || !email) {
      return res.status(400).json({
        status: "fail",
        message: "Username and email are required",
      });
    }

    // Get the current user
    const currentUser = await Host.findById(req.user._id);

    if (!currentUser) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // Check if email or username already exists (excluding current user)
    const existingUser = await Host.findOne({
      $and: [
        { _id: { $ne: req.user._id } },
        { $or: [{ email }, { username }] },
      ],
    });

    if (existingUser) {
      return res.status(400).json({
        status: "fail",
        message: "Email or username already exists",
      });
    }

    // Check if password fields are provided
    if (password && passwordConfirm) {
      // Validate passwords match
      if (password !== passwordConfirm) {
        return res.status(400).json({
          status: "fail",
          message: "Passwords do not match",
        });
      }

      // Update all fields including password
      currentUser.username = username.trim();
      currentUser.email = email.toLowerCase();
      currentUser.password = password;
      currentUser.passwordConfirm = passwordConfirm;
    } else {
      // Update only username and email
      currentUser.username = username.trim();
      currentUser.email = email.toLowerCase();
    }

    // Save the updated user
    const updatedUser = await currentUser.save();

    // Remove password from response
    updatedUser.password = undefined;
    updatedUser.passwordConfirm = undefined;

    // Return success response with updated user data
    res.status(200).json({
      status: "success",
      message: password
        ? "Account settings and password updated successfully"
        : "Account settings updated successfully",
      data: {
        user: {
          _id: updatedUser._id,
          username: updatedUser.username,
          email: updatedUser.email,
          phoneNumber: updatedUser.phoneNumber,
          emailVerified: updatedUser.emailVerified,
          profileCompleted: updatedUser.profileCompleted,
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
        },
      },
    });
  } catch (err) {
    console.error("Update user data error:", err);
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
});

exports.sendEmailVerificationCode = catchAsync(async (req, res, next) => {
  try {
    // Get user email from req.user
    const { email: userEmail, emailVerified } = req.user;

    if (!userEmail) {
      return res.status(400).json({
        status: "fail",
        message: "User email not found",
      });
    }

    // if (emailVerified) {
    //   return res.status(400).json({
    //     status: "fail",
    //     message: "Email already verified",
    //   });
    // }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    // Store verification code in user document with expiry
    const currentUser = await Host.findById(req.user._id);

    if (!currentUser) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // Add verification code fields to user (you may need to add these to the Host model)
    currentUser.emailVerificationCode = verificationCode;
    currentUser.emailVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    currentUser.emailVerified = false;

    await currentUser.save({ validateBeforeSave: false });

    // Send verification code via email with proper HTML content
    const emailHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Email Verification Code</h2>
        <p>Your email verification code is:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f8f9fa; border: 2px solid #007bff; padding: 20px; border-radius: 8px; display: inline-block;">
            <h1 style="color: #007bff; margin: 0; font-size: 36px; letter-spacing: 4px;">${verificationCode}</h1>
          </div>
        </div>
        <p style="color: #666; font-size: 14px;">
          This code is valid for 10 minutes. If you didn't request this code, please ignore this email.
        </p>
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          This is an automated message, please do not reply to this email.
        </p>
      </div>
    `;

    try {
      await sendEmail({
        email: userEmail,
        subject: "Email Verification Code",
        html: emailHTML,
      });

      res.status(200).json({
        status: "success",
        message: "Verification code sent to your email successfully",
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);

      // Clean up verification code if email fails
      currentUser.emailVerificationCode = undefined;
      currentUser.emailVerificationExpires = undefined;
      await currentUser.save({ validateBeforeSave: false });

      return res.status(500).json({
        status: "fail",
        message: "Failed to send verification email. Please try again later.",
      });
    }
  } catch (err) {
    console.error("Send email verification code error:", err);
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
});

exports.verifyEmail = catchAsync(async (req, res, next) => {
  try {
    const { emailVerified } = req.user;
    // if (emailVerified) {
    //   return res.status(400).json({
    //     status: "fail",
    //     message: "Email already verified",
    //   });
    // }
    const { verificationCode } = req.body;

    if (!verificationCode) {
      return res.status(400).json({
        status: "fail",
        message: "Verification code is required",
      });
    }

    // Find user with matching verification code
    const currentUser = await Host.findOne({
      _id: req.user._id,
      emailVerificationCode: verificationCode,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!currentUser) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid or expired verification code",
      });
    }

    // Mark as verified and clear verification fields
    currentUser.emailVerified = true;
    currentUser.emailVerificationCode = undefined;
    currentUser.emailVerificationExpires = undefined;

    await currentUser.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      message: "Email verified successfully",
      data: {
        emailVerified: true,
      },
    });
  } catch (err) {
    console.error("Verify email verification code error:", err);
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
});

exports.updateUser = catchAsync(async (req, res, next) => {
  // Check in both Host and Vendor collections
  let user = await Host.findById(req.params.id);
  if (!user) {
    user = await Vendor.findById(req.params.id);
  }

  if (!user) {
    return next(new AppError(`there isn't a user with that id`, 404));
  }

  const { role, name } = req.body;
  user.role = role;
  user.name = name;
  if (req.body.password) {
    user.password = req.body.password;
  }
  user.save();
  res.status(201).json({
    status: "success",
    user,
  });
});

// Template saving function
exports.saveTemplate = catchAsync(async (req, res, next) => {
  // Check if template image was uploaded
  if (!req.file) {
    return next(new AppError("No template image provided", 400));
  }

  // Parse template data from request
  const templateData = JSON.parse(req.body.templateData || "{}");

  // Generate unique filename
  const timestamp = Date.now();
  const filename = `template-${timestamp}.png`;
  const filepath = path.join(__dirname, "../public/templates", filename);

  // Create templates directory if it doesn't exist
  const templatesDir = path.join(__dirname, "../public/templates");
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }

  // Save the image file
  fs.writeFileSync(filepath, req.file.buffer);

  // Save template data to database (optional)
  // You can create a TemplateModel and save the data
  const templateRecord = {
    filename: filename,
    filepath: `/templates/${filename}`,
    templateData: templateData,
    createdAt: new Date(),
    userId: req.user?.id || null, // if user is authenticated
  };

  // Example: Save to database
  // await TemplateModel.create(templateRecord);

  res.status(201).json({
    status: "success",
    message: "Template saved successfully",
    data: {
      templateId: timestamp,
      imageUrl: `/templates/${filename}`,
      templateData: templateData,
    },
  });
});
