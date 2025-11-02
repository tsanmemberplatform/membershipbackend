require("dotenv").config();
const { userModel } = require('../models/userModel');
const { auditTrailModel } = require('../models/auditTrailModel');
const sendMail = require('../utils/email');
const bcrypt = require('bcrypt');
const qrcode = require("qrcode");
const cloudinary = require('../config/cloudinary');
const jwt = require('jsonwebtoken');
const { resetPasswordMail, welcomeMail, mfaEmailTemplate, twoFAMail } = require('../utils/mailTemplates');
const mongoose = require ('mongoose')
const speakeasy = require("speakeasy");
const otpGenerator = require('otp-generator');
const invitationModel = require("../models/invitationModel");
const ActivityLog = require("../models/logModel");
const trainingModel = require("../models/trainingModel");
const awardProgressModel = require("../models/awardProgressModel");
const eventModel = require("../models/eventModel");
const generateOTP = () => {
  return otpGenerator.generate(6, { 
    upperCaseAlphabets: false, 
    lowerCaseAlphabets: false, 
    specialChars: false 
  });
};

  const generateMembershipId = async (stateScoutCouncil, userModel) => {
  const stateAbbr = stateScoutCouncil.substring(0, 3).toUpperCase();
  let membershipId, exists;
  let digitLength = 7; 

  do {
    
    const min = Math.pow(10, digitLength - 1);
    const max = Math.pow(10, digitLength) - 1;
    const uniqueNumber = Math.floor(min + Math.random() * (max - min));

    membershipId = `TSAN-${stateAbbr}-${uniqueNumber}`;
    exists = await userModel.findOne({ membershipId });

    // ✅ If all 7-digit numbers are exhausted, switch to 8 digits
    if (exists && digitLength === 7) {
      const totalUsers = await userModel.countDocuments({
        membershipId: { $regex: `^TSAN-${stateAbbr}-` }
      });

      if (totalUsers >= 9_000_000) {
        digitLength = 8; 
      }
    }

  } while (exists);

  return membershipId;
};


exports.registration = async (req, res) => {
  try {
    const { fullName, email, phoneNumber, gender, dateOfBirth, password, stateOfOrigin, lga, address, stateScoutCouncil, scoutDivision, scoutDistrict, troop, scoutingRole, section } = req.body;
    
    const existingUser = await userModel.findOne({ $or: [{ email }, { phoneNumber }] });
    if (existingUser) return res.status(400).json({ status: true, message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const emailOtp = generateOTP();
    const phoneOtp = generateOTP();
    const otpExpires = Date.now() + 5 * 60 * 1000; 

    const newUser = new userModel({
      fullName,
      email,
      phoneNumber,
      gender,
      dateOfBirth,
      stateOfOrigin,
      lga,
      address,
      stateScoutCouncil,
      scoutDivision,
      scoutDistrict,
      troop,
      scoutingRole,
      section,
      password: hashedPassword,
      emailOtp,
      phoneOtp,
      otpExpires
    });
    
    
    
    await sendMail({
      email,
      subject: "TSAN Welcome Email",
      text: `Your OTP`,
      html: welcomeMail(emailOtp, newUser.fullName)
    });
    
    await newUser.save();
    

    res.status(201).json({
      status: true,
      message: "Registration successful. Verify OTP sent to email and phone.",
      data: {
        userId: newUser._id }  
    });

  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Internal server error: ' + error.message
    });
  }
};

