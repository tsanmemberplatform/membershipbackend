const mongoose = require('mongoose');

const idPurchaseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true
  },

  status: {
    type: String,
    enum: ['pending', 'processing', 'completed'],
    default: 'pending'
  }

}, { timestamps: true });

module.exports = mongoose.model('IdPurchase', idPurchaseSchema);
