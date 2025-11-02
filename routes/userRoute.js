const router = require('express').Router();


const {
  registration, login, verifyOtp, resendOtp, forgotPassword, resetNewPassword, changePassword, updateProfile,
  getOneScout,
  setupMfa,
  verifyMfaSetup,
  verifyMfa,
  getScoutsByState,
  getScoutsBySection,
  getScoutsByStateAndSection,
  updateUserProfile,
  getAuditTrail,
  disableMfa,
  setupTwofa,
  verifyEmailTwofa,
  disableEmailTwofa,
  verifyTwofaEmailOtp,
  getUserDashboardSummary,
  deleteUserAndAssociations, } = require("../controllers/userController");

const { auth, authorizeRoles } = require('../middleware/authMiddleware');
const { validateRegister, validateLogin,  validatePassword, validateChangePassword, } = require("../middleware/validate");

const { uploadProfilePic } = require('../utils/multer');
/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Role management endpoints
 */



/**
 * @swagger
 * /users/newRegister:
 *   post:
 *     summary: Register a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 example: "johndoe@example.com"
 *               phoneNumber:
 *                 type: string
 *                 example: "08012345678"
 *               gender:
 *                 type: string
 *                 enum: [Male, Female, Other]
 *                 example: "Male"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "1995-07-15"
 *               stateOfOrigin:
 *                 type: string
 *                 enum: ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"]
 *                 example: "Lagos"
 *               lga:
 *                 type: string
 *                 example: "Ikeja"
 *               address:
 *                 type: string
 *                 example: "123 Allen Avenue, Ikeja"
 *               stateScoutCouncil:
 *                 type: string
 *                 example: "Lagos State Scout Council"
 *               scoutDivision:
 *                 type: string
 *                 example: "Lagos Mainland"
 *               scoutDistrict:
 *                 type: string
 *                 example: "Ikeja District"
 *               troop:
 *                 type: string
 *                 example: "2nd Ikeja scout troop"
 *               scoutingRole:
 *                 type: string
 *                 example: "Scout Leader"
 *               section:
 *                 type: string
 *                 enum: [Cub, Scout, Venturer, Rover, Volunteers]
 *                 example: "Scout"
 *               password:
 *                 type: string
 *                 example: "StrongPass123"
 *             required:
 *               - fullName
 *               - email
 *               - phoneNumber
 *               - gender
 *               - dateOfBirth
 *               - stateOfOrigin
 *               - lga
 *               - address
 *               - stateScoutCouncil
 *               - scoutDivision
 *               - scoutDistrict
 *               - troop
 *               - section
 *               - scoutingRole
 *               - password
 *               - confirmPassword
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error or user already exists
 *       500:
 *         description: Internal server error
 */
router.post("/newRegister", validateRegister, registration);

/**
 * @swagger
 * /users/login:
 *   post:
 *     summary: Login user (email)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: "User's email"
 *               password:
 *                 type: string
 *             required: [email, password]
 *     responses:
 *       200:
 *         description: Login successful. MFA verification may be required.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 setupRequired:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 userId:
 *                   type: string
 *       400:
 *         description: Missing email or password
 *       401:
 *         description: Invalid credentials
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post("/login", validateLogin, login);


/**
 * @swagger
 * /users/verify-otp:
 *   post:
 *     summary: Verify OTP after registration or login
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *             required: [email, otp]
 *     responses:
 *       200:
 *         description: OTP verified successfully
 */
router.post("/verify-otp", verifyOtp);

