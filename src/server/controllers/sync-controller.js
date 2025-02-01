import { logger } from "#logger"
import { executeSyncProcesses } from '#domain/use-cases/execute-sync-processes.js'
import { parseServerDateParameter } from '#libs/utils/date-utils.js'

export default class SyncController {

  static async sync (req, res) {
    try {
      const processes = req.body.processes  
      processes.forEach(process => {
        const options = process.options
        if (!options) return
        options.startDate = parseServerDateParameter(options.startDate)
        options.endDate = parseServerDateParameter(options.endDate)
      })     
      res.send(await executeSyncProcesses(processes))
    } catch (error) {     
      logger.error(error)
      return res.status(500).send(error)
    }
  }
  
}
