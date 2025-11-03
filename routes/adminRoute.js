const router = require("express").Router();
const { auth, authorizeRoles } = require('../middleware/authMiddleware');
const { promoteRole, demoteRole, updateMemberStatus, getAllUsers, getUsersByStatus, getUserRoleStats, getReportStatistics, sendMessageToScouts, deleteMessage, getAllMessages, getAllAuditTrails, exportReportStatistics, inviteUser, resendInvitation, getUserWithAllDetails, manageAllEvents, manageAllRecords, getAllAdmins, adminEditUser, searchEventsByTitle, countUserStatus, acceptItem, rejectItem, getAllRecordStats } = require('../controllers/adminController');
const { uploadGeneralFile } = require("../utils/multer");

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Role management endpoints
 */


/**
 * @swagger
 * /admin/status:
 *   patch:
 *     summary: Update member status (active, inactive, suspended)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Allows an admin to update the status of a user to reflect real-time engagement. 
 *       Only users with roles `superAdmin`, `nsAdmin`, or `ssAdmin` can perform this action.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - status
 *             properties:
 *               userId:
 *                 type: string
 *                 description: The ID of the user whose status will be updated.
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended]
 *                 description: The new status to assign to the user.
 *             example:
 *               userId: 64f1b2d4f3a2b3c4d5e6f7a8
 *               status: suspended
 *     responses:
 *       200:
 *         description: Member status updated successfully
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
 *                   example: User status updated to suspended
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request, missing or invalid parameters
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
 *                   example: userId and status are required
 *       401:
 *         description: Unauthorized, admin role required
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
 *                   example: Unauthorized
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
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         fullName:
 *           type: string
 *         email:
 *           type: string
 *         phoneNumber:
 *           type: string
 *         role:
 *           type: string
 *           enum: [member, leader, ssAdmin, nsAdmin, superAdmin]
 *         status:
 *           type: string
 *           enum: [active, inactive, suspended]
 *         membershipId:
 *           type: string
 *         section:
 *           type: string
 *           enum: [Cub, Scout, Venturer, Rover, Volunteers]
 *         profilePic:
 *           type: string
 */
router.patch('/status', auth, authorizeRoles("superAdmin", "nsAdmin", "ssAdmin"), updateMemberStatus);

/**
 * @swagger
 * /admin/promote:
 *   post:
 *     summary: Promote a user by email (SuperAdmin or nsAdmin)
 *     description: 
 *       Allows **SuperAdmin** to promote any user to any role.  
 *       Allows **nsAdmin** to promote only members, but **cannot** assign the SuperAdmin role.  
 *       If `stateScoutCouncil` is not provided, it defaults to **FCT Scout Council**.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - newRole
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: The email of the user to promote
 *               newRole:
 *                 type: string
 *                 enum: [member, ssAdmin, nsAdmin, superAdmin]
 *                 description: The role to promote the user to
 *               stateScoutCouncil:
 *                 type: string
 *                 description: (Optional) The council assigned to the user — defaults to **FCT** if not provided.
 *     responses:
 *       200:
 *         description: User role promoted successfully
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
 *                   example: User promoted to nsAdmin
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request (invalid email or role)
 *       403:
 *         description: Forbidden - nsAdmin cannot promote to superAdmin or non-members
 *       404:
 *         description: User not found
 */
router.post('/promote', auth, authorizeRoles('superAdmin', 'nsAdmin'), promoteRole);


/**
 * @swagger
 * /admin/demote:
 *   post:
 *     summary: Demote a user by email (SuperAdmin or nsAdmin)
 *     description: 
 *       Allows **SuperAdmin** to demote any user to any role.  
 *       Allows **nsAdmin** to demote only members or lower admins, but **cannot** demote or assign SuperAdmin.  
 *       If `stateScoutCouncil` is not provided, it defaults to **FCT Scout Council**.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - newRole
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: The email of the user to demote
 *               newRole:
 *                 type: string
 *                 enum: [member, ssAdmin, nsAdmin, superAdmin]
 *                 description: The role to demote the user to
 *               stateScoutCouncil:
 *                 type: string
 *                 description: (Optional) The council assigned to the user — defaults to **FCT** if not provided.
 *     responses:
 *       200:
 *         description: User role demoted successfully
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
 *                   example: User demoted to member
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request (invalid email or role)
 *       403:
 *         description: Forbidden - nsAdmin cannot demote SuperAdmin or assign SuperAdmin
 *       404:
 *         description: User not found
 */
