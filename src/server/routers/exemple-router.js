import express from 'express'
import ExempleController from '../controllers/exemple-controller.js'

const router = express.Router()
router.get('/exemple-get', ExempleController.exempleGet)
router.post('/exemple-post', ExempleController.exemplePost)

export default router