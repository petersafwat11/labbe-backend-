const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

// Signup routes for different user types
router.post("/signup/host", authController.signupHost);
router.post("/signup/vendor", authController.signupVendor);
router.post("/signup/whitelabel", authController.signupWhiteLabel);

// Login routes
router.post("/login", authController.login); // Email/password login for host and vendor
router.post("/send-otp", authController.sendOTP); // Send OTP to phone number
router.post("/verify-otp", authController.verifyOTP); // Verify OTP and login

// Existing routes (no changes)
router.get("/logout", authController.logout);
router.post("/forgotPassword", authController.forgotPassword);
router.patch("/resetPassword/:token", authController.resetPassword);

// Protect all routes after this middleware
router.use(authController.protect);

router.patch("/updateMyPassword", authController.updatePassword);

module.exports = router;
