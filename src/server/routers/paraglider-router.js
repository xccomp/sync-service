import express from 'express'
import ParagliderController from '../controllers/paraglider-controller.js'

const router = express.Router()

router.get('/scrape/brand', ParagliderController.scrapeBrands)
router.get('/scrape/model', ParagliderController.scrapeModels)
router.get('/scrape', ParagliderController.scrape)

export default router