const router = require("express").Router();
const { 
  uploadTraining, 
  getMyTrainings, 
  updateTraining, 
  deleteTraining, 
  getAllTrainings, 
  verifyTraining, 
  getTrainingById 
} = require("../controllers/trainingController");
const { auth, authorizeRoles } = require("../middleware/authMiddleware");
const { uploadGeneralFile } = require("../utils/multer");

/**
 * @swagger
 * tags:
 *   name: Trainings
 *   description: Endpoints for managing scout trainings
 */

/**
 * @swagger
 * /trainings:
 *   post:
 *     summary: Upload a training (Scout only)
 *     tags: [Trainings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - trainingType
 *               - photo
 *             properties:
 *               trainingType:
 *                 type: string
 *                 enum:
 *                   - Tenderfoot
 *                   - Second Class
 *                   - First Class
 *                   - Basic Training Course
 *                   - Wood Badge
 *                   - Assistant Leader Trainer
 *                   - Leader Trainer
 *                   - Other
 *                 description: Type of training
 *               customTrainingName:
 *                 type: string
 *                 description: Required if trainingType is 'Other'
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Certificate file (PDF, JPG, or PNG)
 *           example:
 *             trainingType: "Tenderfoot"
 *             customTrainingName: "Advanced Scout Training"
 *     responses:
 *       201:
 *         description: Training uploaded successfully
 *         content:
 *           application/json:
 *             example:
 *               status: true
 *               message: "Training uploaded successfully"
 *               training:
 *                 _id: "64f2a1f2b2e5a7e1d3a4b1c2"
 *                 trainingType: "Tenderfoot"
 *                 certificateUrl: "https://res.cloudinary.com/demo/image/upload/cert.pdf"
 *                 scout: "64f2a1f2b2e5a7e1d3a4b1c1"
 *                 status: "Pending"
 *       400:
 *         description: Missing required fields or invalid data
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: "Training type is required"
 *       403:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: "Unauthorized access"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: "Server error"
 */
router.post("/", auth, uploadGeneralFile.single("photo"), uploadTraining);

/**
 * @swagger
 * /trainings/me:
 *   get:
 *     summary: Get all trainings of the logged-in scout
 *     tags: [Trainings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of trainings
 *         content:
 *           application/json:
 *             example:
 *               trainings:
 *                 - _id: "64f2a1f2b2e5a7e1d3a4b1c2"
 *                   trainingType: "Tenderfoot"
 *                   certificateUrl: "https://example.com/cert.pdf"
 *                   status: "Pending"
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get("/me", auth, getMyTrainings);

/**
 * @swagger
 * /trainings:
 *   get:
 *     summary: Get all trainings (Admin/SuperAdmin only)
 *     tags: [Trainings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all trainings
 *         content:
 *           application/json:
 *             example:
 *               trainings:
 *                 - _id: "64f2a1f2b2e5a7e1d3a4b1c2"
 *                   trainingType: "Tenderfoot"
 *                   certificateUrl: "https://example.com/cert.pdf"
 *                   status: "Pending"
 *                   scout:
 *                     _id: "64f2a1f2b2e5a7e1d3a4b1c1"
 *                     fullName: "John Doe"
 *                     email: "john@example.com"
 *                     membershipId: "TSAN-ABJ-1234567"
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get("/", auth, authorizeRoles("nsAdmin", "superAdmin"), getAllTrainings);

/**
 * @swagger
 * /trainings/{id}:
 *   get:
 *     summary: Get a single training by ID
 *     tags: [Trainings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Training ID
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Training details
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Training not found
 *       500:
 *         description: Server error
 *   put:
 *     summary: Update a training (Scout only, own training)
 *     tags: [Trainings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               trainingType:
 *                 type: string
 *               customTrainingName:
 *                 type: string
 *               customTrainingDate:
 *                 type: string
 *               customTrainingLocation:
 *                 type: string
 *               certificateUrl:
 *                 type: string
 *           example:
 *             trainingType: "First Class"
 *             customTrainingName: "Advanced Scout Training"
 *             customTrainingDate: "2025-09-20"
 *             customTrainingLocation: "Lagos"
 *             certificateUrl: "https://example.com/cert.pdf"
 *     responses:
 *       200:
 *         description: Training updated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Training not found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete a training (Scout or Admin)
 *     tags: [Trainings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Training ID
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Training deleted successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Training not found
 *       500:
 *         description: Server error
 */
router.put("/:id", auth, authorizeRoles("member",  "ssAdmin", "leader", "nsAdmin", "superAdmin"), updateTraining);
router.delete("/:id", auth, authorizeRoles("member", "nsAdmin", "superAdmin"), deleteTraining);
router.get("/:id", auth, getTrainingById)

/**
 * @swagger
 * /trainings/{id}/verify:
 *   put:
 *     summary: Verify or reject a training (Admin/StateAdmin/SuperAdmin)
 *     tags: [Trainings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Training ID
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Verified, Rejected]
 *               rejectionReason:
 *                 type: string
 *                 description: Reason for rejection if status is Rejected
 *           example:
 *             status: "Verified"
 *     responses:
 *       200:
 *         description: Training verification updated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Training not found
 *       500:
 *         description: Server error
 */
router.put("/:id/verify", auth, authorizeRoles("nsAdmin", "ssAdmin", "superAdmin"), verifyTraining);

module.exports = router;