/**
 * @swagger
 * /users/setup-mfa:
 *   post:
 *     summary: Setup Multi-Factor Authentication (MFA)
 *     description: |
 *       Allows users to setup different MFA methods: 
 *       - **authenticator** → Generates a QR code for Authenticator apps (Google Authenticator, Authy, etc.)  
 *       - **email** → Sends a one-time OTP code to the user's email  
 *       - **phone** → Sends a one-time OTP code to the user's phone number  
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - method
 *             properties:
 *               userId:
 *                 type: string
 *                 description: The ID of the user setting up MFA
 *                 example: 64fa1cbd12ab45f5e20c91a1
 *               method:
 *                 type: string
 *                 enum: [authenticator, email, phone]
 *                 description: MFA method to setup
 *                 example: authenticator
 *     responses:
 *       200:
 *         description: MFA setup response
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Scan this QR code with your Authenticator app
 *                     qrCodeUrl:
 *                       type: string
 *                       description: Base64 QR code image for scanning
 *                       example: data:image/png;base64,iVBORw0KGgoAAAANS...
 *                     secret:
 *                       type: string
 *                       description: Base32 secret for authenticator apps
 *                       example: JBSWY3DPEHPK3PXP
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: OTP sent to your email
 *                     otp:
 *                       type: string
 *                       description: One-time code sent via email
 *                       example: 123456
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: OTP sent to your phone
 *                     otp:
 *                       type: string
 *                       description: One-time code sent via SMS
 *                       example: 654321
 *       400:
 *         description: Invalid input or method not supported
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid MFA method
 *       500:
 *         description: Server error while setting up MFA
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to generate MFA setup
 */
router.post("/setup-mfa", setupMfa);

/**
 * @swagger
 * /users/verify-mfa-setup:
 *   post:
 *     summary: Verify MFA setup
 *     description: Verifies the MFA code for the selected method (authenticator app, email, or phone) and enables MFA for the user.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - method
 *               - token
 *             properties:
 *               userId:
 *                 type: string
 *                 description: The ID of the user verifying MFA.
 *               method:
 *                 type: string
 *                 enum: [authenticator, email, phone]
 *                 description: The MFA method being verified.
 *               token:
 *                 type: string
 *                 description: The 6-digit code from the selected MFA method.
 *     responses:
 *       200:
 *         description: MFA enabled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: MFA enabled successfully for authenticator app
 *       400:
 *         description: Invalid code or method
 *       403:
 *         description: Account is locked
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post("/verify-mfa-setup", verifyMfaSetup);

/**
 * @swagger
 * /users/verify-dmfa:
 *   post:
 *     summary: Verify multi-factor authentication (MFA)
 *     description: |
 *       Verifies MFA using **email OTP**, **phone OTP**, or **Authenticator App TOTP**.  
 *       At least one of `emailOtp`, `phoneOtp`, or `totp` must be provided.  
 *       If verification is successful, a final JWT token is returned.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: The ID of the user
 *                 example: "64f123abc456def789012345"
 *               emailOtp:
 *                 type: string
 *                 description: 6-digit OTP sent to the user's email
 *                 example: "123456"
 *               phoneOtp:
 *                 type: string
 *                 description: 6-digit OTP sent to the user's phone
 *                 example: "654321"
 *               totp:
 *                 type: string
 *                 description: 6-digit code from authenticator app
 *                 example: "987654"
 *     responses:
 *       200:
 *         description: MFA verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: MFA verified successfully
 *                 token:
 *                   type: string
 *                   description: JWT token with MFA verified
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "64f123abc456def789012345"
 *                     fullName:
 *                       type: string
 *                       example: "John Doe"
 *                     email:
 *                       type: string
 *                       example: "john@example.com"
 *                     membershipId:
 *                       type: string
 *                       example: "MEM12345"
 *       400:
 *         description: Invalid MFA code or expired OTP
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post("/verify-dmfa", verifyMfa)



/**
 * @swagger
 * /users/disable:
 *   post:
 *     summary: Disable a specific MFA method
 *     description: Allows a user to disable a previously enabled MFA method (authenticator, email, or phone).
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - method
 *             properties:
 *               userId:
 *                 type: string
 *                 description: The ID of the user whose MFA method should be disabled.
 *                 example: "650d7f5b2e56b4f23cd12345"
 *               method:
 *                 type: string
 *                 description: The MFA method to disable (`authenticator`, `email`, or `phone`).
 *                 example: "authenticator"
 *     responses:
 *       200:
 *         description: MFA method disabled successfully
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
 *                   example: "authenticator 2FA disabled successfully"
 *       400:
 *         description: Invalid method or request body
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
 *                   example: "Invalid MFA method"
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
 *                   example: "User not found"
 *       500:
 *         description: Internal server error
 */
