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

const generateSerialNumber = async () => {
  const MAX_RETRIES = 20;

  const generateRandom = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  // 9-digit range (100,000,000 to 999,999,999)
  const NINE_MIN = 100000000;
  const NINE_MAX = 999999999;

  // 10-digit range
  const TEN_MIN = 1000000000;
  const TEN_MAX = 9999999999;

  // 1. Check capacity (9-digit space is ~900 million)
 
  const totalUsers = await userModel.countDocuments();
  const useTenDigits = totalUsers >= (NINE_MAX - NINE_MIN);

  const min = useTenDigits ? TEN_MIN : NINE_MIN;
  const max = useTenDigits ? TEN_MAX : NINE_MAX;

  for (let i = 0; i < MAX_RETRIES; i++) {
    // 2. Generate based on the dynamic min/max
    const candidate = String(generateRandom(min, max));

    // 3. Check uniqueness
    const exists = await userModel.exists({
      "idCard.serialNumber": candidate,
    });

    if (!exists) {
      return candidate;
    }
  }

  throw new Error("Collision limit reached. Increase MAX_RETRIES or check range.");
};



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
const mapUiFulfillmentToDb = (value) => {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  if (v === "pending") return ["pending", "paid"];
  if (v === "generated") return ["generated"];
  if (v === "cancelled" || v === "canceled") return ["cancelled"];
  if (v === "failed") return ["failed"];
  return null;
};

const FULFILLMENT_LABELS = {
  pending: "Pending",
  paid: "Pending",
  generated: "Generated",
  cancelled: "Cancelled",
  failed: "Failed",
};

const isWithinAdminJurisdiction = (admin, user) => {
  if (!admin || !user) return false;
  if (admin.role === "distAdmin") return admin.scoutDistrict && user.scoutDistrict && admin.scoutDistrict === user.scoutDistrict;
  if (admin.role === "ssAdmin") return admin.stateScoutCouncil && user.stateScoutCouncil && admin.stateScoutCouncil === user.stateScoutCouncil;
  if (admin.role === "nsAdmin" || admin.role === "superAdmin") return true;
  return false;
};