exports.verifyOtp = async (req, res) => {
    try {
      const { email, phoneNumber, otp } = req.body;
      
      if ((!email && !phoneNumber) || !otp) {
        return res.status(400).json({ status: false, message: "Email or phone number and OTP are required" });
      }
      
      const user = await userModel.findOne({
        $or: [
          { email: email?.toLowerCase() },
          { phoneNumber }
        ]
      }); 
      
      if (!user) {
          return res.status(404).json({ status: false, message: "User not found" });
      }
      if (user.emailVerified){
          return res.status(400).json({ status: false, message: "email Already Verified"})
      }

      if ( !user.otpExpires || user.otpExpires < Date.now()) {
        return res.status(400).json({ status: false, message: "OTP expired. Request a new one." });
      }

      let verified = false;
      
      
      if (user.emailOtp === otp) {
        user.emailVerified = true;
        verified = true;
      }
      
      if (phoneNumber && user.phoneOtp === otp) {
        user.phoneVerified = true; 
        verified = true;
      }
      
      if (!verified) {
        return res.status(400).json({ status: false, message: "Invalid OTP" });
      }
      
      
      if (!user.membershipId) {
        user.membershipId = await generateMembershipId(user.stateScoutCouncil, userModel);
      }
      
      
    
      if (user.emailVerified && user.phoneVerified) {
        user.emailOtp = undefined;
        user.phoneOtp = undefined;
        user.otpExpires = undefined;
      }   

      if (user.emailVerified === true){
        const invitation = await invitationModel.findOne({ email: (user.email || "").toLowerCase(), status: "pending" });
       
        if (invitation){
          const oldRole = user.role;
          if(invitation.expiresAt > new Date()){
            user.stateScoutCouncil = invitation.council;
            user.role = invitation.role;
             await Promise.all([
        user.save(),
        (async () => {
          invitation.status = "accepted";
          await invitation.save();
        })(),
        auditTrailModel.create({
          userId: user._id,
          field: "Invitation Promotion",
          oldValue: oldRole,
          newValue: invitation.role,
          changedBy: user.fullName,
          timestamp: new Date(),
          remarks: `User promoted via invitation (${invitation.role}) of ${invitation.council}`
        })
      ]);
           
          }else{
            invitation.status = "expired";
            await invitation.save();
            
          // 🧾 Save expiration record in audit trail
          await auditTrailModel.create({
            userId: user._id,
            field: "Invitation Expired",
            oldValue: "Pending Invitation ",
            newValue: "Expired",
            changedBy: user.fullName,
            remarks: `Invitation expired before verification.`,
          });
          }
        }
      }

      res.status(200).json({
        status: true,
        message: "OTP verified successfully",
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        membershipId: user.membershipId
      });

    } catch (error) {
      
      
      res.status(500).json({ 
        status: false,
        message: "Internal server error: " + error.message });
    }
};

exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await userModel.findOne({email});

    if (!user) return res.status(404).json({ status: false, message: "User not found" });

    if (user.emailVerified && user.phoneVerified) {
      return res.status(400).json({ status: false, message: `User already verified. Membership ID: ${user.membershipId}` });
    }

    if (user.otpExpires && user.otpExpires > Date.now()) {
      return res.status(429).json({ status: false, message: "OTP recently sent. Please wait for 5 minutes before requesting again." });
    }

    const emailOtp = generateOTP();
    const phoneOtp = generateOTP();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    user.emailOtp = emailOtp;
    user.phoneOtp = phoneOtp;
    user.otpExpires = otpExpires;

    
    await sendMail({
      email: user.email,
      subject: "TSAN Email Verification - Resend OTP",
      text: `Your new OTP`,
      html: welcomeMail( emailOtp, user.fullName)
    });    
    
    await user.save();
    res.status(200).json({
      status: true,
      message: "OTP resent successfully. Check your email and phone.",
      userId: user._id
    });

  } catch (error) {
     res.status(500).json({
      status: false,
      message: 'Internal server error: ' + error.message
    });
  }
};

