const express = require("express");
const authController = require("../controllers/authController");
const { uploadLogo, uploadVendorFiles } = require("../utils/fileUpload");
const multer = require("multer");
const { protect } = require("../utils/auth");
const {
  sendOTP,
  verifyOTP,
  signUp,
  signIn,
  saveTemplate,
} = require("../controllers/authController");

const router = express.Router();

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Signup routes for different user types
router.post("/signup/host", authController.signupHost);
router.post("/signup/vendor", uploadVendorFiles, authController.signupVendor);
router.post("/signup/whitelabel", uploadLogo, authController.signupWhiteLabel);

// Host profile completion route (requires authentication)
router.patch(
  "/complete-host-profile",
  authController.protect,
  authController.completeHostProfile
);

// Login routes
router.post("/login", authController.login); // Email/password login for host and vendor
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);

// Existing routes (no changes)
router.get("/logout", authController.logout);
router.post("/forgotPassword", authController.forgotPassword);
router.patch("/resetPassword/:token", authController.resetPassword);

// Protect all routes after this middleware
router.use(authController.protect);

router.patch("/host/updateData", authController.updateData);
router.patch(
  "/host/sendEmailVerificationCode",
  authController.sendEmailVerificationCode
);
router.patch("/host/verifyEmail", authController.verifyEmail);

// Template routes
router.post("/templates/save", upload.single("templateImage"), saveTemplate);

module.exports = router;
