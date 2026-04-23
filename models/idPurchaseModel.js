const mongoose = require('mongoose');

const idPurchaseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "paid", "generated", "cancelled", "failed"],
      default: "pending",
    },
    qrCode: {
      payload: { type: String, default: null }, // signed payload
      imageDataUrl: { type: String, default: null }, // base64 QR image
      generatedAt: { type: Date, default: null },
      isActive: { type: Boolean, default: false },
      lastScannedAt: { type: Date, default: null },
    },
    adminConfirm: {
      tokenHash: { type: String, default: null },
      expiresAt: { type: Date, default: null },
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      usedAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('IdPurchase', idPurchaseSchema);