router.post('/demote', auth, authorizeRoles('superAdmin', 'nsAdmin'), demoteRole);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Get all users (Paginated)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Retrieve a paginated list of all users.  
 *       - **superAdmin** and **nsAdmin** can view all users.  
 *       - **ssAdmin** can only view users within their assigned `stateScoutCouncil`.  
 *       Supports pagination, sorting, and filtering by name, section, status, and state.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 20
 *         description: Number of users per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           example: "-createdAt"
 *         description: Sort users (e.g., `-createdAt` for newest first, `fullName` for A–Z)
 *       - in: query
 *         name: fullName
 *         schema:
 *           type: string
 *         description: Search users by full name (case-insensitive)
 *       - in: query
 *         name: section
 *         schema:
 *           type: string
 *           enum: [Cub, Scout, Venturer, Rover, Volunteers]
 *         description: Filter users by section
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended]
 *         description: Filter users by account status
 *       - in: query
 *         name: stateScoutCouncil
 *         schema:
 *           type: string
 *         description: Filter users by State Scout Council
 *     responses:
 *       200:
 *         description: Users retrieved successfully
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
 *                   example: Users fetched successfully
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: integer
 *                       example: 150
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     totalPages:
 *                       type: integer
 *                       example: 8
 *                     perPage:
 *                       type: integer
 *                       example: 20
 *                     hasNextPage:
 *                       type: boolean
 *                       example: true
 *                     hasPrevPage:
 *                       type: boolean
 *                       example: false
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       fullName:
 *                         type: string
 *                         example: "John Doe"
 *                       membershipId:
 *                         type: string
 *                         example: "SC12345"
 *                       scoutingRole:
 *                         type: string
 *                         example: "Troop Leader"
 *                       section:
 *                         type: string
 *                         example: "Scout"
 *                       stateScoutCouncil:
 *                         type: string
 *                         example: "Lagos"
 *                       status:
 *                         type: string
 *                         example: "active"
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — user role not permitted
 *       500:
 *         description: Internal server error
 */
router.get("/users", auth, authorizeRoles("superAdmin", "nsAdmin", "ssAdmin"), getAllUsers);

