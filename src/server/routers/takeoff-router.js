import express from 'express'
import TakeoffController from '../controllers/takeoff-controller.js'

const router = express.Router()

router.post('/load-cities', TakeoffController.loadCities)
router.post('/link-takeoffs-to-cities', TakeoffController.linkTakeoffsToCities)

export default router
