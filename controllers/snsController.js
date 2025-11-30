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