exports.setupMfa = async (req, res) => {
  try {
    const { userId, method } = req.body; 
    const user = await userModel.findById(userId);
    if (!user) return res.status(404).json({ status:false, message: "User not found" });

    
    let responseData = {};

    switch (method) {
      case "authenticator":
       
        const secret = speakeasy.generateSecret({
          name: `TSAN (${user.email})`,
          length: 20,
        });

        user.authAppSecret = secret.base32;
        user.authAppEnabled = false; 
        await user.save();

        
        const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

        responseData = {
          message: "Scan this QR code with your Authenticator app",
          qrCodeUrl,
          secret: secret.base32,
        };
        break;

      case "email":
        
        const emailOtp = Math.floor(100000 + Math.random() * 900000);
        user.emailOtp = emailOtp;
        user.otpExpires = Date.now() + 10 * 60 * 1000; 
        await user.save();

       
        await sendMail({
            email: user.email,
            subject: "Your TSAN 2FA Code",
            text: `Your OTP is ${emailOtp}`,
            html: mfaEmailTemplate(user.fullName, emailOtp)
             
            });

        responseData = {
          message: "OTP has been sent to your email",
          emailOtp, 
        }
        break;
      case "phone":
        const phoneOtp = Math.floor(100000 + Math.random() * 900000);
        user.phoneOtp = phoneOtp;
        user.otpExpires = Date.now() + 10 * 60 * 1000;
        await user.save();
       
        responseData = {
          message: "OTP has been sent to your phone",
          phoneOtp, 
        };
        break;

      default:
        return res.status(400).json({ status: false, message: "Invalid MFA method" });
    }

    res.status(200).json({
      status: true,
      data: responseData
    });

  } catch (error) {
    res.status(500).json({ 
      status: false,
      message: "Internal server error: " + error.message 
    });
  }
};

exports.setupTwofa = async (req, res) => {
  try {
    const { userId } = req.body;  

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }
    if (user.emailAuth) {
      return res.status(400).json({
        status: false,
        message: "Email 2FA is already enabled",
      });
    }

    // Generate OTP
    const emailOtp = Math.floor(100000 + Math.random() * 900000);
    user.emailOtp = emailOtp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; 
    await user.save();
    
    await sendMail({
      email: user.email,
      subject: "Your TSAN 2FA Code",
      text: `Your OTP is ${emailOtp}`,
      html: twoFAMail(emailOtp, user.fullName),
    });

    res.status(200).json({
      status: true,
      data: {
        message: "OTP has been sent to your email",
      },
    });

  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};

exports.verifyMfaSetup = async (req, res) => {
  try {
    const { userId, token, method } = req.body; 
    const user = await userModel.findById(userId);
    if (!user) return res.status(404).json({ status: false, message: "User not found" });

    let verified = false;

    switch (method) {
      case "authenticator":
        verified = speakeasy.totp.verify({
          secret: user.authAppSecret,
          encoding: "base32",
          token,
          window: 1
        });

        if (verified) user.authAppEnabled = true;
        break;

      case "email":
        if (
          user.emailOtp &&
          user.otpExpires &&
          Date.now() < user.otpExpires &&
          String(token) === String(user.emailOtp)
        ) {
          verified = true;
          user.emailAuth = true;
          user.emailOtp = undefined; // clear OTP
          user.otpExpires = undefined;
        }
        break;

      case "phone":
        if (
          user.phoneOtp &&
          user.otpExpires &&
          Date.now() < user.otpExpires &&
          String(token) === String(user.phoneOtp)
        ) {
          verified = true;
          user.phoneAuth = true;
          user.phoneOtp = undefined; // clear OTP
          user.otpExpires = undefined;
        }
        break;

      default:
        return res.status(400).json({ status: false, message: "Invalid 2FA method" });
    }

    if (!verified) {
      return res.status(400).json({ status: false, message: "Invalid or expired 2FA code" });
    }

    await user.save();

    res.status(200).json({
      status: true,
      message: `${method} 2FA enabled successfully`
    });
  } catch (error) {
    res.status(500).json({ 
        status: false,
        message: "Internal server error: " + error.message });
  }
};

