import express from 'express'
import GliderController from '../controllers/glider-controller.js'

const router = express.Router()

router.post('/map', GliderController.mapGlider)
router.get('/unknown', GliderController.getUnknownGliders)
router.get('/', GliderController.getGliders)


export default router
