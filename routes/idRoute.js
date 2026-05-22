const router = require('express').Router();
const { requestIdCard, getMyIdStatus, resetIdCardRequest, updateIdStatus, getAllIdRequestsAdmin, getSinglePaidIdRequestAdmin, approveAndGenerateIdRequestAdmin, declineIdRequestAdmin, verifyQr, getIdCardStats, getPublicIdCard } = require('../controllers/idCardController');
const {auth, authorizeRoles } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: ID Card
 *   description: ID Card request and tracking system
 */

/**
 * @swagger
 * /idcard/request:
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
 * /idcard/reset:
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
router.post("/reset", auth, authorizeRoles( "distAdmin", "ssAdmin", "superAdmin", "nsAdmin", "member" ), resetIdCardRequest);

/**
 * @swagger
 * /idcard/update:
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
 *             status: generated/cancelled/failed
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
router.patch("/update", auth, authorizeRoles( "distAdmin", "ssAdmin", "superAdmin", "nsAdmin" ), updateIdStatus);

/**
 * @swagger
 * /idcard/status:
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
 *                 rawStatus: refunded
 *                 displayStatus: Declined
 *                 paymentStatus: refunded
 *                 payment:
 *                   reference: ID-123
 *       500:
 *         description: Internal server error
 */
router.get("/status", auth, getMyIdStatus);

/**
 * @swagger
 * /idcard/admin/requests:
 *   get:
 *     summary: Get all ID requests (Admin) with filters and pagination
 *     tags: [ID Card]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: section
 *         schema:
 *           type: string
 *           enum: [Cub, Scout, Venturer, Rover, Volunteers]
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [pending, successful, failed, refunded]
 *       - in: query
 *         name: fulfillmentStatus
 *         schema:
 *           type: string
 *           enum: [Pending, Generated, Cancelled, Failed]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by scout name, membership ID, or payment reference
 *     responses:
 *       200:
 *         description: ID requests fetched successfully
 *       400:
 *         description: Invalid query or admin setup issue
 *       403:
 *         description: Unauthorized role/jurisdiction
 *       500:
 *         description: Internal server error
 */
router.get(
  "/admin/requests",
  auth,
  authorizeRoles("distAdmin", "ssAdmin", "nsAdmin", "superAdmin"),
  getAllIdRequestsAdmin
);

/**
 * @swagger
 * /idcard/admin/requests/{requestId}:
 *   get:
 *     summary: Get a single paid ID request (Admin)
 *     tags: [ID Card]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paid ID request fetched successfully
 *       400:
 *         description: Invalid requestId, request is not paid, or request has already been refunded
 *       403:
 *         description: Access denied for jurisdiction
 *       404:
 *         description: ID request not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/admin/requests/:requestId",
  auth,
  authorizeRoles("distAdmin", "ssAdmin", "nsAdmin", "superAdmin"),
  getSinglePaidIdRequestAdmin
);

/**
 * @swagger
 * /idcard/admin/requests/{requestId}/approve-generate:
 *   patch:
 *     summary: Approve a paid ID request and generate QR
 *     tags: [ID Card]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: ID approved and generated successfully
 *       400:
 *         description: Invalid request, not paid, refunded, already processed, or missing membership ID
 *       403:
 *         description: Access denied for jurisdiction
 *       404:
 *         description: ID request not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/admin/requests/:requestId/approve-generate",
  auth,
  authorizeRoles("distAdmin", "ssAdmin", "nsAdmin", "superAdmin"),
  approveAndGenerateIdRequestAdmin
);

/**
 * @swagger
 * /idcard/admin/requests/{requestId}/decline:
 *   patch:
 *     summary: Decline an ID request (Admin)
 *     tags: [ID Card]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Photo mismatch with profile record"
 *                 description: Decline/refund reason stored on the ID request and sent to payment provider refund API.
 *     responses:
 *       200:
 *         description: ID request declined successfully (and refunded where applicable)
 *       400:
 *         description: Invalid requestId or request already processed (generated/cancelled/refunded)
 *       502:
 *         description: Decline blocked because refund could not be completed at provider
 *       403:
 *         description: Access denied for jurisdiction
 *       404:
 *         description: ID request not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/admin/requests/:requestId/decline",
  auth,
  authorizeRoles("distAdmin", "ssAdmin", "nsAdmin", "superAdmin"),
  declineIdRequestAdmin
);

/**
 * @swagger
 * /idcard/verify-qr:
 *   post:
 *     summary: Verify ID QR code (Admin)
 *     tags: [ID Card]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [payload]
 *             properties:
 *               payload:
 *                 type: string
 *     responses:
 *       200:
 *         description: QR verified successfully
 *       400:
 *         description: Invalid QR format/tampered/inactive
 *       404:
 *         description: Invalid ID record
 *       500:
 *         description: Internal server error
 */
router.post(
  "/verify-qr",
  auth,
  authorizeRoles("distAdmin", "ssAdmin", "nsAdmin", "superAdmin"),
  verifyQr
);

/**
 * @swagger
 * /idcard/admin/stats:
 *   get:
 *     summary: Get ID card statistics (Admin)
 *     tags: [ID Card]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics fetched successfully
 *       500:
 *         description: Internal server error
 */
router.get(
  "/admin/stats",
  auth,
  authorizeRoles("distAdmin", "ssAdmin", "nsAdmin", "superAdmin"),
  getIdCardStats
);

/**
 * @swagger
 * /public/{userId}:
 *   get:
 *     summary: Get public ID card details by user ID
 *     description: |
 *       This endpoint returns publicly available ID card information for a user.
 *       It is typically used when a QR code is scanned and redirects to the frontend URL,
 *       which then calls this endpoint using the userId.
 *
 *       No authentication is required because the data is intended to be publicly accessible
 *       for verification purposes.
 *
 *     tags:
 *       - Public ID Card
 *
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: The unique ID of the user whose ID card is being fetched
 *         schema:
 *           type: string
 *           example: 64f9c2a1b8d3e5a9c1234567
 *
 *     responses:
 *       200:
 *         description: ID card details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     fullName:
 *                       type: string
 *                       example: John Doe
 *                     membershipId:
 *                       type: string
 *                       example: SCOUT-2026-00123
 *                     section:
 *                       type: string
 *                       example: Scout
 *                     profilePic:
 *                       type: string
 *                       example: https://cdn.example.com/profile.jpg
 *                     stateScoutCouncil:
 *                       type: string
 *                       example: Lagos State Scout Council
 *                     scoutDistrict:
 *                       type: string
 *                       example: Ikeja District
 *                     serialNumber:
 *                       type: string
 *                       example: 123456789
 *                     issuedAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2026-01-10T10:00:00.000Z
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2027-01-10T10:00:00.000Z
 *
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: User not found
 *
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */
router.get("/public/:userId", getPublicIdCard);

module.exports = router;
