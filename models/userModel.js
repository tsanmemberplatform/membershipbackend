const mongoose = require('mongoose');

  const userSchema = new mongoose.Schema({
    membershipId: {
      type: String,
      default: null
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
  validate: {
    validator: function(v) {
      return /^[0-9]{11}$/.test(v);
    },
    message: props => `${props.value} is not a valid phone number. It must be exactly 11 digits.`
  }
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      required: true,
      set: v => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()
    },
    dateOfBirth: {
      type: Date,
      required: true
    },
    stateOfOrigin: {
    type: String,
    required: true,
    enum: [
      "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue",
      "Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT",
      "Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara",
      "Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers",
      "Sokoto","Taraba","Yobe","Zamfara"
    ]
  },
  lga: {
    type: String,
    required: true,
    trim: true
  },
  address:{
    type: String,
    required: true,
    trim: true
  },
    stateScoutCouncil: {
      type: String,
      required: true,
      trim: true
    },
    scoutDivision: {
      type: String,
      required: true,
      trim: true
    },
    scoutingRole: {
    type: String,
    trim: true,
    default: null
    },
    scoutDistrict: {
      type: String,
      trim: true,
      default: null
    },
    troop: {
      type: String,
      trim: true
        },
    section: {
      type: String,
      enum: ['Cub', 'Scout', 'Venturer', 'Rover', 'Volunteers'],
      default: 'Volunteers',
      required: true
    },
    profilePic: {
      type: String,
      default: null
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    failedLoginAttempts: { 
      type: Number, 
      default: 0 
    },
    lockUntil: { 
      type: Date 
    },
    isLoggedIn: { 
      type: Boolean, 
      default: false 
    },
    role: {
      type: String,
      default: 'member',
      enum: ['member','leader', 'ssAdmin', 'nsAdmin', 'superAdmin']
    },
    status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    authAppEnabled: {
      type: Boolean, 
      default: false 
    },
    emailAuth: {
      type: Boolean, 
      default: false 
    },
    phoneAuth: {
      type: Boolean, 
      default: false 
    },
    authAppSecret: {
      type: String 
    },
    emailOtp: {
      type: String
    },
    phoneOtp: {
      type: String
    },
    otpExpires: {
      type: Date,
      default: null
    },
    resetOtp: { 
      type: String 
    },
    resetOtpExpires: { 
      type: Date 
    },
    lastSignedIn: { type: Date, default: null },
  }, { timestamps: true });

  exports.userModel = mongoose.model('User', userSchema);