/**
 * @swagger
 * /admin/users/status/{status}:
 *   get:
 *     summary: Get users by status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Fetch users filtered by their status (`active`, `inactive`, or `suspended`).  
 *       - `superAdmin` and `nsAdmin` can see all users with the status.  
 *       - `ssAdmin` can only see users with the status in their own state Scout Council.
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended]
 *         description: The status of users to filter by
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 35
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid status value
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/users/status/:status", auth, authorizeRoles("superAdmin", "nsAdmin", "ssAdmin"), getUsersByStatus);

/**
 * @swagger
 * /admin/users/stats:
 *   get:
 *     summary: Get total count of each user role
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Returns total counts for each user role (`member`, `leader`, `ssAdmin`, `nsAdmin`, `superAdmin`).  
 *       - `superAdmin` and `nsAdmin` see all users.  
 *       - `ssAdmin` only sees users within their stateScoutCouncil.
 *     responses:
 *       200:
 *         description: Role statistics fetched successfully
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
 *                   example: User role statistics fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: integer
 *                       example: 150
 *                     member:
 *                       type: integer
 *                       example: 120
 *                     leader:
 *                       type: integer
 *                       example: 20
 *                     ssAdmin:
 *                       type: integer
 *                       example: 5
 *                     nsAdmin:
 *                       type: integer
 *                       example: 3
 *                     superAdmin:
 *                       type: integer
 *                       example: 2
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/users/stats", auth, authorizeRoles("superAdmin", "nsAdmin", "ssAdmin"), getUserRoleStats);
/**
 * @swagger
 * /admin/reports:
 *   get:
 *     summary: Get membership and scouting report statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       This endpoint provides comprehensive report statistics for members, including:  
 *       - **Membership Growth**: New users over time, grouped by section (Cub, Scout, Venturer, Rover, Volunteers).  
 *       - **Age Distribution**: Breakdown by age groups.  
 *       - **Gender Distribution**: Male, Female, Other.  
 *       - **Scouting Role Distribution**: Role-based count (e.g., Leader, Assistant, etc.).  
 *
 *       **Access Control:**  
 *       - `superAdmin` and `nsAdmin`: Can view statistics for all or a specific `stateScoutCouncil`.  
 *       - `ssAdmin`: Can only view statistics for their own `stateScoutCouncil`.  
 *
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [today, yesterday, thisMonth, thisYear, lastMonth, lastYear, allTime]
 *         description: >
 *           Filter reports by a specific time range.  
 *           - `today`: From midnight today until now  
 *           - `yesterday`: Full day before today  
 *           - `thisMonth`: From the first day of the current month until now  
 *           - `thisYear`: From January 1st of the current year until now  
 *           - `lastMonth`: Full previous month  
 *           - `lastYear`: Full previous year  
 *           - `allTime`: No time restriction  
 *         example: thisMonth
 *       - in: query
 *         name: stateScoutCouncil
 *         schema:
 *           type: string
 *         description: >
 *           Filter reports by a specific **State Scout Council**.  
 *           - Only available to `superAdmin` and `nsAdmin`.  
 *           - Example: `Lagos`, `Abuja`, `Kano`, etc.  
 *           - If omitted, defaults to "All" for top admins or the user's assigned council for `ssAdmin`.
 *         example: Lagos
 *
 *     responses:
 *       200:
 *         description: Report statistics retrieved successfully
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
 *                   example: Report statistics fetched successfully
 *                 filterRange:
 *                   type: string
 *                   example: thisMonth
 *                 filtersApplied:
 *                   type: object
 *                   properties:
 *                     stateScoutCouncil:
 *                       type: string
 *                       example: Lagos
 *                     dateRange:
 *                       type: object
 *                       properties:
 *                         startDate:
 *                           type: string
 *                           format: date-time
 *                           example: "2025-10-01T00:00:00.000Z"
 *                         endDate:
 *                           type: string
 *                           format: date-time
 *                           example: "2025-10-29T23:59:59.999Z"
 *                 data:
 *                   type: object
 *                   properties:
 *                     membershipGrowth:
 *                       type: object
 *                       description: >
 *                         New members grouped by date and section.  
 *                         Each key is a date, and each value is an object containing counts per section.
 *                       example:
 *                         "2025-10-25":
 *                           Cub: 2
 *                           Scout: 3
 *                           Venturer: 1
 *                           Rover: 4
 *                           Volunteers: 0
 *                         "2025-10-26":
 *                           Cub: 1
 *                           Scout: 2
 *                           Venturer: 0
 *                           Rover: 3
 *                           Volunteers: 1
 *                     ageDistribution:
 *                       type: object
 *                       description: Count of members by age groups
 *                       properties:
 *                         Under 18:
 *                           type: integer
 *                           example: 15
 *                         18-25:
 *                           type: integer
 *                           example: 42
 *                         26-35:
 *                           type: integer
 *                           example: 30
 *                         36-50:
 *                           type: integer
 *                           example: 20
 *                         Above 50:
 *                           type: integer
 *                           example: 8
 *                     genderDistribution:
 *                       type: array
 *                       description: Count of members by gender
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: Male
 *                           total:
 *                             type: integer
 *                             example: 50
 *                     scoutingRoleDistribution:
 *                       type: array
 *                       description: Count of members by scouting role
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: Leader
 *                           total:
 *                             type: integer
 *                             example: 25
 *       401:
 *         description: Unauthorized. Missing or invalid token.
 *       403:
 *         description: Forbidden. You do not have access to this resource.
 *       500:
 *         description: Internal server error.
 */
router.get("/reports", auth, authorizeRoles("superAdmin", "nsAdmin", "ssAdmin"),getReportStatistics);

