import express from 'express'
import GliderController from '../controllers/glider-controller.js'

const router = express.Router()

router.get('/sync', GliderController.sync)

export default router
