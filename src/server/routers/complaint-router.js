import express from 'express'
import ComplaintController from '../controllers/complaint-controller.js'

const router = express.Router()

router.get('/:id', ComplaintController.getComplaintById)
router.get('/', ComplaintController.getComplaints)


router.post('/send', ComplaintController.sendComplaint)

router.put('/:id/addCommittee', ComplaintController.addComiteeToComplaint)
router.put('/:id/addResult', ComplaintController.addResultToComplaint)
router.put('/:id/ingnore', ComplaintController.ignoreComplaint)


export default router