/**
 * @swagger
 * /admin/send-message:
 *   post:
 *     summary: Send a message to scouts (filtered by section or role)
 *     description: |
 *       Allows **superAdmin**, **nsAdmin**, and **ssAdmin** to broadcast messages to scouts.
 *       
 *       - **superAdmin** and **nsAdmin** can message all scouts nationwide.
 *       - **ssAdmin** can only message scouts within their own **stateScoutCouncil**.
 *       - Optionally filter recipients by scout **section** (e.g., Cub, Scout, Venturer, Rover, Volunteers).
 *       
 *       Supports optional file attachments (PDF, image, etc.).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - message
 *             properties:
 *               subject:
 *                 type: string
 *                 example: "Monthly Scout Update"
 *               message:
 *                 type: string
 *                 example: "Hello Scouts, here are the updates for this month..."
 *               section:
 *                 type: string
 *                 description: |
 *                   Filter messages by scout section.  
 *                   If omitted or set to `"all"`, the message is sent to all eligible scouts.  
 *                   Valid options are:
 *                   - Cub  
 *                   - Scout  
 *                   - Venturer  
 *                   - Rover  
 *                   - Volunteers
 *                 example: "Scout"
 *               attachment:
 *                 type: string
 *                 format: binary
 *                 description: Optional attachment file (PDF, image, etc.)
 *     responses:
 *       200:
 *         description: Message sent successfully
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
 *                   example: "Message sent successfully to scouts"
 *                 data:
 *                   type: object
 *                   properties:
 *                     subject:
 *                       type: string
 *                       example: "Monthly Scout Update"
 *                     sentBy:
 *                       type: string
 *                       example: "John Doe"
 *                     sentTo:
 *                       type: string
 *                       example: "All Scouts" 
 *                     dateSent:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-10T09:00:00.000Z"
 *                     attachmentUrl:
 *                       type: string
 *                       nullable: true
 *                       example: "https://res.cloudinary.com/tsan_attachments/file.pdf"
 *       400:
 *         description: Validation error (missing fields or invalid data)
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
 *                   example: "Subject and message are required"
 *       403:
 *         description: Unauthorized role
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
 *                   example: "Access denied. Only Admin roles can send messages."
 *       404:
 *         description: No scouts found to send message to
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
 *                   example: "No scouts found to send message to"
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
 *                   example: "Internal server error: <error message>"
 */
router.post("/send-message", auth, authorizeRoles("superAdmin", "nsAdmin", "ssAdmin"), uploadGeneralFile.single("attachment"), sendMessageToScouts);

/**
 * @swagger
 * /admin/messages:
 *   get:
 *     summary: Get all messages (with pagination, search, and recipient section filter)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search messages by subject, content, or sender/recipient name
 *       - in: query
 *         name: recipientSection
 *         schema:
 *           type: string
 *           enum: [National, State, District, Unit]
 *         description: Filter messages by recipient section
 *     responses:
 *       200:
 *         description: Messages fetched successfully
 *       404:
 *         description: No messages found
 *       500:
 *         description: Internal server error
 */
router.get("/messages", auth, authorizeRoles("superAdmin", "nsAdmin", "ssAdmin"),getAllMessages);

/**
 * @swagger
 * /admin/messages/{id}:
 *   delete:
 *     summary: Delete a message
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Delete a specific message.  
 *       - **superAdmin** and **nsAdmin** can delete any message.  
 *       - **ssAdmin** can delete only messages sent from their **State Scout Council**.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the message to delete
 *     responses:
 *       200:
 *         description: Message deleted successfully
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
 *                   example: Message deleted successfully
 *                 deletedMessageId:
 *                   type: string
 *                   example: 67071b789b5d243a8f51c91a
 *                 deletedBy:
 *                   type: string
 *                   example: Jane Doe
 *                 senderState:
 *                   type: string
 *                   example: Lagos State Scout Council
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - You are not allowed to delete this message
 *       404:
 *         description: Message not found
 *       500:
 *         description: Internal server error
 */
router.delete("/messages/:id", auth, authorizeRoles("superAdmin", "nsAdmin", "ssAdmin"), deleteMessage);

/**
 * @swagger
 * /admin/auditTrails:
 *   get:
 *     summary: Get all audit trail records (Paginated)
 *     description: 
 *       Retrieve audit trail records with pagination and access control.  
 *       - **superAdmin** and **nsAdmin** can view **all** records.  
 *       - **ssAdmin** can view only records related to their **stateScoutCouncil**.  
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: The page number for pagination (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 20
 *         description: Number of records per page (default 20)
 *     responses:
 *       200:
 *         description: List of audit trail entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 total:
 *                   type: integer
 *                   example: 125
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 totalPages:
 *                   type: integer
 *                   example: 7
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 67184a5f9b2e1c9e12345678
 *                       userId:
 *                         type: string
 *                         example: 670abc12345f1e9b5d00c123
 *                       field:
 *                         type: string
 *                         example: "training.status"
 *                       oldValue:
 *                         type: string
 *                         example: "Pending"
 *                       newValue:
 *                         type: string
 *                         example: "Verified"
 *                       changedBy:
 *                         type: string
 *                         example: "John Doe (ssAdmin)"
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-10-13T14:32:10.000Z"
 *       401:
 *         description: Unauthorized or missing token
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: "Authorization token required"
 *       403:
 *         description: Forbidden - user does not have permission
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: "You don’t have access"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: "Server error"
 */
