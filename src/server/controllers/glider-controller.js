import { logger } from "#logger"
import { executeSyncProcesc } from '#domain/use-cases/sync-gliders.js'

export default class ParagliderController {

  static async sync (req, res) {
    try {
      const firstStep = req.query.firstStep || 1
      const lastStep = req.query.lastStep || 4

      const validSteps = [1, 2, 3, 4] 
      if (validSteps.includes(firstStep) || validSteps.includes(lastStep)) {
        return res.status(400).send(new Error('The firstStep and lastStep must be between 1 and 3 '))
      }
      if (lastStep < firstStep) {
        return res.status(400).send(new Error('The lastStep must be greater than or equal to the firstStep'))
      }
      res.send(await executeSyncProcesc(firstStep, lastStep))
    } catch (error) {     
      logger.error(error)
      return res.status(500).send(error)
    }
  }
}
