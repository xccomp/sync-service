import express from 'express'
import FlightController from '../controllers/flight-controller.js'

const router = express.Router()

router.post('/sync/scrape', FlightController.syncScrape)
router.post('/sync/transform', FlightController.syncTransform)
router.post('/sync/load', FlightController.syncLoad)
router.post('/sync/post-process', FlightController.syncPostProcess)

export default router