router.get( "/auditTrails", auth, authorizeRoles("superAdmin", "nsAdmin", "ssAdmin"),getAllAuditTrails);

/**
 * @swagger
 * /admin/reports/export/statistics:
 *   get:
 *     summary: Export scouting statistics report (CSV format)
 *     description: |
 *       - **superAdmin** and **nsAdmin** can export all reports.  
 *       - **ssAdmin** can export reports limited to their `stateScoutCouncil`.  
 *       - Returns a downloadable CSV file containing summary and detailed statistics of scouts.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         required: false
 *         schema:
 *           type: string
 *           enum: [today, yesterday, last30days, lastMonth, lastYear, all]
 *         description: |
 *           Time range for the report.  
 *           Defaults to `all` if not provided.
 *     responses:
 *       200:
 *         description: CSV file containing scout statistics report
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *             example: |
 *               "Report","Scout Statistics Report"
 *               "Range","last30days"
 *               "Section","Summary Statistics"
 *               "Age Distribution","{ 'Under 18': 10, '18-25': 25, '26-35': 15, '36-50': 5, 'Above 50': 2 }"
 *               "Gender Distribution","[{ _id: 'Male', total: 30 }, { _id: 'Female', total: 27 }]"
 *               "Scouting Roles","[{ _id: 'Scout', total: 40 }, { _id: 'Leader', total: 17 }]"
 *               "Section","User Details"
 *               "No","FullName","Email","Gender","ScoutingRole","StateScoutCouncil","DateOfBirth","RegisteredOn"
 *               "1","John Doe","john@example.com","Male","Scout","Lagos State","2000-05-15","2024-10-10 10:22:00"
 *       403:
 *         description: Unauthorized — only ssAdmin, nsAdmin, or superAdmin roles are allowed
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: "Not authorized to export reports"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: "Failed to export report statistics"
 *               error: "Error message details"
 */
router.get("/reports/export/statistics",  auth,authorizeRoles("superAdmin", "nsAdmin", "ssAdmin"),exportReportStatistics);


/**
 * @swagger
 * /admin/invite/resend:
 *   post:
 *     summary: Resend an existing invitation link
 *     description: Resends a new onboarding link if the previous invitation expired or was not used.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: johndoe@example.com
 *     responses:
 *       200:
 *         description: Invitation resent successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Invitation resent successfully.
 *       400:
 *         description: Invitation already accepted or invalid.
 *       404:
 *         description: Invitation not found.
 *       500:
 *         description: Server error while resending invitation.
 */
router.post("/invite/resend", auth, authorizeRoles("superAdmin", "nsAdmin"), resendInvitation);

/**
 * @swagger
 * /admin/invite:
 *   post:
 *     summary: Invite a new admin user (SuperAdmin or NSAdmin only)
 *     description: Sends an onboarding email with a unique invitation link to the provided email address.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - role
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: johndoe@example.com
 *               role:
 *                 type: string
 *                 enum: [ssAdmin, nsAdmin, superAdmin]
 *                 example: ssAdmin
 *               council:
 *                 type: string
 *                 description: Optional. Defaults to "FCT" if not provided.
 *                 example: Lagos State Scout Council
 *     responses:
 *       201:
 *         description: Invitation sent successfully.
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
 *                   example: Invitation sent successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     fullName:
 *                       type: string
 *                       example: John Doe
 *                     email:
 *                       type: string
 *                       example: johndoe@example.com
 *                     role:
 *                       type: string
 *                       example: ssAdmin
 *                     council:
 *                       type: string
 *                       example: Lagos State Scout Council
 *                     expiresAt:
 *                       type: string
 *                       example: 2025-10-20T12:34:56.789Z
 *       400:
 *         description: Invalid request (user exists, invalid role, or active pending invite).
 *       403:
 *         description: Forbidden — only SuperAdmin or NSAdmin can invite users.
 *       500:
 *         description: Internal server error.
 */
router.post("/invite", auth, authorizeRoles("superAdmin", "nsAdmin"), inviteUser);

