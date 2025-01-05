import { logger } from "#logger"
import { updateXcbrasilIds } from '#domain/use-cases/update-xcbrasil-ids.js'

export default class SyncController {

  static async updateXbrasilIds (req, res) {
    try {   
      const result = await updateXcbrasilIds() 
      result.error = result.error ? result.error.message : undefined
      result.searches.errorList.forEach(el => el.error = el.error.message)
      result.updates.errorList.forEach(el => el.error = el.error.message)
      res.send(result)
    } catch (error) {     
      logger.error(error)
      res.status(500).send(error.message)
    }
  }

  static async getPilotsWithoutXcbrasilid (req, res) {l
    try {   
      const result = await getPilotsWithoutXcbrasilid() 
      res.send(result)
    } catch (error) {     
      logger.error(error)
      res.status(500).send(error.message)
    }
  }
}