router.post("/disable", auth, disableMfa);


/**
 * @swagger
 * /users/resend-otp:
 *   post:
 *     summary: Resend OTP
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *             required: [userId]
 *     responses:
 *       200:
 *         description: OTP resent successfully
 */
router.post("/resend-otp", resendOtp);

/**
 * @swagger
 * /users/forgot-password:
 *   post:
 *     summary: Request password reset OTP
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *             required: [email]
 *     responses:
 *       200:
 *         description: Password reset OTP sent to email
 */
router.post("/forgot-password", forgotPassword);


/**
 * @swagger
 * /users/reset-password:
 *   post:
 *     summary: Reset password using OTP
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *                 description: 6-digit OTP sent to user email
 *               password:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *             required: [email, otp, password, confirmPassword]
 *     responses:
 *       200:
 *         description: Password reset successfully
 */
router.post("/reset-password", validatePassword, resetNewPassword);


/**
 * @swagger
 * /users/change-password:
 *   post:
 *     summary: Change password (authenticated user)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *             required: [oldPassword, newPassword, confirmPassword]
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.post("/change-password", auth, validateChangePassword, changePassword);


/**
 * @swagger
 * /users/scout/{id}:
 *   get:
 *     summary: Get a scout by ID
 *     description: Fetches a single scout (user) by their MongoDB ID.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The unique ID of the scout (MongoDB ObjectId).
 *         schema:
 *           type: string
 *           example: 66efbbbaacc112233445566
 *     responses:
 *       200:
 *         description: User fetched successfully
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
 *                   example: User fetched successfully
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request (ID missing or invalid)
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */

router.get("/scout/:id", getOneScout);