exports.requestIdCard = async (req, res) => {
  let createdPayment = null;
  let createdPurchase = null;

  try {
    if (!process.env.KORA_BASE_URL) {
      return res.status(500).json({
        status: false,
        message: "KORA_BASE_URL is not configured",
      });
    }

    if (!process.env.KORA_SECRET_KEY) {
      return res.status(500).json({
        status: false,
        message: "KORA_SECRET_KEY is not configured",
      });
    }

    const user = await userModel.findById(req.user.id);
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    const { notificationUrl, redirectUrl } = getPaymentUrls(req);
    const amount = getIdCardPrice(user.section);
    if (user.idCard?.paid) {
      return res
        .status(400)
        .json({ status: false, message: "ID card already paid for" });
    }

    const existingRequest = await IdPurchase.findOne({
      user: user._id,
      status: { $in: ["pending", "paid", "generated"] },
    }).populate("payment");

    // helper to initialize provider
    const initializeProvider = async (paymentDoc) => {
      const gatewayResponse = await fetch(
        `${process.env.KORA_BASE_URL}/api/v1/charges/initialize`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.KORA_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: paymentDoc.amount,
            currency: paymentDoc.currency || "NGN",
            reference: paymentDoc.reference,
            customer: {
              name: user.fullName,
              email: user.email,
            },
            notification_url: notificationUrl,
            redirect_url: redirectUrl,
          }),
        },
      );

      const gatewayData = await gatewayResponse.json();
      return { gatewayResponse, gatewayData };
    };

    if (existingRequest) {
      const payStatus = existingRequest.payment?.status || "pending"; // pending/successful/failed
      const reqStatus = existingRequest.status; // pending/paid/generated/cancelled/failed
      
      // generated already 
      if (reqStatus === "generated") {
        return res.status(400).json({
          status: false,
          message: "ID card already generated",
          data: {
            requestStatus: reqStatus,
            reference: existingRequest.payment?.reference || null,
          },
        });
      }

      // already paid, awaiting admin generation
      if (payStatus === "successful") {
        return res.status(200).json({
          status: true,
          message: "Payment already completed. Awaiting ID generation.",
          data: {
            requestStatus: reqStatus,
            paymentStatus: payStatus,
            reference: existingRequest.payment.reference,
            amount: existingRequest.payment.amount,
          },
        });
      }

      // retry flow create fresh payment with fresh reference
      const retryReference = `ID-${Date.now()}-${user._id}`;
      const retryPayment = await Payment.create({
        user: user._id,
        amount, 
        currency: existingRequest.payment.currency || "NGN",
        paymentType: "id_card",
        reference: retryReference,
      });

      createdPayment = retryPayment;

      //relink existing request to new payment
      existingRequest.payment = retryPayment._id;
      existingRequest.status = "pending";
      await existingRequest.save();

      const { gatewayResponse, gatewayData } = await initializeProvider(retryPayment);
      
      if (!gatewayResponse.ok || !gatewayData?.data?.checkout_url) {
        retryPayment.status = "failed";
        await retryPayment.save();

        return res.status(502).json({
          status: false,
          message: "Unable to initialize payment with provider",
          providerResponse: gatewayData,
        });
      }

      return res.status(200).json({
        status: true,
        message: "Existing ID request found. Continue payment with new reference.",
        data: {
          requestStatus: existingRequest.status,
          paymentStatus: retryPayment.status,
          reference: retryPayment.reference,
          amount: retryPayment.amount,
          notificationUrl,
          redirectUrl,
          paymentLink: gatewayData.data.checkout_url,
        },
      });
    }

    // no active request, create new request
    const reference = `ID-${Date.now()}-${user._id}`;

    createdPayment = await Payment.create({
      user: user._id,
      amount,
      currency: "NGN",
      paymentType: "id_card",
      reference,
      status: "pending",
    });


    createdPurchase = await IdPurchase.create({
      user: user._id,
      payment: createdPayment._id,
      status: "pending",
    });

    const { gatewayResponse, gatewayData } = await (async () => {
      const response = await fetch(
        `${process.env.KORA_BASE_URL}/api/v1/charges/initialize`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.KORA_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount,
            currency: "NGN",
            reference: createdPayment.reference,
            customer: {
              name: user.fullName,
              email: user.email,
            },
            notification_url: notificationUrl,
            redirect_url: redirectUrl,
          }),
        },
      );

      const data = await response.json();
      return { gatewayResponse: response, gatewayData: data }; 
    })();

    if (!gatewayResponse.ok || !gatewayData?.data?.checkout_url) {
      createdPayment.status = "failed";
      await createdPayment.save();

      await IdPurchase.findByIdAndDelete(createdPurchase._id);

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
  }catch (err) {
    if (createdPurchase?._id) {
      await IdPurchase.findByIdAndDelete(createdPurchase._id).catch(() => {});
    }
    if (createdPayment?._id) {
      await Payment.findByIdAndDelete(createdPayment._id).catch(() => {});
    }
    return res.status(500).json({ status: false, message: err.message });
  }
};

