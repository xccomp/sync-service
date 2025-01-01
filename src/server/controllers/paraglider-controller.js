import { logger } from "#logger"
import { scrapeParagliderBrands, scrapeParagliderModels, scrapeParagliders } from '#use-cases/scrape-paragliders.js'
import { NotFoundError, XCBrasilRequestError } from "#use-cases/errors/index.js"

export default class ParagliderController {

  static async scrapeBrands (req, res) {
    try {
      res.send(await scrapeParagliderBrands())
    } catch (error) {
      logger.error(error)
      return res.status(500).send(error)  
    }
  }

  static async scrapeModels (req, res) {
    const brandId = req.query.brandId
    try {
      res.send(await scrapeParagliderModels(brandId))
    } catch (error) { 
      logger.error(error)
      if (NotFoundError.sameTypeOfError(error)) return res.status(400).send(error)
      return res.status(500).send(error)
    }
  }

  static async scrape (req, res) {
    try {
      res.send(await scrapeParagliders())
    } catch (error) {     
      logger.error(error)
      if (NotFoundError.sameTypeOfError(error)) return res.status(400).send(error)
      return res.status(500).send(error)
    }
  }


}
