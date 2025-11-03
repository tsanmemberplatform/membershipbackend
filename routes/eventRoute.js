const router = require("express").Router();
const {
  createEvent,
  approveEvent,
  rejectEvent,
  getEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  registerForEvent, 
  cancelRegistration,
  getAttendees,
  exportAttendees,
  getMyEvents,
  getUpcomingEvents,
} = require("../controllers/eventController");
const { uploadGeneralFile } = require('../utils/multer');
const { auth, authorizeRoles } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Events
 *   description: Event management endpoints
 */

/**
 * @swagger
 * /events:
 *   post:
 *     summary: Create a new event
 *     tags: [Events]
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
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               time:
 *                 type: string
 *                 format: time
 *                 example: "18:30"
 *                 description: Event start time in HH:mm format (24-hour clock)
 *               location:
 *                 type: string
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Event created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  auth,
  authorizeRoles("superAdmin", "leader", "nsAdmin", "ssAdmin", "member"),
  uploadGeneralFile.single("photo"),
  createEvent
);

/**
 * @swagger
 * /events/{id}/approve:
 *   patch:
 *     summary: Approve event (admin only)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Event ID
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event approved
 */
router.patch(
  "/:id/approve",
  auth,
  authorizeRoles("superAdmin", "nsAdmin", "ssAdmin"),
  approveEvent
);

/**
 * @swagger
 * /events/{id}/reject:
 *   patch:
 *     summary: Reject event (admin only)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Event ID
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event rejected
 */
router.patch(
  "/:id/reject",
  auth,
  authorizeRoles("superAdmin", "nsAdmin", "ssAdmin"),
  rejectEvent
);

/**
 * @swagger
 * /events:
 *   get:
 *     summary: Get all events (Admins see all, others only approved). Supports pagination and title search.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: title
 *         in: query
 *         description: Search events by title (case-insensitive)
 *         required: false
 *         schema:
 *           type: string
 *           example: "Leadership Camp"
 *       - name: page
 *         in: query
 *         description: Page number for pagination
 *         required: false
 *         schema:
 *           type: integer
 *           example: 1
 *       - name: limit
 *         in: query
 *         description: Number of items per page
 *         required: false
 *         schema:
 *           type: integer
 *           example: 10
 *     responses:
 *       200:
 *         description: List of events fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: boolean }
 *                 message: { type: string }
 *                 totalEvents: { type: integer }
 *                 currentPage: { type: integer }
 *                 totalPages: { type: integer }
 *                 pageSize: { type: integer }
 *                 events:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id: { type: string }
 *                       title: { type: string }
 *                       description: { type: string }
 *                       approved: { type: boolean }
 *                       date: { type: string, format: date-time }
 *                       createdBy:
 *                         type: object
 *                         properties:
 *                           fullName: { type: string }
 *                           email: { type: string }
 *       404:
 *         description: No events found
 *       500:
 *         description: Internal server error
 */
router.get("/", auth, authorizeRoles("member", "leader", "superAdmin", "nsAdmin", "ssAdmin"), getEvents);

/**
 * @swagger
 * /events/{id}:
 *   get:
 *     summary: Get single event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Event ID
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event details
 */
router.get("/:id", auth, getEvent);

/**
 * @swagger
 * /events/{id}:
 *   patch:
 *     summary: Update an existing event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Allows the event **owner** or an **admin** (`superAdmin`, `nsAdmin`, `ssAdmin`) to update event details.  
 *       Regular users cannot edit events they did not create.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The unique ID of the event to update.
 *         schema:
 *           type: string
 *           example: 671fb39a8b12cd1f2234e789
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Scout Leadership Camp
 *               description:
 *                 type: string
 *                 example: A three-day leadership development camp for scouts.
 *               date:
 *                 type: string
 *                 format: date
 *                 example: 2025-11-10
 *               time:
 *                 type: string
 *                 example: "09:00 AM"
 *               location:
 *                 type: string
 *                 example: Lagos State Scout Council
 *               photoUrl:
 *                 type: string
 *                 example: https://res.cloudinary.com/demo/image/upload/sample.jpg
 *               approved:
 *                 type: boolean
 *                 example: true
 *           example:
 *             title: Scout Leadership Camp
 *             description: Updated camp details
 *             date: 2025-11-10
 *             time: "09:00 AM"
 *             location: Lagos State Scout Council
 *     responses:
 *       200:
 *         description: Event updated successfully.
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
 *                   example: Event updated successfully
 *                 event:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: 671fb39a8b12cd1f2234e789
 *                     title:
 *                       type: string
 *                       example: Scout Leadership Camp
 *                     location:
 *                       type: string
 *                       example: Lagos State Scout Council
 *                     date:
 *                       type: string
 *                       example: 2025-11-10
 *                     createdBy:
 *                       type: string
 *                       example: 670a42f9a7b91d1c442e213a
 *       400:
 *         description: Invalid input data or missing required field.
 *       403:
 *         description: Not authorized to edit this event.
 *       404:
 *         description: Event not found.
 *       500:
 *         description: Internal server error.
 */
