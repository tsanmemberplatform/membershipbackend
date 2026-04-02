const router = require("express").Router();
const {
  initializePayment,
  verifyPayment,
  koraWebhook,
  getMyPayments,
} = require("../controllers/paymentController");
const { auth, authorizeRoles } = require("../middleware/authMiddleware");

// NOTE: Authenticated users can initialize their own payments.
router.post(
  "/initialize",
  auth,
  authorizeRoles("member", "leader", "ssAdmin", "nsAdmin", "superAdmin"),
  initializePayment
);

// NOTE: Authenticated users verify their own payment; admins can verify any payment.
router.get(
  "/verify/:reference",
  auth,
  authorizeRoles("member", "leader", "ssAdmin", "nsAdmin", "superAdmin"),
  verifyPayment
);

// NOTE: Authenticated users can fetch their own payment history.
router.get(
  "/my-payments",
  auth,
  authorizeRoles("member", "leader", "ssAdmin", "nsAdmin", "superAdmin"),
  getMyPayments
);

// NOTE: Webhook must stay unauthenticated for provider callbacks.
router.post("/webhook/kora", koraWebhook);

module.exports = router;
