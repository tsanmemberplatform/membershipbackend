const router = require('express').Router();
const { requestIdCard, getMyIdStatus, resetIdCardRequest, updateIdStatus } = require('../controllers/idCardController');
const {auth, authorizeRoles } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: ID Card
 *   description: ID Card request and tracking system
 */

/**
 * @swagger
 * /id/request:
 *   post:
 *     summary: Request an ID Card (Initialize payment)
 *     tags: [ID Card]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: ID card request initiated successfully
 *         content:
 *           application/json:
 *             example:
 *               status: true
 *               message: ID card request initiated
 *               data:
 *                 amount: 1500
 *                 reference: ID-172839483-userId
 *                 notificationUrl: https://api.example.com/webhook
 *                 redirectUrl: https://frontend.com/payment/success
 *                 paymentLink: https://checkout.korapay.com/xyz
 *       400:
 *         description: Bad request (already requested or paid)
 *         content:
 *           application/json:
 *             examples:
 *               AlreadyPaid:
 *                 value:
 *                   status: false
 *                   message: ID card already paid for
 *               ActiveRequest:
 *                 value:
 *                   status: false
 *                   message: You already have an active ID card request
 *       404:
 *         description: User not found
 *       502:
 *         description: Payment provider initialization failed
 *       500:
 *         description: Internal server error
 */
router.post("/request", auth, requestIdCard);

/**
 * @swagger
 * /id/reset:
 *   post:
 *     summary: Reset ID Card request (DEV/TEST purpose)
 *     tags: [ID Card]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ID card request reset successfully
 *         content:
 *           application/json:
 *             example:
 *               status: true
 *               message: Test cleanup successful
 *       500:
 *         description: Internal server error
 */
router.post("/reset", auth, authorizeRoles( "distAdmin", "ssAdmin", "superAdmin" ), resetIdCardRequest);

/**
 * @swagger
 * /id/update:
 *   patch:
 *     summary: Update ID Card status (Admin only)
 *     tags: [ID Card]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             userId: 64abc12345
 *             status: completed
 *     responses:
 *       200:
 *         description: ID process updated successfully
 *       400:
 *         description: Invalid update (e.g. user not verified)
 *       403:
 *         description: Unauthorized role
 *       404:
 *         description: No ID request found
 *       500:
 *         description: Internal server error
 */
router.patch("/update", auth, authorizeRoles( "distAdmin", "ssAdmin", "superAdmin" ), updateIdStatus);

/**
 * @swagger
 * /id/status:
 *   get:
 *     summary: Get logged-in user's ID Card status
 *     tags: [ID Card]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ID status fetched successfully
 *         content:
 *           application/json:
 *             example:
 *               status: true
 *               data:
 *                 status: paid
 *                 payment:
 *                   reference: ID-123
 *       500:
 *         description: Internal server error
 */
router.get("/status", auth, getMyIdStatus);

module.exports = router;