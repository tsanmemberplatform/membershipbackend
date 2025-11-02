const jwt = require('jsonwebtoken');
const { userModel } = require('../models/userModel');


exports.auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({status: false, message: "Authorization token required" });
    }

    const token = authHeader.split(" ")[1];

    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret_key");
    const user = await userModel.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({status: false, message: "User not found or token invalid" });
    }

    req.user = user; 
    req.userEmail = user.email;
    next();
  } catch (error) {
    res.status(401).json({ status: false, message: "Unauthorized: " + error.message });
  }
};


exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status:false, message: "Unauthorized: No user found" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ status: false, message: "You don’t have access" });
    }
    next();
  };
};


exports.checkSuspension = (req, res, next) => {
  try {
    if (req.user && req.user.status === "suspended") {
      return res.status(403).json({
        status: false,
        message:
          "Your account has been suspended. You are restricted from performing this action.",
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Error verifying user suspension status.",
    });
  }
};