/**
 * @swagger
 * /users/update-profile:
 *   put:
 *     summary: Update user profile (with profile picture)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *               profilePic:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put("/update-profile", uploadProfilePic.single("profilePic"), updateProfile);

/**
 * @swagger
 * /users/scouts/{stateScoutCouncil}:
 *   get:
 *     summary: Get scouts by state scout Council
 *     description: Retrieve all scouts that belong to a specific state scout council.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: stateScoutCouncil
 *         schema:
 *           type: string
 *         required: true
 *         description: The state scout council of scouts to filter
 *         example: Lagos
 *     responses:
 *       200:
 *         description: Scouts retrieved successfully
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
 *                   example: Scouts from Lagos retrieved successfully
 *                 count:
 *                   type: integer
 *                   example: 2
 *                 scouts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Scout'
 *       400:
 *         description: Bad request (missing state scout council)
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
 *                   example: StateScoutCouncil is required
 *       404:
 *         description: No scouts found
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
 *                   example: No scouts found in Lagos
 *       500:
 *         description: Internal server error
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
router.get("/scouts/:stateScoutCouncil", auth, authorizeRoles("superAdmin", "nsAdmin"), getScoutsByState)

/**
 * @swagger
 * /users/scouts/section/{section}:
 *   get:
 *     summary: Get scouts by section
 *     description: Fetch all scouts that belong to a specific section (e.g., Scout, Cub, Rover).
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: section
 *         schema:
 *           type: string
 *         required: true
 *         description: The section of the scouts to fetch
 *         example: "Scout"
 *     responses:
 *       200:
 *         description: Scouts fetched successfully
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
 *                   example: Scouts fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Scout'
 *       404:
 *         description: No scouts found in the section
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
 *                   example: No scouts found in section
 *       500:
 *         description: Internal server error
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
router.get("/scouts/section/:section", getScoutsBySection)

/**
 * @swagger
 * /users/scouts/state/{stateScoutCouncil}/section/{section}:
 *   get:
 *     summary: Get scouts by state scout Council and section
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: stateScoutCouncil
 *         required: true
 *         schema:
 *           type: string
 *         description: The state scout Council to filter scouts
 *         example: "Lagos"
 *       - in: path
 *         name: section
 *         required: true
 *         schema:
 *           type: string
 *         description: The section of the scout
 *         example: "Scout"
 *     responses:
 *       200:
 *         description: Scouts fetched successfully
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
 *                   example: Scouts fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Scout'
 *       404:
 *         description: No scouts found for the given state and section
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
 *                   example: No scouts found in state Lagos under section Scout
 *       500:
 *         description: Internal server error
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
router.get("/scouts/state/:stateScoutCouncil/section/:section", auth, authorizeRoles("superAdmin", "nsAdmin"), getScoutsByStateAndSection)

/**
 * @swagger
 * /users/delete/{id}:
 *   delete:
 *     summary: Delete a user and all their associated data (logs, awards, trainings, events)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Permanently delete a user by ID, including all related records:
 *       - Logs
 *       - Awards
 *       - Trainings
 *       - Events
 *       - Any attached images from Cloudinary
 *
 *       **Access Control:**
 *       - Only `superAdmin` and `nsAdmin` can delete any user.
 *       - `ssAdmin` can only delete users within their state council.
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to delete.
 *     responses:
 *       200:
 *         description: User and all related data deleted successfully
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
 *                   example: User and all related records deleted successfully
 *       400:
 *         description: Invalid user ID
 *       401:
 *         description: Unauthorized. Missing or invalid token.
 *       403:
 *         description: Forbidden. You do not have permission.
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.delete("/delete/:id", auth, authorizeRoles("superAdmin", "nsAdmin", "ssAdmin"), deleteUserAndAssociations);


/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Update the logged-in user's profile
 *     tags: [Audit]
 *     description: |
 *       Allows the logged-in user to update their profile fields such as name, phone number, address, scouting information, and upload a profile picture.  
 *       
 *       - The user ID is automatically taken from the authentication token, **not** the request path.  
 *       - Changes to profile fields are saved, and updates to `scoutingRole` are recorded in the audit trail.  
 *       - Each audit trail entry contains the field changed, the old and new values, who made the change, and the timestamp.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               scoutingRole:
 *                 type: string
 *                 example: "Scout Leader"
 *               fullName:
 *                 type: string
 *                 example: "John Doe"
 *               phoneNumber:
 *                 type: string
 *                 example: "12345678987"
 *               address:
 *                 type: string
 *                 example: "123 Scout Street, Lagos"
 *               section:
 *                 type: string
 *                 example: "Cub"
 *               gender:
 *                 type: string
 *                 example: "Male"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "1995-05-20"
 *               stateScoutCouncil:
 *                 type: string
 *                 example: "Lagos Council"
 *               lga:
 *                 type: string
 *                 example: "Ikeja"
 *               scoutDivision:
 *                 type: string
 *                 example: "Division A"
 *               scoutDistrict:
 *                 type: string
 *                 example: "District 5"
 *               troop:
 *                 type: string
 *                 example: "Troop 12"
 *               stateOfOrigin:
 *                 type: string
 *                 example: "FCT"
 *               profilePic:
 *                 type: string
 *                 format: binary
 *                 description: Upload a profile picture file
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                   example: Profile updated successfully
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.put('/profile', auth, uploadProfilePic.single("profilePic"), updateUserProfile);

/**
 * @swagger
 * /users/audit-trail/{userId}:
 *   get:
 *     summary: Retrieve audit trail for a specific user
 *     tags: [Audit]
 *     description: |
 *       Fetches the audit trail for the given user ID.  
 *       The audit trail contains records of profile changes, including which field was updated, the old and new values, who made the change, and when.  
 *       
 *       - If the user does not exist, a `404` is returned.  
 *       - If no audit trail records are found for the user, a `404` is returned.  
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user whose audit trail will be retrieved
 *     responses:
 *       200:
 *         description: Audit trail retrieved successfully
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
 *                   example: Audit trail retrieved successfully
 *                 auditTrail:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                         example: "scoutingRole"
 *                       oldValue:
 *                         type: string
 *                         example: "Member"
 *                       newValue:
 *                         type: string
 *                         example: "Scout Leader"
 *                       changedBy:
 *                         type: string
 *                         example: "admin@example.com"
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-09-21T12:34:56Z"
 *       404:
 *         description: User not found or no audit trail records exist
 *       500:
 *         description: Internal server error
 */
