// snsController.js
exports.snsWebhook = (req, res) => {
  try {
    
    console.log("SNS Message Received:", req.body);
    
    // SNS sends JSON string as a message
    const message = JSON.parse(req.body.Message);
    console.log("Parsed SNS Message:", message);
    
    res.status(200).send("OK");  
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.Message
    })
    
  }
};

const axios = require("axios");

exports.snsWebhook = async (req, res) => {
  try {
    console.log("SNS RAW BODY:", req.body);

    const messageType = req.headers["x-amz-sns-message-type"];
    const snsMessage = req.body;

    // 1️⃣ HANDLE SNS SUBSCRIPTION CONFIRMATION
    if (messageType === "SubscriptionConfirmation") {
      console.log("SNS Subscription Confirmation Received");
      console.log("Confirming URL:", snsMessage.SubscribeURL);

      await axios.get(snsMessage.SubscribeURL);
      console.log("✔ Subscription Confirmed!");

      return res.status(200).send("Subscription Confirmed");
    }

    // 2️⃣ HANDLE ACTUAL NOTIFICATIONS
    if (messageType === "Notification") {
      console.log("SNS Notification Received:", snsMessage);

      const parsedMessage = JSON.parse(snsMessage.Message);
      console.log("Parsed Message:", parsedMessage);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.log("SNS Webhook Error:", error);
    res.status(500).send("Error");
  }
};
