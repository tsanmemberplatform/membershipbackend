const router = require('express').Router();
const { requestIdCard, getMyIdStatus, resetIdCardRequest, updateIdStatus } = require('../controllers/idCardController');
const {auth, authorizeRoles } = require('../middleware/authMiddleware');

router.post("/request", auth, requestIdCard);
router.post("/reset", auth, resetIdCardRequest);
router.patch("/update", auth, authorizeRoles( "distAdmin", "ssAdmin", "superAdmin" ), updateIdStatus);
router.get("/status", auth, getMyIdStatus);

module.exports = router;