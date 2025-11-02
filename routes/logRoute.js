const router = require("express").Router();

const { auth, authorizeRoles } = require("../middleware/authMiddleware");
const {
  createLog,
  getMyLogs,
  getAllLogs,
  getLogById,
  updateLog,
  deleteLog
} = require("../controllers/logController");
const { uploadGeneralFile } = require("../utils/multer");

/**
 * @swagger
 * tags:
 *   name: ActivityLogs
 *   description: Manage scout activity logs
 */

/**
 * @swagger
 * /logs:
 *   post:
 *     summary: Create a new activity log
 *     tags: [ActivityLogs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Title of the activity log
 *               location:
 *                 type: string
 *                 description: location of the activity log
 *               description:
 *                 type: string
 *                 description: Optional description of the log
 *               date:
 *                 type: string
 *                 format: date-time
 *                 description: Date of the activity
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Optional file upload (image, pdf, etc.)
 *     responses:
 *       201:
 *         description: Activity log created
 */
router.post("/", auth, uploadGeneralFile.single("photo"), createLog);

/**
 * @swagger
 * /logs/my-logs:
 *   get:
 *     summary: Get all logs for the logged-in scout
 *     tags: [ActivityLogs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of logs for the logged-in scout
 */
router.get("/my-logs", auth, getMyLogs);

/**
 * @swagger
 * /logs:
 *   get:
 *     summary: Get all logs (admin/leader only, paginated)
 *     tags: [ActivityLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number (default is 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *         description: Number of logs per page (default is 10)
 *     responses:
 *       200:
 *         description: Paginated list of logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 totalLogs:
 *                   type: integer
 *                   example: 57
 *                 currentPage:
 *                   type: integer
 *                   example: 2
 *                 totalPages:
 *                   type: integer
 *                   example: 6
 *                 pageSize:
 *                   type: integer
 *                   example: 10
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "650123..."
 *                       action:
 *                         type: string
 *                         example: "User login"
 *                       date:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-09-22T03:21:00Z"
 *                       scout:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "64ff..."
 *                           fullName:
 *                             type: string
 *                             example: "John Doe"
 *                           membershipId:
 *                             type: string
 *                             example: "TSAN-001"
 *                           email:
 *                             type: string
 *                             example: "john@example.com"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

router.get("/", auth, authorizeRoles("superAdmin", "nsAdmin", "ssAdmin", "leader"), getAllLogs);

/**
 * @swagger
 * /logs/{id}:
 *   get:
 *     summary: Get a single activity log
 *     tags: [ActivityLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Activity log ID
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Activity log details
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Log not found
 */
router.get("/:id", auth, getLogById);

/**
 * @swagger
 * /logs/{id}:
 *   patch:
 *     summary: Update an activity log (owner only)
 *     tags: [ActivityLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Activity log ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *               fileUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Activity log updated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Log not found
 */
router.patch("/:id", auth, updateLog);

/**
 * @swagger
 * /logs/{id}:
 *   delete:
 *     summary: Delete an activity log (owner or admin)
 *     tags: [ActivityLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Activity log ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Activity log deleted
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Log not found
 */
router.delete("/:id", auth, deleteLog);

module.exports = router;
