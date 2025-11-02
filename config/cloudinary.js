const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.Cloud_name,
  api_key: process.env.API_key,
  api_secret: process.env.API_secret,
  API_environment_variable: process.env.API_environment_variable
 });


module.exports = cloudinary;