const router = require('express').Router()

const { snsWebhook } = require('../controllers/snsController')

router.post('/webhook', snsWebhook)

module.exports = router;