/**
 * @swagger
 * /admin/user/{id}:
 *   get:
 *     summary: Get detailed information about a user (Admin only)
 *     description: >
 *       Allows admins (`ssAdmin`, `nsAdmin`, `superAdmin`) to fetch a specific user's full details, 
 *       including their **awards**, **trainings**, **events**, and **activities**.  
 *       - `ssAdmin` can only access users within their **stateScoutCouncil**.  
 *       - `nsAdmin` and `superAdmin` can access users from **all states**.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the user to fetch
 *         schema:
 *           type: string
 *           example: 68cf014ccafcc9a646cc685f
 *     responses:
 *       200:
 *         description: User details fetched successfully
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
 *                   example: User details fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: 68cf014ccafcc9a646cc685f
 *                         fullName:
 *                           type: string
 *                           example: Thomas Kadar
 *                         membershipId:
 *                           type: string
 *                           example: SC12345
 *                         profilePics:
 *                           type: string
 *                           example: https://res.cloudinary.com/dorpfhbpg/image/upload/v1759084531/users/profile.jpg
 *                         section:
 *                           type: string
 *                           example: Scout
 *                         scoutingRole:
 *                           type: string
 *                           example: Troop Leader
 *                         state:
 *                           type: string
 *                           example: Lagos
 *                         role:
 *                           type: string
 *                           example: scout
 *                         email:
 *                           type: string
 *                           example: konxiv@gmail.com
 *                     awards:
 *                       type: array
 *                       description: List of awards created by this user
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: 68f8556adfd0838fc76b7829
 *                           title:
 *                             type: string
 *                             example: Community Service
 *                           description:
 *                             type: string
 *                             example: Awarded for community engagement
 *                     trainings:
 *                       type: array
 *                       description: Trainings uploaded by this user
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: 68f8666adfd0838fc76b7901
 *                           trainingType:
 *                             type: string
 *                             example: Leadership Course
 *                     events:
 *                       type: array
 *                       description: Events created by this user
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: 68f8777adfd0838fc76b8012
 *                           title:
 *                             type: string
 *                             example: Scout Unity Camp
 *                           date:
 *                             type: string
 *                             example: 2025-12-30T00:00:00.000Z
 *                     activities:
 *                       type: array
 *                       description: Activities created by this user
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: 68f8888adfd0838fc76b8123
 *                           title:
 *                             type: string
 *                             example: Tree Planting
 *                           description:
 *                             type: string
 *                             example: Scout tree planting awareness program
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: Authorization token required
 *       403:
 *         description: Access denied (role or state restriction)
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: Access denied Different state
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: User not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: Internal server error
 */
router.get("/user/:id", auth, authorizeRoles("ssAdmin", "nsAdmin", "superAdmin"), getUserWithAllDetails);

/**
 * @swagger
 * /admin/events/manage:
 *   get:
 *     summary: Manage all events (Admins only)
 *     description: |
 *       Retrieve a paginated list of events.  
 *       **Role permissions:**  
 *       - `superAdmin` and `nsAdmin`: Manage all events across all states.  
 *       - `ssAdmin`: Only manage events created by users within their own `stateScoutCouncil`.  
 *       
 *       **Filter options:**  
 *       Use the `status` query parameter to filter by approval status:
 *       - `approved`: Only approved events  
 *       - `pending`: Only unapproved (pending) events
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [approved, pending]
 *         description: Filter events by approval status (`approved` or `pending`)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number for pagination (default is 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *         description: Number of results per page (default is 10)
 *     responses:
 *       200:
 *         description: Successfully fetched events
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
 *                   example: "Fetched approved events successfully"
 *                 totalEvents:
 *                   type: integer
 *                   example: 25
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 totalPages:
 *                   type: integer
 *                   example: 3
 *                 pageSize:
 *                   type: integer
 *                   example: 10
 *                 events:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "671b34c89243ab3c4f4c91d3"
 *                       title:
 *                         type: string
 *                         example: "Scout Leadership Training"
 *                       description:
 *                         type: string
 *                         example: "A 3-day leadership training for scouts in Lagos state."
 *                       date:
 *                         type: string
 *                         format: date
 *                         example: "2025-11-10"
 *                       time:
 *                         type: string
 *                         example: "10:00 AM"
 *                       location:
 *                         type: string
 *                         example: "Lagos Scout Council"
 *                       approved:
 *                         type: boolean
 *                         example: true
 *                       createdBy:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "6708fa45bbfc3f176f1e21d1"
 *                           fullName:
 *                             type: string
 *                             example: "Samuel Adekunle"
 *                           email:
 *                             type: string
 *                             example: "samuel@example.com"
 *                           stateScoutCouncil:
 *                             type: string
 *                             example: "Lagos State Scout Council"
 *       400:
 *         description: Invalid status filter provided
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: "Invalid status filter. Use 'pending' or 'approved'."
 *       403:
 *         description: Unauthorized access (non-admin user)
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: "Access denied. Admin privileges required."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               status: false
 *               message: "Internal server error: Database connection failed"
 */
