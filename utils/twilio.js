require("dotenv").config();
const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

client.messages
  .create({
    body: "Hello from Twilio! ",
    from: process.env.TWILIO_PHONE_NUMBER,
    to: "+2349136505772" 
  })
  .then(message => console.log(" SMS sent:", message.sid))
  .catch(err => console.error(" Error:", err));