exports.disableMfa = async (req, res) => {
  try {
    const { userId, method } = req.body;
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    switch (method) {
      case "authenticator":
        user.authAppEnabled = false;
        user.authAppSecret = undefined; // optional: clear secret if you don’t want reuse
        break;

      case "email":
        user.emailAuth = false;
        user.emailOtp = undefined;
        user.otpExpires = undefined;
        break;

      case "phone":
        user.phoneAuth = false;
        user.phoneOtp = undefined;
        user.otpExpires = undefined;
        break;

      default:
        return res.status(400).json({ status: false, message: "Invalid MFA method" });
    }

    await user.save();

    res.status(200).json({
      status: true,
      message: `${method} 2FA disabled successfully`,
    });

  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { email, ...updates } = req.body; 

    if (!email) {
      return res.status(400).json({ status: false, message: "Email is required" });
    }

    const user = await userModel.findOne({ email }).select("-password");
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    if (req.file) { 
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "tsan_profiles"
      });
      user.profilePic = result.secure_url;
    }
   
    

    Object.keys(updates).forEach(field => {
      if (field !== "membershipId") {
        user[field] = updates[field];
      }
    });

    await user.save();

    return res.status(200).json({
      status: true,
      message: "Profile updated successfully",
      user
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body; 

    if (!email || !password) {
      return res.status(400).json({ status: false, message: "email  and password are required" });
    }

    // First find user with password for verification
    const user = await userModel.findOne({email});
    
    if (!user) return res.status(404).json({ status: false, message: "Invalid credentials" });
    
    // Create a user object without password for response
    const userWithoutPassword = user.toObject();
    delete userWithoutPassword.password;
    delete userWithoutPassword.emailOtp;
    delete userWithoutPassword.phoneOtp;
    delete userWithoutPassword.authAppSecret;


      if (user.lockUntil && user.lockUntil > Date.now()) {
        user.isLoggedIn = false;
      await user.save();
      const remaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(403).json({ status: false, message: `Account locked. Try again in ${remaining} minutes.` });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      const attemptLeft = 5 - user.failedLoginAttempts;

      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = Date.now() + 15 * 60 * 1000;
        user.isLoggedIn = false; 
        await user.save();
        return res.status(403).json({ status: false, message: "Too many failed attempts. Account locked for 15 minutes." });
      }

      await user.save();
      return res.status(401).json({ status: false, message: `Invalid credentials. you have ${attemptLeft} attempt(s) left before account lock. \n Use the Forgot password button` });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;

    if(user.emailAuth === true){
      const otp = generateOTP();
      user.emailOtp = otp;
      user.otpExpires = Date.now() + 10 * 60 * 1000;
      user.lastSignedIn = new Date();
      await user.save();      
      await sendMail ({
        email: user.email,
        subject: "Your Login OTP",
        text: `Your OTP is ${otp}`,
        html: twoFAMail(otp, user.fullName)
      });
      const tempToken = jwt.sign({
        id : user._id, mfa: true, method: "email",},
        process.env.JWT_SECRET,
        {expiresIn: "1h"}
      );
      return res.status(200).json({
        status: true,
        userInfo: userWithoutPassword,
        message: "Email authentication enabled. Please verify OTP.",
        tempToken,
      });
    }
    if (user.phoneAuth === true){
      const otp = generateOTP();
      user.phoneOtp = otp;
      user.otpExpires = Date.now() + 10 * 60 * 1000;
      await user.save();

      console.log(`send OTP ${otp} to ${user.phoneNumber}`);
      const tempToken = jwt.sign(
        { id : user._id, mfa: true, method: 'phone' },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );
      return res.status(200).json({
        status: true,
        message: "Phone authentication enabled. Please verify OTP.",
        tempToken,
      });
    }
    if (user.authAppEnabled === true){
      const tempToken = jwt.sign(
        {id : user._id, mfa: true, method: "authenticator" },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );
      user.lastSignedIn = new Date();
      await user.save();
      return res.status(200).json({
        status: true,
        message: "Authenticator app enabled. please verify using your app.",
        tempToken,
      });
    }

    const tempToken = jwt.sign(
      { id: user._id, mfa: false },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    user.isLoggedIn = true;
    user.lastSignedIn = new Date();
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Login successful.",
      token: tempToken,
      userInfo: userWithoutPassword
    });

  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message 
    });
  }
};

