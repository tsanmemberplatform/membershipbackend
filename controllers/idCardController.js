const mongoose = require("mongoose");
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

const ADMIN_ROLES = ["distAdmin", "ssAdmin", "nsAdmin", "superAdmin"];

const getAdminScopeMatch = (adminUser) => {
  if (adminUser.role === "distAdmin") {
    if (!adminUser.scoutDistrict) {
      throw new Error("distAdmin has no scoutDistrict assigned");
    }
    return { scoutDistrict: adminUser.scoutDistrict };
  }

  if (adminUser.role === "ssAdmin") {
    if (!adminUser.stateScoutCouncil) {
      throw new Error("ssAdmin has no stateScoutCouncil assigned");
    }
    return { stateScoutCouncil: adminUser.stateScoutCouncil };
  }

  return {}; // nsAdmin + superAdmin
};

const UI_FULFILLMENT_MAP = {
  pending: "Pending",
  paid: "Pending",
  generated: "Generated",
  cancelled: "Cancelled",
  failed: "Failed",
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
      status: { $in: ["pending", "paid", "generated"] },
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

    if (status === "generated") {
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
exports.getAllIdRequestsAdmin = async (req, res) => {
  try {
    const admin = req.user;
    const { page = 1, limit = 10, section, paymentStatus, fulfillmentStatus, search } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const matchStage = {};
    const userMatch = {};
    const paymentMatch = {};

    if (admin.role === "distAdmin") {
      if (!admin.scoutDistrict) {
        return res.status(400).json({ status: false, message: "distAdmin has no scoutDistrict assigned" });
      }
      userMatch.scoutDistrict = admin.scoutDistrict;
    } else if (admin.role === "ssAdmin") {
      if (!admin.stateScoutCouncil) {
        return res.status(400).json({ status: false, message: "ssAdmin has no stateScoutCouncil assigned" });
      }
      userMatch.stateScoutCouncil = admin.stateScoutCouncil;
    }

    if (section) userMatch.section = section;

    if (paymentStatus) {
      const allowed = ["pending", "successful", "failed"];
      if (!allowed.includes(String(paymentStatus).toLowerCase())) {
        return res.status(400).json({ status: false, message: "Invalid paymentStatus filter" });
      }
      paymentMatch.status = String(paymentStatus).toLowerCase();
    }

    if (fulfillmentStatus) {
      const mapped = mapUiFulfillmentToDb(fulfillmentStatus);
      if (!mapped) {
        return res.status(400).json({ status: false, message: "Invalid fulfillmentStatus filter" });
      }
      matchStage.status = { $in: mapped };
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $lookup: {
          from: "payments",
          localField: "payment",
          foreignField: "_id",
          as: "payment",
        },
      },
      { $unwind: { path: "$payment", preserveNullAndEmptyArrays: true } },
    ];

    if (Object.keys(userMatch).length) pipeline.push({ $match: Object.fromEntries(Object.entries(userMatch).map(([k, v]) => [`user.${k}`, v])) });
    if (Object.keys(paymentMatch).length) pipeline.push({ $match: Object.fromEntries(Object.entries(paymentMatch).map(([k, v]) => [`payment.${k}`, v])) });

    if (search) {
      const s = String(search).trim();
      pipeline.push({
        $match: {
          $or: [
            { "user.fullName": { $regex: s, $options: "i" } },
            { "user.membershipId": { $regex: s, $options: "i" } },
            { "payment.reference": { $regex: s, $options: "i" } },
          ],
        },
      });
    }

    pipeline.push(
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNum },
            {
              $project: {
                _id: 1,
                status: 1,
                createdAt: 1,
                updatedAt: 1,
                "user._id": 1,
                "user.fullName": 1,
                "user.membershipId": 1,
                "user.section": 1,
                "user.scoutDistrict": 1,
                "user.stateScoutCouncil": 1,
                "payment._id": 1,
                "payment.reference": 1,
                "payment.amount": 1,
                "payment.status": 1,
              },
            },
          ],
          totalCount: [{ $count: "count" }],
        },
      }
    );

    const [result] = await IdPurchase.aggregate(pipeline);
    const rows = result?.data || [];
    const total = result?.totalCount?.[0]?.count || 0;

    const data = rows.map((r) => ({
      requestId: r._id,
      scoutName: r.user?.fullName || null,
      membershipId: r.user?.membershipId || null,
      section: r.user?.section || null,
      scoutDistrict: r.user?.scoutDistrict || null,
      stateScoutCouncil: r.user?.stateScoutCouncil || null,
      amount: r.payment?.amount ?? null,
      paymentReference: r.payment?.reference || null,
      paymentStatus: r.payment?.status || "pending",
      fulfillmentStatus: UI_FULFILLMENT_MAP[r.status] || "Pending",
      rawStatus: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return res.status(200).json({
      status: true,
      message: "ID requests fetched successfully",
      pagination: {
        total,
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        limit: limitNum,
      },
      data,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.getSinglePaidIdRequestAdmin = async (req, res) => {
  try {
    const { requestId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ status: false, message: "Invalid requestId" });
    }

    const purchase = await IdPurchase.findById(requestId)
      .populate("user", "fullName membershipId section scoutDistrict stateScoutCouncil status")
      .populate("payment");

    if (!purchase) {
      return res.status(404).json({ status: false, message: "ID request not found" });
    }

    if (!isWithinAdminJurisdiction(req.user, purchase.user)) {
      return res.status(403).json({ status: false, message: "Access denied for this jurisdiction" });
    }

    if (purchase.payment?.status !== "successful") {
      return res.status(400).json({
        status: false,
        message: "This request is not paid yet",
      });
    }

    return res.status(200).json({
      status: true,
      data: {
        requestId: purchase._id,
        fulfillmentStatus: UI_FULFILLMENT_MAP[purchase.status] || "Pending",
        rawStatus: purchase.status,
        user: purchase.user,
        payment: purchase.payment,
        qrCode: purchase.qrCode,
        createdAt: purchase.createdAt,
        updatedAt: purchase.updatedAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.approveAndGenerateIdRequestAdmin = async (req, res) => {
  try {
    const { requestId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ status: false, message: "Invalid requestId" });
    }

    const purchase = await IdPurchase.findById(requestId)
      .populate("user")
      .populate("payment");

    if (!purchase) {
      return res.status(404).json({ status: false, message: "ID request not found" });
    }

    if (!isWithinAdminJurisdiction(req.user, purchase.user)) {
      return res.status(403).json({ status: false, message: "Access denied for this jurisdiction" });
    }

    if (purchase.payment?.status !== "successful") {
      return res.status(400).json({ status: false, message: "Cannot generate ID before successful payment" });
    }

    if (!purchase.user?.membershipId) {
      return res.status(400).json({ status: false, message: "User has no membershipId" });
    }

    const payload = buildQrPayload({
      membershipId: purchase.user.membershipId,
      userId: purchase.user._id.toString(),
      purchaseId: purchase._id.toString(),
    });

    const imageDataUrl = await qrcode.toDataURL(payload);

    purchase.status = "generated";
    purchase.qrCode = {
      payload,
      imageDataUrl,
      generatedAt: new Date(),
      isActive: true,
      lastScannedAt: purchase.qrCode?.lastScannedAt || null,
    };

    await purchase.save();

    return res.status(200).json({
      status: true,
      message: "ID approved and generated successfully",
      data: purchase,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.declineIdRequestAdmin = async (req, res) => {
  try {
    const { requestId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ status: false, message: "Invalid requestId" });
    }

    const purchase = await IdPurchase.findById(requestId)
      .populate("user")
      .populate("payment");

    if (!purchase) {
      return res.status(404).json({ status: false, message: "ID request not found" });
    }

    if (!isWithinAdminJurisdiction(req.user, purchase.user)) {
      return res.status(403).json({ status: false, message: "Access denied for this jurisdiction" });
    }

    purchase.status = "cancelled";
    if (purchase.qrCode) {
      purchase.qrCode.isActive = false;
    }

    await purchase.save();

    return res.status(200).json({
      status: true,
      message: "ID request declined successfully",
      data: purchase,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};
