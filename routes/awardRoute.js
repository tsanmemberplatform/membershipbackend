const router = require("express").Router();
const { auth, authorizeRoles } = require("../middleware/authMiddleware");
const {
  createAwardProgress,
  getAwardById,
  getUserAwards,
  getAllAwards,
  updateAwardProgress,
  getMembersProgress,
  deleteAwardProgress,
  updatePendingAward,
  getPendingAwards
} = require("../controllers/awardController");
const { uploadGeneralFile } = require("../utils/multer");


/**
 * @swagger
 * tags:
 *   name: AwardProgress
 *   description: Manage scouts’ award and badge progress
 */

/**
 * @swagger
 * /awards/createAward:
 *   post:
 *     summary: Create award progress (Scout or Admin for a Scout)
 *     tags: [AwardProgress]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - awardName
 *             properties:
 *               scoutId:
 *                 type: string
 *                 description: >
 *                   Only required if the logged-in user is an Admin or SuperAdmin.  
 *                   Scouts do not need to provide this (their ID will be taken from the token).
 *               awardName:
 *                 type: string
 *                 description: Name of the award or badge
 *               awardLocation:
 *                 type: string
 *                 description: Location where the award was achieved (optional)
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Optional file upload (e.g. certificate image)
 *     responses:
 *       201:
 *         description: Award progress created successfully
 *       400:
 *         description: scoutId and awardName are required
 *       401:
 *         description: Unauthorized (no token provided)
 *       403:
 *         description: Forbidden (invalid role or permissions)
 *       500:
 *         description: Internal server error
 */
router.post("/createAward", auth, uploadGeneralFile.single("file"), createAwardProgress);

/**
 * @swagger
 * /awards/getAwardById/{id}:
 *   get:
 *     summary: Get a single award progress record by ID
 *     tags: [AwardProgress]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Award progress ID
 *     responses:
 *       200:
 *         description: Award progress found
 *       404:
 *         description: Award progress not found
 */
router.get("/getAwardById/:id", auth, getAwardById);

/**
 * @swagger
 * /awards/user/{userId}:
 *   get:
 *     summary: Get all award progress for a specific user
 *     tags: [AwardProgress]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: List of award progress for the user
 */
router.get("/user/:userId", auth, getUserAwards);

/**
 * @swagger
 * /awards/getAllAwards:
 *   get:
 *     summary: Get all award progress (Admin & Leader scoped)
 *     tags: [AwardProgress]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all award progress records
 */
router.get("/getAllAwards", auth, authorizeRoles("leader", "ssAdmin", "nsAdmin", "superAdmin"), getAllAwards);

/**
 * @swagger
 * /awards/{id}:
 *   patch:
 *     summary: Update award progress (Scout or Admin)
 *     tags: [AwardProgress]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Award progress ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               awardName:
 *                 type: string
 *                 description: Updated award or badge name
 *               awardLocation:
 *                 type: string
 *                 description: Updated award location
 *               status:
 *                 type: string
 *                 enum: [in-progress, completed]
 *                 description: Award status
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Optional new award certificate or file
 *             example:
 *               awardName: Advanced First Aid
 *               awardLocation: Lagos State
 *               status: completed
 *     responses:
 *       200:
 *         description: Award progress updated successfully
 *       403:
 *         description: Unauthorized (not owner or admin)
 *       404:
 *         description: Award progress not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id", auth, uploadGeneralFile.single("file"), updateAwardProgress);


/**
 * @swagger
 * /awards/members/progress:
 *   get:
 *     summary: Get training and award progress of members
 *     tags: [AwardProgress]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Leaders can view their troop members’ training and award progress. 
 *       Admins (superAdmin, nsAdmin, ssAdmin) can view all members.
 *     responses:
 *       200:
 *         description: Successfully retrieved member progress
 *       403:
 *         description: Forbidden, only leaders and admins can access
 *       500:
 *         description: Internal server error
 */
router.get("/members/progress", auth, authorizeRoles("leader", "superAdmin", "nsAdmin", "ssAdmin"), getMembersProgress);

/**
 * @swagger
 * /awards/{id}:
 *   delete:
 *     summary: Delete an award progress record
 *     description: Deletes a specific award progress entry by its ID. Only authorized users (member, ssAdmin, nsAdmin, or superAdmin) can perform this action.
 *     tags: [AwardProgress]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the award progress record to delete.
 *         schema:
 *           type: string
 *           example: 670f38f71a6bce102b06c512
 *     responses:
 *       200:
 *         description: Award progress deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Award progress deleted successfully.
 *       400:
 *         description: Invalid award ID or request format.
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
 *                   example: Invalid award ID provided.
 *       403:
 *         description: Unauthorized — user role not permitted to delete award progress.
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
 *                   example: Access denied. You are not authorized to delete this record.
 *       404:
 *         description: Award progress not found.
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
 *                   example: Award progress not found.
 *       500:
 *         description: Internal server error.
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
 *                   example: Server error while deleting award progress.
 */

router.delete("/:id", auth, authorizeRoles("member", "ssAdmin", "nsAdmin", "superAdmin"), deleteAwardProgress);

/**
 * @swagger
 * /awards/pending:
 *   get:
 *     summary: Fetch all pending (in-progress) awards
 *     description: Admins (ssAdmin, nsAdmin, superAdmin) can view all in-progress awards.
 *     tags: [AwardProgress]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Page number for pagination
 *         required: false
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         description: Number of results per page
 *         required: false
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of in-progress awards retrieved successfully
 *       403:
 *         description: Unauthorized - only admins can access this route
 *       500:
 *         description: Server error
 */
router.get("/pending", auth, authorizeRoles("ssAdmin", "nsAdmin", "superAdmin"), getPendingAwards);

/**
 * @swagger
 * /awards/pending/{id}:
 *   patch:
 *     summary: Update a pending (in-progress) award
 *     description: Allows admins to update award status or details.
 *     tags: [AwardProgress]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Award ID
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
 *               awardName:
 *                 type: string
 *               awardLocation:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [in-progress, approved, rejected]
 *     responses:
 *       200:
 *         description: Award updated successfully
 *       404:
 *         description: Award not found
 *       403:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.patch("/pending/:id", auth, authorizeRoles("ssAdmin", "nsAdmin", "superAdmin"), updatePendingAward);

module.exports = router;