router.patch(
  "/:id",
  auth,
  authorizeRoles("superAdmin", "nsAdmin", "ssAdmin", "member"),
  uploadGeneralFile.single("photo"),
  updateEvent
);

/**
 * @swagger
 * /events/{id}:
 *   delete:
 *     summary: Delete event (creator or admin)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Event ID
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event deleted
 */
router.delete(
  "/:id",
  auth,
  authorizeRoles("superAdmin", "nsAdmin", "member"),
  deleteEvent
);


/**
 * @swagger
 * /events/{id}/register:
 *   post:
 *     summary: RSVP / register for an event
 *     description: Users can register for an approved event with a status of "Going", "Not Going", or "Maybe". Email and SMS confirmation will be sent upon successful registration.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Event ID
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
 *                 enum: [Going, Not Going, Maybe]
 *                 description: RSVP status for the event
 *     responses:
 *       200:
 *         description: RSVP recorded successfully with email and SMS notifications sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 event:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: Invalid RSVP status
 *       403:
 *         description: Event not published or user not authorized
 *       404:
 *         description: Event not found
 */

router.post(
  "/:id/register",
  auth,
  authorizeRoles("member", "leader", "superAdmin", "nsAdmin", "ssAdmin"),
  registerForEvent
);



/**
 * @swagger
 * /events/{id}/cancel:
 *   post:
 *     summary: Cancel registration for an event
 *     description: Allows a user to cancel their registration for an approved event. Email and SMS confirmation will be sent upon successful cancellation.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Event ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Registration cancelled successfully with email and SMS notifications sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 event:
 *                   $ref: '#/components/schemas/Event'
 *       403:
 *         description: User not authorized
 *       404:
 *         description: Event not found
 */

router.post(
  "/:id/cancel",
  auth,
  authorizeRoles("member"),
  cancelRegistration
);

/**
 * @swagger
 * /events/{id}/attendees:
 *   get:
 *     summary: View attendees (admins only)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of attendees
 */
router.get(
  "/:id/attendees",
  auth,
  authorizeRoles("superAdmin", "nsAdmin", "ssAdmin"),
  getAttendees
);

/**
 * @swagger
 * /events/{id}/attendees/export:
 *   get:
 *     summary: Export attendees as CSV (admins only)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV file of attendees
 */
router.get(
  "/:id/attendees/export",
  auth,
  authorizeRoles("superAdmin", "nsAdmin", "ssAdmin" ),
  exportAttendees
);

/**
 * @swagger
 * /events/personal/my-events:
 *   get:
 *     summary: Get events created by the logged-in user
 *     tags: [Events]
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
 *         description: Number of events per page (default is 10)
 *     responses:
 *       200:
 *         description: Successfully retrieved events created by the logged-in user
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
 *                   example: My events fetched successfully
 *                 totalEvents:
 *                   type: integer
 *                   example: 5
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 totalPages:
 *                   type: integer
 *                   example: 1
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
 *                         example: "650123abc..."
 *                       title:
 *                         type: string
 *                         example: "Scout Leadership Training"
 *                       description:
 *                         type: string
 *                         example: "Training event for scout leaders"
 *                       date:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-10-15T10:00:00Z"
 *                       location:
 *                         type: string
 *                         example: "Lagos, Nigeria"
 *                       approved:
 *                         type: boolean
 *                         example: true
 *                       createdBy:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "64ff..."
 *                           fullName:
 *                             type: string
 *                             example: "John Doe"
 *                           email:
 *                             type: string
 *                             example: "john@example.com"
 *       401:
 *         description: Unauthorized (invalid or missing token)
 *       404:
 *         description: No events found for the logged-in user
 *       500:
 *         description: Internal server error
 */
router.get("/personal/my-events", auth, getMyEvents);

/**
 * @swagger
 * /events/next/upcoming:
 *   get:
 *     summary: Get approved upcoming events (3 per page)
 *     tags: [Events]
 *     description: |
 *       Fetches only **approved upcoming events** (events with a date greater than or equal to today).  
 *       Results are paginated with **3 events per page**.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: The page number for pagination (3 events per page)
 *     responses:
 *       200:
 *         description: Approved upcoming events fetched successfully
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
 *                   example: Approved upcoming events fetched successfully
 *                 totalEvents:
 *                   type: integer
 *                   example: 8
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 totalPages:
 *                   type: integer
 *                   example: 3
 *                 pageSize:
 *                   type: integer
 *                   example: 3
 *                 events:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Event'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       404:
 *         description: No approved upcoming events found
 *       500:
 *         description: Internal server error
 */
router.get('/next/upcoming', auth, getUpcomingEvents);


module.exports = router;    