router.get("/events/manage", auth, authorizeRoles("superAdmin", "nsAdmin", "ssAdmin"),manageAllEvents);

/**
 * @swagger
 * /admin/manage-records:
 *   get:
 *     summary: Retrieve all events, trainings, awards, and activity logs filtered by status
 *     tags: [Admin]
 *     description: >
 *       This endpoint allows **superAdmin**, **nsAdmin**, and **ssAdmin** to view all events, trainings, awards, and activity logs.  
 *       You can filter results using query parameters like `status`, `page`, and `limit`.
 *       <br><br>
 *       **Status rules:**
 *       - `pending`: approved = false, or status = "pending"/"in-progress"
 *       - `active`: approved = true, or status = "approved"/"active"/"verified"
 *       - `expired`: status = "expired"/"closed"
 *       - `verified`: training status = "verified"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, active, expired, verified]
 *         required: false
 *         description: Filter records by status type.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         required: false
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         required: false
 *         description: Number of records per page.
 *     responses:
 *       200:
 *         description: Successfully retrieved records
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
 *                   example: Fetched active records successfully
 *                 filter:
 *                   type: string
 *                   example: active
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     eventsCount:
 *                       type: integer
 *                       example: 12
 *                     trainingsCount:
 *                       type: integer
 *                       example: 8
 *                     awardsCount:
 *                       type: integer
 *                       example: 5
 *                     logsCount:
 *                       type: integer
 *                       example: 3
 *                 data:
 *                   type: object
 *                   properties:
 *                     events:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           approved:
 *                             type: boolean
 *                           createdBy:
 *                             type: object
 *                             properties:
 *                               fullName:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               stateScoutCouncil:
 *                                 type: string
 *                     trainings:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           trainingType:
 *                             type: string
 *                           status:
 *                             type: string
 *                           scout:
 *                             type: object
 *                             properties:
 *                               fullName:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                     awards:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           awardName:
 *                             type: string
 *                           status:
 *                             type: string
 *                           scout:
 *                             type: object
 *                             properties:
 *                               fullName:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                     activityLogs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           logType:
 *                             type: string
 *                           status:
 *                             type: string
 *                           scout:
 *                             type: object
 *                             properties:
 *                               fullName:
 *                                 type: string
 *                               email:
 *                                 type: string
 *       400:
 *         description: Invalid status query parameter
 *       403:
 *         description: Access denied. Admin privileges required.
 *       500:
 *         description: Internal server error
 */
router.get("/manage-records", auth, manageAllRecords);

/**
 * @swagger
 * /admin/admins:
 *   get:
 *     summary: Get all admin users
 *     description: Retrieve a paginated list of admin users (superAdmin, nsAdmin, ssAdmin, or leader).  
 *       - **superAdmin** and **nsAdmin** can view all admins.  
 *       - **ssAdmin** can view admins only within their stateScoutCouncil.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter admins by full name (case-insensitive)
 *         example: "John"
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [superAdmin, nsAdmin, ssAdmin, leader]
 *         description: Filter by specific admin role
 *         example: "nsAdmin"
 *       - in: query
 *         name: stateScoutCouncil
 *         schema:
 *           type: string
 *         description: Filter by state scout council
 *         example: "Lagos"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of records per page
 *         example: 10
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order by creation date
 *         example: desc
 *     responses:
 *       200:
 *         description: Successfully fetched admin users
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
 *                   example: Admins fetched successfully
 *                 totalAdmins:
 *                   type: integer
 *                   example: 45
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 totalPages:
 *                   type: integer
 *                   example: 5
 *                 pageSize:
 *                   type: integer
 *                   example: 10
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       fullName:
 *                         type: string
 *                         example: "Jane Doe"
 *                       email:
 *                         type: string
 *                         example: "jane@example.com"
 *                       role:
 *                         type: string
 *                         example: "nsAdmin"
 *                       stateScoutCouncil:
 *                         type: string
 *                         example: "Lagos"
 *                       status:
 *                         type: string
 *                         enum: [active, inactive, suspended]
 *                         example: "active"
 *                       lastSignedIn:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-10-20T14:48:00.000Z"
 *       400:
 *         description: Invalid request or bad query parameters
 *       403:
 *         description: Access denied (non-admin user)
 *       500:
 *         description: Internal server error
 */