router.get('/audit-trail/:userId', auth, getAuditTrail);

/**
 * @swagger
 * /users/auth/2fa/setup:
 *   post:
 *     summary: Initiate Two-Factor Authentication (2FA) setup
 *     tags: [Users]
 *     description: |
 *       Generates a One-Time Password (OTP) and sends it to the user's registered email.  
 *       The OTP is valid for 10 minutes and is required to complete the 2FA verification process.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: The ID of the user requesting 2FA setup.
 *                 example: "651f0bcd12345a7890abcdef"
 *     responses:
 *       200:
 *         description: OTP sent successfully
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
 *                     message:
 *                       type: string
 *                       example: OTP has been sent to your email
 *       400:
 *         description: Invalid request (e.g., missing or invalid userId)
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
 *                   example: Invalid userId
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
 *       500:
 *         description: Internal server error
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
router.post('/auth/2fa/setup', auth, setupTwofa);


/**
 * @swagger
 * /users/twofa/verify:
 *   post:
 *     summary: Verify setup email OTP and enable email 2FA
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - otp
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user
 *                 example: "6501abc123xyz"
 *               otp:
 *                 type: string
 *                 description: 6-digit OTP sent to the user's email
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email 2FA enabled successfully
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
 *                   example: "Email 2FA has been enabled successfully"
 *       400:
 *         description: Invalid OTP or already enabled
 *       404:
 *         description: User not found
 */
router.post("/twofa/verify", auth, verifyEmailTwofa);

/**
 * @swagger
 * /users/twofa/disable:
 *   post:
 *     summary: Disable email 2FA
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user
 *                 example: "6501abc123xyz"
 *     responses:
 *       200:
 *         description: Email 2FA disabled successfully
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
 *                   example: "Email 2FA has been disabled successfully"
 *       400:
 *         description: Email 2FA not currently enabled
 *       404:
 *         description: User not found
 */
router.post("/twofa/disable", auth, disableEmailTwofa);

/**
 * @swagger
 * /users/auth/login-email-2fa:
 *   post:
 *     summary: Verify Email 2FA OTP
 *     description: Verifies the OTP sent to the user's email during login when email-based 2FA is enabled.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - emailOtp
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "6521ab3f9e4a1c00218d1234"
 *               emailOtp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email 2FA verified successfully
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
 *                   example: "Email 2FA verified successfully"
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR..."
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "6521ab3f9e4a1c00218d1234"
 *                     fullName:
 *                       type: string
 *                       example: "John Doe"
 *                     email:
 *                       type: string
 *                       example: "johndoe@email.com"
 *                     membershipId:
 *                       type: string
 *                       example: "TSAN-12345"
 *       400:
 *         description: Invalid or expired OTP
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: "Invalid or expired OTP"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: "User not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: "Internal server error"
 */
router.post("/auth/login-email-2fa", verifyTwofaEmailOtp)

/**
 * @swagger
 * /users/dashboard/summary:
 *   get:
 *     summary: Get user dashboard summary (counts of ActivityLog, Event, and achievement)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard summary fetched successfully
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
 *                   example: User dashboard summary fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalLogs:
 *                       type: integer
 *                       example: 5
 *                     totalEvents:
 *                       type: integer
 *                       example: 3
 *                     achievement:
 *                       type: integer
 *                       example: 2
 *       401:
 *         description: Unauthorized (Invalid or missing token)
 *       500:
 *         description: Internal server error
 */
router.get("/dashboard/summary", auth, getUserDashboardSummary );


module.exports = router;