exports.resetIdCardRequest = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1) Find ALL ID purchases for this user (not just one)
    const idPurchases = await IdPurchase.find({ user: userId }).select("_id payment");

    // 2) Delete linked payments
    const paymentIds = idPurchases
      .map((p) => p.payment)
      .filter(Boolean);

    if (paymentIds.length > 0) {
      await Payment.deleteMany({ _id: { $in: paymentIds } });
    }

    // 3) Delete all ID purchase records
    if (idPurchases.length > 0) {
      const purchaseIds = idPurchases.map((p) => p._id);
      await IdPurchase.deleteMany({ _id: { $in: purchaseIds } });
    }

    // 4) Reset all ID-card-related user fields
    await userModel.findByIdAndUpdate(userId, {
      $set: {
        "idCard.paid": false,
        "idCard.issued": false,
        "idCard.paidAt": null,
        "idCard.serialNumber": null,
        "idCard.issuedAt": null,
        "idCard.expiresAt": null,
      },
    });

    return res.status(200).json({
      status: true,
      message:
        "Test cleanup successful: all ID requests/payments removed and user ID card fields reset.",
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};


exports.updateIdStatus = async (req, res) => {
  try {
    const { userId, status } = req.body;
    const allowed = ["pending", "paid", "generated", "cancelled", "failed"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ status: false, message: "Invalid status value" });
    }

    const purchase = await IdPurchase.findOne({ user: userId })
      .populate("user")
      .populate("payment");

    if (!purchase) {
      return res.status(404).json({ status: false, message: "No ID request found" });
    }

    if (status === "generated") {
      if (purchase.payment?.status !== "successful") {
        return res.status(400).json({
          status: false,
          message: "Cannot generate ID before successful payment",
        });
      }

      if (!purchase.user?.membershipId) {
        return res.status(400).json({
          status: false,
          message: "Users must verify their account before requesting an ID card.",
        });
      }

      const payload = buildQrPayload({
        membershipId: purchase.user.membershipId,
        userId: purchase.user._id.toString(),
        purchaseId: purchase._id.toString(),
      });

      const imageDataUrl = await qrcode.toDataURL(payload);

      purchase.qrCode = {
        payload,
        imageDataUrl,
        generatedAt: new Date(),
        isActive: true,
        lastScannedAt: purchase.qrCode?.lastScannedAt || null,
      };

      purchase.adminConfirm = {
        ...(purchase.adminConfirm || {}),
        requestedBy: req.user._id,
        usedAt: new Date(),
      };

      purchase.user.idCard = purchase.user.idCard || {};
      if (!purchase.user.idCard.serialNumber) {
        purchase.user.idCard.serialNumber = await generateSerialNumber();
      }

      const issuedAt = new Date();
      const expiresAt = new Date(issuedAt);
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      purchase.user.idCard.issued = true;
      purchase.user.idCard.issuedAt = issuedAt;
      purchase.user.idCard.expiresAt = expiresAt;

      await purchase.user.save();
    }

    if (status === "cancelled" || status === "failed") {
      if (purchase.qrCode) purchase.qrCode.isActive = false;

      purchase.adminConfirm = {
        ...(purchase.adminConfirm || {}),
        requestedBy: req.user._id,
        usedAt: new Date(),
      };
    }

    purchase.status = status;
    await purchase.save();

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
    const purchase = await IdPurchase.findOne({ user: req.user.id })
    .populate("payment")
    .populate("user", "fullName gender membershipId section stateScoutCouncil scoutDistrict profilePic status idCard");

    if (!purchase) {
      return res.status(200).json({
        status: true,
        data: null,
        message: "No ID card request found",
      });
    }

    const statusMap = {
      pending: "Pending Admin Confirmation",
      paid: "Pending Admin Confirmation",
      generated: "Approved and Generated",
      cancelled: "Declined",
      failed: "Failed",
    };

    const rawStatus = purchase.status;
    const displayStatus = statusMap[rawStatus] || "Pending";

    return res.json({
      status: true,
      data: {
        ...purchase.toObject(),
        rawStatus,
        displayStatus,
        paymentStatus: purchase.payment?.status || "pending",
        adminConfirmed: rawStatus === "generated",
        userDetails: purchase.user
          ?{
            id: purchase.user._id,
            fullName: purchase.user.fullName,
            gender: purchase.user.gender,
            membershipId: purchase.user.membershipId,
            section: purchase.user.section,
            stateScoutCouncil: purchase.user.stateScoutCouncil,
            scoutDistrict: purchase.user.scoutDistrict,
            profilePic: purchase.user.profilePic,
            status: purchase.user.status,
            serialNumber: purchase.user.idCard?.serialNumber || null,
            issuedAt: purchase.user.idCard?.issuedAt || null,
            expiresAt: purchase.user.idCard?.expiresAt || null,

            }
          : null,
      },
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
      fulfillmentStatus: FULFILLMENT_LABELS[r.status] || "Pending",
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
      .populate("user", "fullName gender membershipId section scoutDistrict stateScoutCouncil profilePic status idCard")
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

    const statusMap = {
  pending: "Pending Admin Confirmation",
  paid: "Pending Admin Confirmation",
  generated: "Approved and Generated",
  cancelled: "Declined",
  failed: "Failed",
};

const rawStatus = purchase.status;
const displayStatus = statusMap[rawStatus] || "Pending";

return res.json({
  status: true,
  data: {
    ...purchase.toObject(),
    rawStatus,
    displayStatus,
    paymentStatus: purchase.payment?.status || "pending",
    adminConfirmed: rawStatus === "generated",
    userDetails: purchase.user
      ? {
          id: purchase.user._id,
          fullName: purchase.user.fullName,
          gender: purchase.user.gender,
          membershipId: purchase.user.membershipId,
          section: purchase.user.section,
          stateScoutCouncil: purchase.user.stateScoutCouncil,
          scoutDistrict: purchase.user.scoutDistrict,
          profilePic: purchase.user.profilePic,
          status: purchase.user.status,
          serialNumber: purchase.user.idCard?.serialNumber || null,
          issuedAt: purchase.user.idCard?.issuedAt || null,
          expiresAt: purchase.user.idCard?.expiresAt || null,
        }
      : null,
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
      return res
        .status(400)
        .json({ status: false, message: "Invalid requestId" });
    }

    const purchase = await IdPurchase.findById(requestId)
      .populate("user")
      .populate("payment");

    if (!purchase) {
      return res
        .status(404)
        .json({ status: false, message: "ID request not found" });
    }

    if (!isWithinAdminJurisdiction(req.user, purchase.user)) {
      return res
        .status(403)
        .json({
          status: false,
          message: "Access denied for this jurisdiction",
        });
    }

    if (purchase.payment?.status !== "successful") {
      return res
        .status(400)
        .json({
          status: false,
          message: "Cannot generate ID before successful payment",
        });
    }

    if (!purchase.user?.membershipId) {
      return res
        .status(400)
        .json({ status: false, message: "User has no membershipId" });
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

    purchase.adminConfirm = {
      ...(purchase.adminConfirm || {}),
      requestedBy: req.user._id,
      usedAt: new Date(),
    };

    if (!purchase.user.idCard?.serialNumber) {
      purchase.user.idCard = purchase.user.idCard || {};
      purchase.user.idCard.serialNumber = await generateSerialNumber();
    }
    purchase.user.idCard.issued = true;

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Save on user idCard profile
    purchase.user.idCard = purchase.user.idCard || {};
    purchase.user.idCard.issued = true;
    purchase.user.idCard.issuedAt = issuedAt;
    purchase.user.idCard.expiresAt = expiresAt;

    await purchase.user.save();

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

    purchase.adminConfirm = {
      ...(purchase.adminConfirm || {}),
      requestedBy: req.user._id,
      usedAt: new Date(),
    };

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

exports.getIdCardStats = async (req, res) => {
  try {
    const admin = req.user;
    const userMatch = {};

    if (admin.role === "distAdmin") {
      if (!admin.scoutDistrict) {
        return res.status(400).json({
          status: false,
          message: "distAdmin has no scoutDistrict assigned",
        });
      }
      userMatch["user.scoutDistrict"] = admin.scoutDistrict;
    } else if (admin.role === "ssAdmin") {
      if (!admin.stateScoutCouncil) {
        return res.status(400).json({
          status: false,
          message: "ssAdmin has no stateScoutCouncil assigned",
        });
      }
      userMatch["user.stateScoutCouncil"] = admin.stateScoutCouncil;
    }

    const pipeline = [
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      ...(Object.keys(userMatch).length ? [{ $match: userMatch }] : []),
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalPending: {
            $sum: { $cond: [{ $in: ["$status", ["pending", "paid"]] }, 1, 0] },
          },
          totalGenerated: {
            $sum: { $cond: [{ $eq: ["$status", "generated"] }, 1, 0] },
          },
        },
      },
    ];

    const [stats] = await IdPurchase.aggregate(pipeline);

    return res.status(200).json({
      status: true,
      message: "ID statistics fetched successfully",
      data: {
        totalRequests: stats?.totalRequests || 0,
        totalPending: stats?.totalPending || 0,
        totalGenerated: stats?.totalGenerated || 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};
