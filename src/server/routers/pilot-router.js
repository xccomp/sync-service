import express from 'express'
import PilotController from '../controllers/pilot-controller.js'

const router = express.Router()

router.post('/updatexbrasilids', PilotController.updateXbrasilIds)
router.get('/withoutxcbrasilid', PilotController.getPilotsWithoutXcbrasilid)


export default router
