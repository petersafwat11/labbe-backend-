const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../public/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = uploadsDir;

    // Create subdirectories based on file type or route
    if (file.fieldname === "logo") {
      uploadPath = path.join(uploadsDir, "logos");
    } else if (file.fieldname === "portfolioImages") {
      uploadPath = path.join(uploadsDir, "portfolios");
    } else if (file.fieldname === "businessLogo") {
      uploadPath = path.join(uploadsDir, "logos");
    } else if (file.fieldname === "pricePackages") {
      uploadPath = path.join(uploadsDir, "packages");
    } else if (file.fieldname === "commercialRecord") {
      uploadPath = path.join(uploadsDir, "documents");
    } else if (file.fieldname === "cv") {
      uploadPath = path.join(uploadsDir, "documents");
    } else if (file.fieldname === "profileFile") {
      uploadPath = path.join(uploadsDir, "documents");
    } else {
      uploadPath = path.join(uploadsDir, "general");
    }

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    cb(null, `${baseName}-${uniqueSuffix}${extension}`);
  },
});

// File filter for images
const imageFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"),
      false
    );
  }
};

// General file filter
const generalFilter = (req, file, cb) => {
  // Add any file type restrictions here
  cb(null, true);
};

// Multer configurations
const uploadImage = multer({
  storage: storage,
  fileFilter: imageFilter,
  //   limits: {
  //     fileSize: 5 * 1024 * 1024, // 5MB limit
  //   },
});

const uploadGeneral = multer({
  storage: storage,
  fileFilter: generalFilter,
  //   limits: {
  //     fileSize: 10 * 1024 * 1024, // 10MB limit
  //   },
});

// Helper function to get file path for database storage
const getRelativeFilePath = (file) => {
  if (!file) return null;

  // Return path relative to public folder
  const publicIndex = file.path.indexOf("public");
  if (publicIndex !== -1) {
    return file.path.substring(publicIndex + 6); // Remove 'public' from path
  }
  return file.filename;
};

// Helper function to delete file
const deleteFile = (filePath) => {
  try {
    const fullPath = path.join(__dirname, "../public", filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
  } catch (error) {
    console.error("Error deleting file:", error);
  }
  return false;
};

// Vendor file upload configuration
const uploadVendorFiles = uploadGeneral.fields([
  { name: "portfolioImages", maxCount: 10 },
  { name: "businessLogo", maxCount: 1 },
  { name: "pricePackages", maxCount: 5 },
  { name: "commercialRecord", maxCount: 1 },
  { name: "cv", maxCount: 1 },
  { name: "profileFile", maxCount: 1 },
]);

// Helper function to process uploaded files for vendor
const processVendorFiles = (files) => {
  const processedFiles = {};

  if (files) {
    Object.keys(files).forEach((fieldName) => {
      if (files[fieldName] && files[fieldName].length > 0) {
        if (fieldName === "portfolioImages" || fieldName === "pricePackages") {
          // Multiple files field
          processedFiles[fieldName] = files[fieldName].map((file) =>
            getRelativeFilePath(file)
          );
        } else {
          // Single file field
          processedFiles[fieldName] = getRelativeFilePath(files[fieldName][0]);
        }
      }
    });
  }

  return processedFiles;
};

module.exports = {
  uploadImage,
  uploadGeneral,
  getRelativeFilePath,
  deleteFile,
  processVendorFiles,
  // Specific upload configurations
  uploadLogo: uploadImage.single("logo"),
  uploadMultipleImages: uploadImage.array("images", 10),
  uploadPortfolio: uploadImage.array("portfolio", 20),
  uploadVendorFiles,
};
