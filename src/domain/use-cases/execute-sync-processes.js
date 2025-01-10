import { logger } from "#logger";
import { createSyncProcessor } from '#domain/sync-processors/sync-processor-factory.js'
import SyncReport from '#libs/sync-report/index.js' 

export async function executeSyncProcesses (processes) {
  const syncReport = new SyncReport(Date.now())
  const syncProcessors = processes.map(process => {
    return createSyncProcessor (process.name, process.firstStep, process.lastStep, syncReport)
  }) 

  try {
    syncReport.start(processes)
    for (const syncProcessor of syncProcessors) {
      await syncProcessor.execute()
    } 
  } catch (error) {
    throw error
  } finally {
    syncReport.end()
    const reportError = syncReport.generate({ errorOnReturn: true })
    reportError && logger.warn(reportError)
  }
  
  return true
}