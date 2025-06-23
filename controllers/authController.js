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
    const { username, email, phoneNumber, password, passwordConfirm } =
      req.body;

    // Check if host already exists
    const existingHost = await Host.findOne({
      $or: [{ email }, { username }, { phoneNumber }],
    });

    if (existingHost) {
      return res.status(400).json({
        status: "fail",
        message:
          "Host with this email, username, or phone number already exists",
      });
    }

    // Create new host
    const newHost = await Host.create({
      username,
      email,
      phoneNumber,
      password,
      passwordConfirm,
    });

    // Send token and host details for host signup
    createSendToken(newHost, 201, res, "host");
  } catch (err) {
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};

exports.signupVendor = async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;

    // Check if vendor already exists
    const existingVendor = await Vendor.findOne({
      $or: [{ email }, { phoneNumber }],
    });

    if (existingVendor) {
      return res.status(400).json({
        status: "fail",
        message: "Vendor with this email, or phone number already exists",
      });
    }

    // Create new vendor
    await Vendor.create({
      ...req.body,
    });

    // Just send success message for vendor signup
    res.status(201).json({
      status: "success",
      message: "Vendor account created successfully",
    });
  } catch (err) {
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};

exports.signupWhiteLabel = async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;

    // Check if whitelabel already exists
    const existingWhiteLabel = await WhiteLabel.findOne({
      $or: [{ email }, { phoneNumber }],
    });

    if (existingWhiteLabel) {
      return res.status(400).json({
        status: "fail",
        message: "WhiteLabel with this email, or phone number already exists",
      });
    }

    // Create new whitelabel
    await WhiteLabel.create({
      ...req.body,
    });

    // Just send success message for whitelabel signup
    res.status(201).json({
      status: "success",
      message: "WhiteLabel account created successfully",
    });
  } catch (err) {
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
        message: resetURL,
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
    data: {
      data: user,
    },
  });
});