router.get("/admins", auth, authorizeRoles("superAdmin", "nsAdmin", "ssAdmin"), getAllAdmins);

/**
 * @swagger
 * /admin/adminEdit/{id}:
 *   patch:
 *     summary: Admin edit user details
 *     description: Allows admin-level users (ssAdmin, nsAdmin, superAdmin) to edit user details.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The user ID to update
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *               stateScoutCouncil:
 *                 type: string
 *               scoutDivision:
 *                 type: string
 *               scoutDistrict:
 *                 type: string
 *               troop:
 *                 type: string
 *               scoutingRole:
 *                 type: string
 *               section:
 *                 type: string
 *     responses:
 *       200:
 *         description: User details updated successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.patch("/adminEdit/:id", auth, authorizeRoles("ssAdmin", "nsAdmin", "superAdmin"), adminEditUser);

/**
 * @swagger
 * /admin/checkSearch:
 *   get:
 *     summary: Search events by title
 *     description: Returns a list of events whose titles match the search query (case-insensitive).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: title
 *         required: true
 *         schema:
 *           type: string
 *         description: The title or partial title of the event to search for
 *     responses:
 *       200:
 *         description: List of matching events
 *         content:
 *           application/json:
 *             example:
 *               status: true
 *               message: Events fetched successfully
 *               results: 2
 *               data:
 *                 - _id: "671bb1e5c1b3f2a9d8f92a3c"
 *                   title: "National Scouting Summit"
 *                   approved: true
 *                   createdBy:
 *                     fullName: "John Doe"
 *                     email: "john@example.com"
 *                 - _id: "671bb1e5c1b3f2a9d8f92a4f"
 *                   title: "Scout Leadership Training"
 *                   approved: false
 *       400:
 *         description: Missing title query
 *       404:
 *         description: No matching events found
 *       500:
 *         description: Internal server error
 */
router.get("/checkSearch", auth, searchEventsByTitle);

/**
 * @swagger
 * /admin/status/count:
 *   get:
 *     summary: Count users by status (active, inactive, suspended, total)
 *     description: Returns the total number of users grouped by their account status.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User status counts retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               status: true
 *               message: User statistics retrieved successfully.
 *               data:
 *                 active: 150
 *                 inactive: 25
 *                 suspended: 10
 *                 total: 185
 *       403:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get("/status/count", auth, countUserStatus);


/**
 * @swagger
 * /admin/{id}/accept:
 *   patch:
 *     summary: Approve an award, event, or training by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the item (award, event, or training)
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item approved successfully
 */
router.patch("/:id/accept", auth, authorizeRoles("superAdmin", "nsAdmin"),acceptItem);

/**
 * @swagger
 * /admin/{id}/reject:
 *   patch:
 *     summary: Reject an award, event, or training by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the item (award, event, or training)
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
 *                 example: "Incomplete or invalid document"
 *     responses:
 *       200:
 *         description: Item rejected successfully
 */
router.patch("/:id/reject", auth, authorizeRoles("superAdmin", "nsAdmin"),rejectItem);

/**
 * @swagger
 * /admin/records/stats:
 *   get:
 *     summary: Get total counts of events, trainings, and awards by status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Record statistics fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     events:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         pending: { type: integer }
 *                         approved: { type: integer }
 *                         rejected: { type: integer }
 *                     trainings:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         pending: { type: integer }
 *                         approved: { type: integer }
 *                         rejected: { type: integer }
 *                     awards:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         pending: { type: integer }
 *                         approved: { type: integer }
 *                         rejected: { type: integer }
 *                     combined:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         pending: { type: integer }
 *                         approved: { type: integer }
 *                         rejected: { type: integer }
 *       403:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get("/records/stats", auth, authorizeRoles("superAdmin", "nsAdmin", "ssAdmin"), getAllRecordStats);

module.exports = router;
