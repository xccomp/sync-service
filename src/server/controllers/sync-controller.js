import { logger } from "#logger"
import { executeSyncProcesses } from '#domain/use-cases/execute-sync-processes.js'

export default class SyncController {

  static async sync (req, res) {
    try {
      const processes = req.body.processes      
      res.send(await executeSyncProcesses(processes))
    } catch (error) {     
      logger.error(error)
      return res.status(500).send(error)
    }
  }
  
}
