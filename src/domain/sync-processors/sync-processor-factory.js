import GliderSyncProcessor from "./gliders/glider-sync-processor.js"
import PilotSyncProcessor from "./pilots/pilot-sync-processor.js"

export function createSyncProcessor (processName, firstStep, lastStep, syncReport) {
  if (processName === 'GLIDER-SYNC') {
    return new GliderSyncProcessor ({ firstStep, lastStep, syncReport })
  }

  if (processName === 'PILOT-SYNC') {
    return new PilotSyncProcessor ({ firstStep, lastStep, syncReport })
  }

  return null
} 