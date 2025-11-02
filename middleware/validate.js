const Joi = require("joi");

exports.validateRegister = (req, res, next) => {
    if (req.body.gender) {
    req.body.gender = req.body.gender.charAt(0).toUpperCase() + req.body.gender.slice(1).toLowerCase();
  }
  if (req.body.section) {
    req.body.section = req.body.section.charAt(0).toUpperCase() + req.body.section.slice(1).toLowerCase();
  }

  const schema = Joi.object({
    
    fullName: Joi.string().min(3).required(),
    email: Joi.string().email().required(),
    phoneNumber: Joi.string().required(),
    gender: Joi.string().valid('Male', 'Female', 'Other').required(),
    dateOfBirth: Joi.date().required(),
    stateOfOrigin: Joi.string().valid(
   "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue",
   "Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT",  
   "Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara",
   "Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers",
   "Sokoto","Taraba","Yobe","Zamfara").required(),
    lga: Joi.string().min(2).required(),
    address: Joi.string().min(5).required(),
    stateScoutCouncil: Joi.string().required(),
    scoutDivision: Joi.string().required(),
    scoutDistrict: Joi.string().optional().allow(null, ''),
    troop: Joi.string().optional().allow(null, ''),
    scoutingRole: Joi.string().optional().allow(null, ''),
    section: Joi.string().valid('Cub', 'Scout', 'Venturer', 'Rover', 'Volunteers').insensitive().required(),
    password: Joi.string().min(8)
    .pattern(new RegExp("^(?=.*[A-Z])"))
    .pattern(new RegExp("^(?=.*[0-9])")).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  next();
};


exports.validateLogin = (req, res, next) => {
  const schema = Joi.object({
    
    email: Joi.string().required().messages({
      "any.required": "email is required",
      "string.empty": "email cannot be empty",
    }),
    password: Joi.string().required().messages({
      "any.required": "Password is required",
      "string.empty": "Password cannot be empty",
    }),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  next();
};

exports.validatePassword = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        "string.email": "Must be a valid email",
        "any.required": "Email is required"
      }),
    otp: Joi.string()
      .length(6)
      .required()
      .messages({
        "string.length": "OTP must be 6 digits",
        "any.required": "OTP is required"
      }),
    password: Joi.string()
      .min(8)
      .pattern(new RegExp("^(?=.*[A-Z])")) 
      .pattern(new RegExp("^(?=.*[0-9])")) 
      .required()
      .messages({
        "string.min": "Password must be at least 8 characters long",
        "string.pattern.base": "Password must include uppercase and number",
        "string.empty": "Password cannot be empty",
        "any.required": "Password is required"
      }),

    confirmPassword: Joi.string()
      .valid(Joi.ref("password"))
      .required()
      .messages({
        "any.only": "Passwords must match",
        "string.empty": "Confirm password cannot be empty"
      }),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  next();
};

exports.validateChangePassword = (req, res, next) => {
  const schema = Joi.object({
    oldPassword: Joi.string().required().messages({
      "any.required": "Current password is required",
      "string.empty": "Current password cannot be empty"
    }),
    newPassword: Joi.string()
      .min(8)
      .pattern(new RegExp("^(?=.*[A-Z])(?=.*[0-9])"))
      .required()
      .messages({
        "string.min": "Password must be at least 8 characters long",
        "string.pattern.base": "Password must include uppercase and number",
        "any.required": "New password is required",
        "string.empty": "New password cannot be empty"
      }),
    confirmPassword: Joi.string()
      .valid(Joi.ref("newPassword"))
      .required()
      .messages({
        "any.only": "Passwords must match",
        "any.required": "Confirm password is required",
        "string.empty": "Confirm password cannot be empty"
      }),
  });

  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  next();
};