exports.verifyMfa = async (req, res) => {
  try {
    const { userId, emailOtp, phoneOtp, totp } = req.body;

    const user = await userModel.findById(userId).select("-password");
    if (!user) return res.status(404).json({status: false, message: "User not found" });

  
    // Only check expiration for email/phone OTPs
    if ((emailOtp || phoneOtp) && user.otpExpires && user.otpExpires < Date.now()) {
      return res.status(400).json({
        status: false,
         message: "OTP expired. Request a new one."
     });
}


    let verified = false;

    if (user.emailOtp === String(emailOtp)) {
      verified = true;
      
    }
    
    
    if (user.phoneOtp === Number(phoneOtp)) {
      verified = true;
      
    }
    
    if (totp && user.authAppEnabled) {
      const validTotp = speakeasy.totp.verify({
        secret: user.authAppSecret,
        encoding: "base32",
        token: totp,
        window: 1
      });
      if (validTotp) verified = true;
    }

    if (!verified ) 
    return res.status(400).json({
        status: false, 
        message: "Invalid MFA code" 
    });
    
    const finalToken = jwt.sign(
      { id: user._id, mfa: true },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    
    user.emailOtp = undefined;
    user.phoneOtp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({
      status: true,
      message: "MFA verified successfully",
      token: finalToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        membershipId: user.membershipId
      }
    });

  } catch (error) {
    res.status(500).json({ 
      status: false,
      message: "Internal server error: " + error.message 
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({status: false, message: "Email not found" });
    }

   
    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000; 
    user.resetOtp = otp;
    user.resetOtpExpires = otpExpires;
    await user.save();

    await sendMail({
  email,
  subject: `Password Reset OTP - ${user.fullName}`,
  text: 'forgotten password',
  html: resetPasswordMail(otp, user.fullName)
      
    });

    return res.status(200).json({ 
      status: true,
      message: "Password reset OTP sent successfully to your email."
     
    });

  } catch (error) {
    res.status(500).json({ 
      status: false,
      message: error.message });
  }
};

exports.resetNewPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ status: false, message: "Email, OTP, and new password are required" });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    // Validate OTP
    if (!user.resetOtp || user.resetOtp !== otp || user.resetOtpExpires < Date.now()) {
      return res.status(400).json({ status: false, message: "Invalid or expired OTP" });
    }


    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Clear OTP
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();

    res.status(200).json({ 
      status: true,
      message: "Password reset successful" });

  } catch (error) {
    res.status(500).json({ 
      status: false,
      message: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id; 

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ status: false, message: "Current password is incorrect" });
    }

   
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({ 
      status: true,
      message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ 
      status: false,
      message: error.message });
  }
};

exports.getOneScout = async (req, res) => {
  try {
    const { id } = req.params; 

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "User ID is required",
      });
    }

    const user = await userModel.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      status: true,
      message: "User fetched successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};

exports.getScoutsByState = async (req, res) => {
  try {
    const { stateScoutCouncil } = req.params;

    if (!stateScoutCouncil) {
      return res.status(400).json({
        status: false,
        message: "State Scout Council is required"
      });
    }

    const scouts = await userModel.find({ stateScoutCouncil }).select("-password");

    if (!scouts.length) {
      return res.status(404).json({
        status: false,
        message: `No scouts found in ${stateScoutCouncil}`
      });
    }

    res.status(200).json({
      status: true,
      message: `Scouts from ${stateScoutCouncil} retrieved successfully`,
      count: scouts.length,
      scouts
    });

  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message
    });
  }
};

exports.getScoutsBySection = async (req, res) => {
  try {
    const { section } = req.params;

    const scouts = await userModel.find({ section }).select("-password");

    if (!scouts || scouts.length === 0) {
      return res.status(404).json({
        status: false,
        message: `No scouts found in section: ${section}`
      });
    }

    res.status(200).json({
      status: true,
      message: "Scouts fetched successfully",
      count: scouts.length,
      data: scouts
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message
    });
  }
};

exports.getScoutsByStateAndSection = async (req, res) => {
  try {
    const { stateScoutCouncil, section } = req.params;

    const scouts = await userModel.find({
      stateScoutCouncil,
      section
    }).select("-password");

    if (!scouts || scouts.length === 0) {
      return res.status(404).json({
        status: false,
        message: `No scouts found in state: ${stateScoutCouncil} under section: ${section}`
      });
    }

    res.status(200).json({
      status: true,
      message: "Scouts fetched successfully",
      count: scouts.length,
      data: scouts
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message
    });
  }
};

