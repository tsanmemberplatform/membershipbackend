const Payment = require("../models/paymentModel");
const IdPurchase = require("../models/idPurchaseModel");
const crypto = require("crypto");
const qrcode = require("qrcode");
const { userModel } = require("../models/userModel");
const { getPaymentUrls } = require("../utils/paymentUrls");

const getIdCardPrice = (section) => {
  if (section === "Cub") return 1000;
  if (["Scout", "Venturer", "Rover"].includes(section)) return 1500;
  return 3000;
};

const buildQrPayload = ({ membershipId, userId, purchaseId }) => {
  const body = `${membershipId}|${userId}|${purchaseId}|${Date.now()}`;
  const sig = crypto
    .createHmac("sha256", process.env.QR_SIGNING_SECRET)
    .update(body)
    .digest("hex");
  return `${body}|${sig}`;
};

exports.requestIdCard = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) return res.status(404).json({ status: false, message: "User not found" });

    if (user.idCard?.paid) {
      return res.status(400).json({ status: false, message: "ID card already paid for" });
    }

    const existingRequest = await IdPurchase.findOne({
      user: user._id,
      status: { $in: ["pending", "paid", "confirmed"] },
    }).populate("payment");

    if (existingRequest) {
      return res.status(400).json({
        status: false,
        message: "You already have an active ID card request",
        data: {
          requestStatus: existingRequest.status,
          reference: existingRequest?.payment?.reference || null,
        },
      });
    }

    const amount = getIdCardPrice(user.section);
    const reference = `ID-${Date.now()}-${user._id}`;
    const { notificationUrl, redirectUrl } = getPaymentUrls(req);

    const payment = await Payment.create({
      user: user._id,
      amount,
      paymentType: "id_card",
      reference,
    });

    const idPurchase = await IdPurchase.create({
      user: user._id,
      payment: payment._id,
    });

    const gatewayResponse = await fetch(
      `${process.env.KORA_BASE_URL}/api/v1/charges/initialize`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.KORA_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: payment.amount,
          currency: "NGN",
          reference: payment.reference,
          customer: {
            name: user.fullName,
            email: user.email,
          },
          redirect_url: redirectUrl,
        }),
      }
    );

    const gatewayData = await gatewayResponse.json();
    if (!gatewayResponse.ok || !gatewayData?.data?.checkout_url) {
      await IdPurchase.findByIdAndDelete(idPurchase._id);
      await Payment.findByIdAndDelete(payment._id);

      return res.status(502).json({
        status: false,
        message: "Unable to initialize payment with provider",
        providerResponse: gatewayData,
      });
    }

    return res.status(201).json({
      status: true,
      message: "ID card request initiated",
      data: {
        amount,
        reference,
        notificationUrl,
        redirectUrl,
        paymentLink: gatewayData.data.checkout_url,
      },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.resetIdCardRequest = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Find the ID Purchase record
    const idPurchase = await IdPurchase.findOne({ user: userId });

    if (idPurchase) {
      // 2. Delete the associated Payment if it exists
      if (idPurchase.payment) {
        await Payment.findByIdAndDelete(idPurchase.payment);
      }
      // 3. Delete the ID Purchase record
      await IdPurchase.findByIdAndDelete(idPurchase._id);
    }

    // 4. Reset the user's paid status in the database
    await userModel.findByIdAndUpdate(userId, {
      $set: { "idCard.paid": false }
    });

    return res.status(200).json({
      status: true,
      message: "Test cleanup successful: ID card request and payment records deleted, user status reset.",
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateIdStatus = async (req, res) => {
  try {
    const { userId, status } = req.body;
    const purchase = await IdPurchase.findOne({ user: userId });

    if (!purchase) {
      return res.status(404).json({ status: false, message: "No ID request found" });
    }

    purchase.status = status;
    await purchase.save();

    if (status === "completed") {
      const user = await userModel.findById(userId);
      if (!user?.membershipId) {
        return res
          .status(400)
          .json({ status: false, message: "Users must verify their account before requesting an ID card." });
      }

      const payload = buildQrPayload({
        membershipId: user.membershipId,
        userId: user._id.toString(),
        purchaseId: purchase._id.toString(),
      });
      const imageDataUrl = await qrcode.toDataURL(payload);

      purchase.qrCode = {
        payload,
        imageDataUrl,
        generatedAt: new Date(),
        isActive: true,
        lastScannedAt: null,
      };
      await purchase.save();
    }

    return res.json({
      status: true,
      message: "ID process updated",
      data: purchase,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.getMyIdStatus = async (req, res) => {
  try {
    const purchase = await IdPurchase.findOne({ user: req.user.id }).populate("payment");
    return res.json({
      status: true,
      data: purchase,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.verifyQr = async (req, res) => {
  try {
    const { payload } = req.body;

    const parts = payload.split("|");

    if (parts.length < 5) {
      return res.status(400).json({ valid: false, message: "Invalid QR format" });
    }

    const [membershipId, userId, purchaseId, timestamp, signature] = parts;

    const body = `${membershipId}|${userId}|${purchaseId}|${timestamp}`;

    const expectedSig = crypto
      .createHmac("sha256", process.env.QR_SIGNING_SECRET)
      .update(body)
      .digest("hex");

    if (signature !== expectedSig) {
      return res.status(400).json({
        valid: false,
        message: "QR code has been tampered with"
      });
    }

    const user = await userModel.findById(userId);
    const purchase = await IdPurchase.findById(purchaseId);

    if (!user || !purchase) {
      return res.status(404).json({
        valid: false,
        message: "Invalid ID record"
      });
    }

    if (!purchase.qrCode?.isActive) {
      return res.status(400).json({
        valid: false,
        message: "QR is inactive"
      });
    }

    // 📊 Track scan
    purchase.qrCode.lastScannedAt = new Date();
    await purchase.save();

    return res.json({
      valid: true,
      data: {
        name: user.fullName,
        membershipId: user.membershipId,
        section: user.section,
        status: user.status
      }
    });

  } catch (err) {
    return res.status(500).json({
      valid: false,
      message: err.message
    });
  }
};
