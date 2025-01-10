import express from 'express'
import SyncController from '../controllers/sync-controller.js'

const router = express.Router()

router.post('/', SyncController.sync)


export default router