exports.deleteUserAndAssociations = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ status: false, message: "User ID is required" });
    }

    const user = await userModel.findById(id);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    // ✅ Role-based restriction for ssAdmin
    if (
      req.user.role === "ssAdmin" &&
      user.stateScoutCouncil !== req.user.stateScoutCouncil
    ) {
      return res.status(403).json({ status: false, message: "Access denied" });
    }

    // Helper function to safely delete images from Cloudinary
    const deleteImage = async (url) => {
      if (!url) return;
      const publicId = url.split("/").slice(-1)[0].split(".")[0];
      await cloudinary.uploader.destroy(publicId).catch(() => {});
    };

    // ✅ Delete Logs
    const logs = await ActivityLog.find({ createdBy: id });
    for (const log of logs) {
      if (log.imageUrl) await deleteImage(log.imageUrl);
    }
    await ActivityLog.deleteMany({ createdBy: id });

    // ✅ Delete Awards
    const awards = await awardProgressModel.find({ createdBy: id });
    for (const award of awards) {
      if (award.certificateUrl) await deleteImage(award.certificateUrl);
    }
    await awardProgressModel.deleteMany({ createdBy: id });

    // ✅ Delete Trainings
    const trainings = await trainingModel.find({ createdBy: id });
    for (const training of trainings) {
      if (training.certificateUrl) await deleteImage(training.certificateUrl);
    }
    await trainingModel.deleteMany({ createdBy: id });

    // ✅ Delete Events
    const events = await eventModel.find({ createdBy: id });
    for (const event of events) {
      if (event.imageUrl) await deleteImage(event.imageUrl);
    }
    await eventModel.deleteMany({ createdBy: id });

    // ✅ Delete user profile image if exists
    if (user.profileImage) await deleteImage(user.profileImage);
    
        // ✅ Audit trail logging
        await auditTrailModel.create({
          userId: user._id,
          field: "deleting a Scout",
          oldValue: user.fullName,
          newValue: "deleted a user",
          changedBy: req.user._id,
          remarks: `${req.user.fullName} (${req.user.role}) deleted ${user.fullName} from Tsan Platform`,
          timestamp: new Date(),
        });

    // ✅ Finally, delete the user
    await userModel.findByIdAndDelete(id);

    res.status(200).json({
      status: true,
      message: "User and all related records deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting user:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


// members can update limited field while admin will update all fields
exports.updateUserProfile = async (req, res) => {
    try {
      const userId = req.user._id;
      const updates = req.body;
      
      const user = await userModel.findById(userId).select("-password");
      
      
      if (!user) return res.status(404).json({status: false, message: "User not found" });

      let editableFields;
      if (["ssAdmin", "nsAdmin", "superAdmin"].includes(user.role)){
        editableFields = Object.keys(user._doc).filter(
          (key) => !["_id", "email", "password", "role", "createdAt", "updatedAt"].includes(key)
        );
      }else{
        editableFields =
        ["scoutingRole",
           "fullName",
           "phoneNumber",
           "address",
           "scoutDivision",
           "scoutDistrict",
           "troop" ];
      }
       // ✅ Handle profilePic (Multer file OR base64 string)
    if (req.file) {
      // Case 1: Image uploaded as a file
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "tsan_profiles",
        });
        user.profilePic = result.secure_url;

        // Remove temp file
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Failed to remove temp file:", err);
        });
      } catch (uploadErr) {
        console.error("Cloudinary upload failed:", uploadErr);
        return res
          .status(500)
          .json({ status: false, message: "Profile picture upload failed" });
      }
    } else if (updates.profilePic && updates.profilePic.startsWith("data:image")) {
      // Case 2: Base64 image string
      try {
        const result = await cloudinary.uploader.upload(updates.profilePic, {
          folder: "tsan_profiles",
        });
        user.profilePic = result.secure_url;
      } catch (uploadErr) {
        console.error("Cloudinary upload (base64) failed:", uploadErr);
        return res.status(500).json({
          status: false, 
          message: "Profile picture upload failed" 
        });
      }
    }
    if (updates.phoneNumber && updates.phoneNumber !== user.phoneNumber) {
      const existingPhone = await userModel.findOne({ phoneNumber: updates.phoneNumber });
      if (existingPhone && existingPhone._id.toString() !== user._id.toString()) {
        return res.status(400).json({
          status: false,
          message: "Phone number already in use by another user.",
        });
      }
    }
    
    // ✅ Update editable fields
    for (const field of editableFields) {
      if (updates[field] && updates[field] !== user[field]) {
        if (field === "scoutingRole") {
          await auditTrailModel.create({  
            userId: user._id,
            field,
            oldValue: user[field] || "",
            newValue: updates[field],
            changedBy: user.email,
          });
        }
        user[field] = updates[field];
      }
    }


      await user.save();
      res.status(200).json({ status: true, message: "Profile updated successfully", user });

    } catch (error) {
      
      res.status(500).json({ status: false, message: "Internal Server Error" + error.message });
    }
  };


