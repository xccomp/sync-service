import { logger } from "#logger"
import { loadCitiesFromIbge } from '#domain/use-cases/load-cities-from-ibge.js'

export default class TakeoffController {

  static async loadCities (req, res) {
    try {   
      logger.info('TakeoffController - loadCities - call')  
      res.send(await loadCitiesFromIbge())
    } catch (error) {   
      logger.info('TakeoffController - loadCities - error')    
      logger.error(error)
      res.status(500).send(error.message)
    }
  }

  static async linkTakeoffsToCities (req, res) {
    try {   
      res.send(0)
    } catch (error) {     
      logger.error(error)
      res.status(500).send(error.message)
    }
  }
}
