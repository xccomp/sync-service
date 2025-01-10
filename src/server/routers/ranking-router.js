import express from 'express'
import RankingController from '../controllers/ranking-controller.js'

const router = express.Router()

router.get('/:ranking/podium/:category', RankingController.getPodium)
router.get('/:ranking/podium', RankingController.getPodium)
router.get('/:ranking', RankingController.getRanking)

router.post('/', RankingController.calculeRankings)


export default router
