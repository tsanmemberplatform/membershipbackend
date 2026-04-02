const paymentModel = require("../models/paymentModel");
const idPurchaseModel = require("../models/idPurchaseModel");
const eventModel = require("../models/eventModel");
const { userModel } = require("../models/userModel");

// NOTE: Admin roles used for payment-level privileged access checks.
const ADMIN_ROLES = ["ssAdmin", "nsAdmin", "superAdmin"];

// NOTE: Centralized Korapay headers for initialize/verify requests.
const getKoraHeaders = () => ({
  Authorization: `Bearer ${process.env.KORA_SECRET_KEY}`,
  "Content-Type": "application/json",
});

// NOTE: This helper applies business side effects only once after a successful payment.
const applySuccessfulPaymentSideEffects = async (paymentDoc) => {
  if (paymentDoc.paymentType === "id_card") {
    // NOTE: Link payment to ID purchase record.
    await idPurchaseModel.findOneAndUpdate(
      { payment: paymentDoc._id },
      {
        user: paymentDoc.user,
        payment: paymentDoc._id,
        status: "completed",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // NOTE: Mark ID card as paid on user profile.
    await userModel.findByIdAndUpdate(paymentDoc.user, {
      "idCard.paid": true,
      "idCard.paidAt": new Date(),
    });
  }

  if (paymentDoc.paymentType === "event" && paymentDoc.event) {
    const event = await eventModel.findById(paymentDoc.event);
    if (!event) return;

    // NOTE: Ensure only one attendee record per user while attaching payment references.
    event.attendees = event.attendees.filter(
      (attendee) => attendee.scout.toString() !== paymentDoc.user.toString()
    );

    event.attendees.push({
      scout: paymentDoc.user,
      status: "Going",
      paymentStatus: "paid",
      payment: paymentDoc._id,
    });

    await event.save();
  }
};

exports.initializePayment = async (req, res) => {
  try {
    const { amount, paymentType, eventId } = req.body;
    const userEmail = req.user?.email;

    // NOTE: Input validation for required payment fields.
    if (!amount || !paymentType) {
      return res.status(400).json({
        status: false,
        message: "amount and paymentType are required",
      });
    }

    if (!["id_card", "event"].includes(paymentType)) {
      return res.status(400).json({
        status: false,
        message: "paymentType must be either 'id_card' or 'event'",
      });
    }

    // NOTE: Event payment requires a valid event reference.
    let event = null;
    if (paymentType === "event") {
      if (!eventId) {
        return res.status(400).json({
          status: false,
          message: "eventId is required for event payment",
        });
      }

      event = await eventModel.findById(eventId);
      if (!event) {
        return res.status(404).json({
          status: false,
          message: "Event not found",
        });
      }
    }

    // NOTE: Local payment reference is persisted before calling gateway.
    const reference = `TSAN_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const payment = await paymentModel.create({
      user: req.user._id,
      amount,
      paymentType,
      reference,
      event: event ? event._id : null,
      metadata: {
        initiatedByRole: req.user.role,
        userEmail,
      },
    });

    const gatewayResponse = await fetch(
      "https://api.korapay.com/merchant/api/v1/charges/initialize",
      {
        method: "POST",
        headers: getKoraHeaders(),
        body: JSON.stringify({
          amount,
          currency: "NGN",
          reference,
          customer: { email: userEmail },
          notification_url: process.env.KORA_WEBHOOK_URL || undefined,
        }),
      }
    );

    const gatewayData = await gatewayResponse.json();
    if (!gatewayResponse.ok || !gatewayData?.data?.checkout_url) {
      return res.status(502).json({
        status: false,
        message: "Unable to initialize payment with provider",
        providerResponse: gatewayData,
      });
    }

    return res.status(200).json({
      status: true,
      message: "Payment initialized successfully",
      data: {
        paymentId: payment._id,
        reference,
        paymentLink: gatewayData.data.checkout_url,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    const payment = await paymentModel.findOne({ reference });

    if (!payment) {
      return res.status(404).json({
        status: false,
        message: "Payment not found",
      });
    }

    // NOTE: User can verify only own payment unless they are an admin role.
    if (
      payment.user.toString() !== req.user._id.toString() &&
      !ADMIN_ROLES.includes(req.user.role)
    ) {
      return res.status(403).json({
        status: false,
        message: "Not authorized to verify this payment",
      });
    }

    const gatewayResponse = await fetch(
      `https://api.korapay.com/merchant/api/v1/charges/${reference}`,
      {
        method: "GET",
        headers: getKoraHeaders(),
      }
    );

    const gatewayData = await gatewayResponse.json();
    if (!gatewayResponse.ok) {
      return res.status(502).json({
        status: false,
        message: "Unable to verify payment with provider",
        providerResponse: gatewayData,
      });
    }

    const providerStatus = (gatewayData?.data?.status || "").toLowerCase();
    const isSuccess = providerStatus === "success" || providerStatus === "successful";

    payment.status = isSuccess ? "successful" : "failed";
    payment.metadata = {
      ...(payment.metadata || {}),
      verificationPayload: gatewayData?.data || gatewayData,
    };
    await payment.save();

    if (isSuccess) {
      await applySuccessfulPaymentSideEffects(payment);
    }

    return res.status(200).json({
      status: true,
      message: isSuccess ? "Payment verified successfully" : "Payment verification completed",
      data: {
        reference: payment.reference,
        paymentStatus: payment.status,
        paymentType: payment.paymentType,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};

exports.koraWebhook = async (req, res) => {
  try {
    const payload = req.body || {};
    const data = payload.data || {};
    const reference = data.reference;

    // NOTE: Always return 200 for malformed webhook payloads to avoid endless retries.
    if (!reference) return res.sendStatus(200);

    const payment = await paymentModel.findOne({ reference });
    if (!payment) return res.sendStatus(200);

    const status = (data.status || "").toLowerCase();
    if (status === "success" || status === "successful") {
      payment.status = "successful";
      payment.metadata = {
        ...(payment.metadata || {}),
        webhookPayload: data,
      };
      await payment.save();
      await applySuccessfulPaymentSideEffects(payment);
    } else if (status) {
      payment.status = "failed";
      payment.metadata = {
        ...(payment.metadata || {}),
        webhookPayload: data,
      };
      await payment.save();
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("Kora webhook error:", error);
    return res.sendStatus(500);
  }
};

exports.getMyPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      paymentModel
        .find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("event", "title date location"),
      paymentModel.countDocuments({ user: req.user._id }),
    ]);

    return res.status(200).json({
      status: true,
      message: "Payments fetched successfully",
      totalPayments: total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      data: payments,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};
