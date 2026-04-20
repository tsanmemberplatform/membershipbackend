const router = require("express").Router();
const { initializePayment, verifyPayment, koraWebhook, getMyPayments } = require("../controllers/paymentController");
const { auth, authorizeRoles } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment handling via KoraPay
 */

/**
 * @swagger
 * /payments/initialize:
 *   post:
 *     summary: Initialize a payment (ID card or Event)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           examples:
 *             ExistingReference:
 *               value:
 *                 reference: ID-172839483-userId
 *             EventPayment:
 *               value:
 *                 paymentType: event
 *                 amount: 5000
 *                 eventId: 65abc1234
 *     responses:
 *       200:
 *         description: Payment initialized successfully
 *         content:
 *           application/json:
 *             example:
 *               status: true
 *               message: Payment initialized successfully
 *               paymentLink: https://checkout.korapay.com/xyz
 *               data:
 *                 reference: ID-123
 *                 amount: 1500
 *                 paymentType: id_card
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             examples:
 *               InvalidType:
 *                 value:
 *                   status: false
 *                   message: For id_card, initialize with an existing reference
 *               InvalidAmount:
 *                 value:
 *                   status: false
 *                   message: amount must be a positive number
 *       403:
 *         description: Unauthorized access
 *       404:
 *         description: Payment or Event not found
 *       502:
 *         description: Payment provider error
 *       500:
 *         description: Internal server error
 */
// NOTE: Authenticated users can initialize their own payments.
router.post("/initialize", auth, authorizeRoles("member", "leader", "ssAdmin", "nsAdmin", "superAdmin"), initializePayment );

/**
 * @swagger
 * /payments/verify/{reference}:
 *   get:
 *     summary: Verify payment status
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: reference
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: ID-172839483-userId
 *     responses:
 *       200:
 *         description: Payment verification completed
 *         content:
 *           application/json:
 *             examples:
 *               Success:
 *                 value:
 *                   status: true
 *                   message: Payment verified successfully
 *                   data:
 *                     reference: ID-123
 *                     paymentStatus: successful
 *                     paymentType: id_card
 *               Failed:
 *                 value:
 *                   status: true
 *                   message: Payment verification completed
 *                   data:
 *                     reference: ID-123
 *                     paymentStatus: failed
 *       403:
 *         description: Unauthorized verification
 *       404:
 *         description: Payment not found
 *       502:
 *         description: Payment provider verification failed
 *       500:
 *         description: Internal server error
 */
// NOTE: Authenticated users verify their own payment; admins can verify any payment.
router.get( "/verify/:reference", auth, authorizeRoles("member", "leader", "ssAdmin", "nsAdmin", "superAdmin"), verifyPayment );

/**
 * @swagger
 * /payments/my-payments:
 *   get:
 *     summary: Get logged-in user's payment history
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: number
 *         example: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: number
 *         example: 10
 *     responses:
 *       200:
 *         description: Payments fetched successfully
 *         content:
 *           application/json:
 *             example:
 *               status: true
 *               totalPayments: 20
 *               currentPage: 1
 *               totalPages: 2
 *               data: []
 *       500:
 *         description: Internal server error
 */
// NOTE: Authenticated users can fetch their own payment history.
router.get( "/my-payments",  auth,  authorizeRoles("member", "leader", "ssAdmin", "nsAdmin", "superAdmin"), getMyPayments );

/**
 * @swagger
 * /payments/webhook/kora:
 *   post:
 *     summary: KoraPay webhook endpoint
 *     tags: [Payments]
 *     description: Receives payment updates from KoraPay. No authentication required.
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       500:
 *         description: Webhook processing error
 */
// NOTE: Webhook must stay unauthenticated for provider callbacks.
router.post("/webhook/kora", koraWebhook);

module.exports = router;
