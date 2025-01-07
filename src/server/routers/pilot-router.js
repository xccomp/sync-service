import express from 'express'
import PilotController from '../controllers/pilot-controller.js'

const router = express.Router()

router.post('/update-xcbrasil-ids', PilotController.updateXcbrasilIds)
router.get('/without-xcbrasil-id', PilotController.getPilotsWithoutXcbrasilId)


export default router
