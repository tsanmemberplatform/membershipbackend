const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  amount: { type: Number, required: true },
  currency: { type: String, default: 'NGN' },

  paymentType: {
    type: String,
    enum: ['id_card', 'event'],
    required: true
  },

  reference: { type: String, unique: true, required: true },

  status: {
    type: String,
    enum: ['pending', 'successful', 'failed'],
    default: 'pending'
  },

  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    default: null
  },

  metadata: Object

}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