exports.getAuditTrail = async (req, res) => {
  try {
    const { userId } = req.params;

    
    const userExists = await userModel.findById(userId).select("-password");
    if (!userExists) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    const auditRecords = await auditTrailModel.find({ userId })
      .sort({ timestamp: -1 })
      .lean();

    if (auditRecords.length === 0) {
      return res.status(404).json({ status: false, message: 'No audit trail found for this user' });
    }

    return res.status(200).json({
      status: true,
      message: 'Audit trail retrieved successfully',
      auditTrail: auditRecords
    });
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  }
};

exports.verifyEmailTwofa = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    const user = await userModel.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    // Check if OTP matches and is not expired
    if (
      !user.emailOtp ||
      user.emailOtp.toString() !== otp.toString() ||
      Date.now() > user.otpExpires
    ) {
      return res.status(400).json({
        status: false,
        message: "Invalid or expired OTP",
      });
    }
    if (user.emailAuth) {
      return res.status(400).json({
        status: false,
        message: "Email 2FA is already enabled",
      });
    }

    // Mark email 2FA as active
    user.emailAuth = true;
    user.emailOtp = undefined; // clear OTP
    user.otpExpires = undefined;
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Email 2FA has been enabled successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};

exports.disableEmailTwofa = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await userModel.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    if (!user.emailAuth) {
      return res.status(400).json({
        status: false,
        message: "Email 2FA is not currently enabled",
      });
    }

    user.emailAuth = false;
    user.emailOtp = undefined;
    user.otpExpires = undefined;
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Email 2FA has been disabled successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};

exports.verifyTwofaEmailOtp = async (req, res) => {
  try {
    const { userId, emailOtp } = req.body;

    if (!userId || !emailOtp) {
      return res.status(400).json({
        status: false,
        message: "User ID and OTP are required",
      });
    }

    const user = await userModel.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    
    if (
      !user.emailOtp ||
      user.emailOtp.toString() !== emailOtp.toString() ||
      !user.otpExpires ||
      Date.now() > user.otpExpires
    ) {
      return res.status(400).json({
        status: false,
        message: "Invalid or expired OTP",
      });
    }

   
    const finalToken = jwt.sign(
      { id: user._id, mfa: true },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    
    user.emailOtp = undefined;
    user.otpExpires = undefined;
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Email 2FA verified successfully",
      token: finalToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        membershipId: user.membershipId,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};

exports.getUserDashboardSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    
    const [totalTrainings, totalAwards, totalEvents, totalLogs ] = await Promise.all([
      trainingModel.countDocuments({ scout: userId }),
      awardProgressModel.countDocuments({ scout: userId }),
      eventModel.countDocuments({ createdBy: userId }),
      ActivityLog.countDocuments({ scout : userId })
    ]);

    const achievement = totalTrainings + totalAwards;

    res.status(200).json({
      status: true,
      message: "User dashboard summary fetched successfully ",
      data: {
        totalLogs,
        totalEvents,
        achievement
      },
    });
  } catch (error) {
    console.error("Error fetching user dashboard summary:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};
