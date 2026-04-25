const paymentModel = require("../models/paymentModel");
const idPurchaseModel = require("../models/idPurchaseModel");
const eventModel = require("../models/eventModel");
const { userModel } = require("../models/userModel");
const { getPaymentUrls } = require("../utils/paymentUrls");

const ADMIN_ROLES = ["ssAdmin", "nsAdmin", "superAdmin", "distAdmin"];
const ACTIVE_ID_REQUEST_STATUSES = ["pending", "paid", "generated"];

const getKoraHeaders = () => ({
  Authorization: `Bearer ${process.env.KORA_SECRET_KEY}`,
  "Content-Type": "application/json",
});

const initializeWithProvider = async ({
  payment,
  customerName,
  customerEmail,
  notificationUrl,
  redirectUrl,
}) => {
  const gatewayResponse = await fetch(
    `${process.env.KORA_BASE_URL}/api/v1/charges/initialize`,
    {
      method: "POST",
      headers: getKoraHeaders(),
      body: JSON.stringify({
        amount: payment.amount,
        currency: payment.currency || "NGN",
        reference: payment.reference,
        customer: {
          name: customerName,
          email: customerEmail,
        },
        notification_url: notificationUrl,
        redirect_url: redirectUrl,
      }),
    }
  );

  const gatewayData = await gatewayResponse.json();
  return { gatewayResponse, gatewayData };
};

const applySuccessfulPaymentSideEffects = async (paymentDoc) => {
  if (paymentDoc.paymentType === "id_card") {
    await idPurchaseModel.findOneAndUpdate(
      { payment: paymentDoc._id },
      {
        user: paymentDoc.user,
        payment: paymentDoc._id,
        status: "paid",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await userModel.findByIdAndUpdate(paymentDoc.user, {
      "idCard.paid": true,
      "idCard.paidAt": new Date(),
    });
  }

  if (paymentDoc.paymentType === "event" && paymentDoc.event) {
    const event = await eventModel.findById(paymentDoc.event);
    if (!event) return;

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
    const { reference, paymentType, amount, eventId } = req.body;
    const { notificationUrl, redirectUrl } = getPaymentUrls(req);

    // FLOW A: Align with your original ID-card flow -> initialize by existing reference.
    if (reference) {
      const payment = await paymentModel.findOne({ reference }).populate("user");
      if (!payment) {
        return res.status(404).json({ status: false, message: "Payment not found" });
      }

      const canAccess =
        payment.user?._id?.toString() === req.user._id.toString() ||
        ADMIN_ROLES.includes(req.user.role);
      if (!canAccess) {
        return res
          .status(403)
          .json({ status: false, message: "Not authorized to initialize this payment" });
      }

      const { gatewayResponse, gatewayData } = await initializeWithProvider({
        payment,
        customerName: payment.user?.fullName || "TSAN User",
        customerEmail: payment.user?.email || req.user.email,
        notificationUrl,
        redirectUrl,
      });

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
        paymentLink: gatewayData.data.checkout_url,
        data: {
          paymentId: payment._id,
          reference: payment.reference,
          amount: payment.amount,
          paymentType: payment.paymentType,
          notificationUrl,
          redirectUrl,
        },
      });
    }

    // FLOW B: Event quick-init flow -> create payment then initialize provider.
    if (paymentType !== "event") {
      return res.status(400).json({
        status: false,
        message:
          "For id_card, initialize with an existing reference from the ID-card request flow",
      });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        status: false,
        message: "amount must be a positive number for event payment",
      });
    }

    if (!eventId) {
      return res.status(400).json({
        status: false,
        message: "eventId is required for event payment",
      });
    }

    const event = await eventModel.findById(eventId);
    if (!event) {
      return res.status(404).json({
        status: false,
        message: "Event not found",
      });
    }

    const eventReference = `EVT_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const eventPayment = await paymentModel.create({
      user: req.user._id,
      amount: parsedAmount,
      paymentType: "event",
      reference: eventReference,
      event: event._id,
      metadata: {
        initiatedByRole: req.user.role,
        userEmail: req.user.email,
      },
    });

    const { gatewayResponse, gatewayData } = await initializeWithProvider({
      payment: eventPayment,
      customerName: req.user.fullName || "TSAN User",
      customerEmail: req.user.email,
      notificationUrl,
      redirectUrl,
    });

    if (!gatewayResponse.ok || !gatewayData?.data?.checkout_url) {
      return res.status(502).json({
        status: false,
        message: "Unable to initialize payment with provider",
        providerResponse: gatewayData,
      });
    }

    return res.status(200).json({
      status: true,
      message: "Event payment initialized successfully",
      paymentLink: gatewayData.data.checkout_url,
      data: {
        paymentId: eventPayment._id,
        reference: eventPayment.reference,
        amount: eventPayment.amount,
        paymentType: eventPayment.paymentType,
        notificationUrl,
        redirectUrl,
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
      `${process.env.KORA_BASE_URL}/api/v1/charges/${reference}`,
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

exports.getMyIdRequest = async (req, res) => {
  try {
    const request = await idPurchaseModel
      .findOne({
        user: req.user._id,
        status: { $in: ACTIVE_ID_REQUEST_STATUSES },
      })
      .sort({ createdAt: -1 })
      .populate("payment");

    return res.status(200).json({
      status: true,
      data: request || null,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Internal server error: " + error.message,
    });
  }
};
