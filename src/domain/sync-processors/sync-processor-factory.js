import GliderSyncProcessor from "./gliders/glider-sync-processor.js"
import PilotSyncProcessor from "./pilots/pilot-sync-processor.js"
import TakeoffSyncProcessor from "./takeoffs/takeoff-sync-processor.js"
import FlightSyncProcessor from "./flights/flight-sync-processor.js"

export function createSyncProcessor (processName, firstStep, lastStep, syncReport) {
  if (processName === 'GLIDER-SYNC') {
    return new GliderSyncProcessor ({ firstStep, lastStep, syncReport })
  }

  if (processName === 'PILOT-SYNC') {
    return new PilotSyncProcessor ({ firstStep, lastStep, syncReport })
  }

  if (processName === 'TAKEOFF-SYNC') {
    return new TakeoffSyncProcessor  ({ firstStep, lastStep, syncReport })
  }

  if (processName === 'FLIGHT-SYNC') {
    return new FlightSyncProcessor  ({ firstStep, lastStep, syncReport })
  }

  return null
} 