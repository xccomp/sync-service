import SyncReport from '#sync-report'
import { logger } from '#logger'
import { SyncProcessor } from '../sync-porcessor.js'

import { scrapeFlights } from "./scrape-flights.js"
import { transformFlights } from "./transform-flights.js"
import { loadFlights } from "./load-flights.js"
import { postProcessFlights } from './post-process-flights.js'

export default class FlightSyncProcessor {
  
  constructor ({firstStep, lastStep, syncReport}) {
    this.processName = 'FLIGHT-SYNC'
    this.syncReport = syncReport

    this.syncProcessor = new SyncProcessor({ 
      firstStep,
      lastStep, 
      syncReport,
      processName: this.processName,
      scrapeStep:       async () => { await this.scrape() },
      transformStep:    async () => { await this.transform() },
      loadStep:         async () => { await this.load() },
      synchronizeStep:  async () => { return },
      postProcessStep:  async () => { await this.postProcess() }
    })

  }

  async execute () {
    await this.syncProcessor.execute()
  }

// ======================================================================== Scraping step ========================================================================

  async scrape () {
    this.syncReport.startStep(this.processName, SyncProcessor.STEP_NAMES.scrape)
    let resultReport = null
    try {
      resultReport = await scrapeFlights()
    } catch (error) {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.scrape, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Falha crítica na etapa de scraping dos voos',
        details: error
      }) 
      throw error
    }
    this.#addOccurrencesToScrapeSyncReport(resultReport)
    if (resultReport.error) throw resultReport.error
    this.syncReport.endStep(this.processName, SyncProcessor.STEP_NAMES.scrape, resultReport.details)
  }


  #addOccurrencesToScrapeSyncReport (resultReport) {
    resultReport.warnings.forEach(warning => {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.scrape, 
        type: SyncReport.OCCURENCE_TYPES.warning,
        info: warning.message,
        details: warning.error
      }) 
    })
    if (!resultReport.error) { return }
    this.syncReport.addOccurrence({ 
      process: this.processName,
      step: SyncProcessor.STEP_NAMES.scrape, 
      type: SyncReport.OCCURENCE_TYPES.error,
      info: 'Falha na etapa de scraping dos voos',
      details: { 
        error: resultReport.error,
        details: resultReport.details
      }
    }) 
  }



// ======================================================================== Transform step ========================================================================

  async transform () {
    this.syncReport.startStep(this.processName, SyncProcessor.STEP_NAMES.transform)
    let resultReport = null
    try {
      resultReport = transformFlights()
    } catch (error) {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.transform, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Falha crítica na etapa de transformação dos voos',
        details: error
      }) 
      throw error
    }
    this.#addOccurrencesToTransformSyncReport(resultReport)
    if (resultReport.error) throw resultReport.error
    this.syncReport.endStep(this.processName, SyncProcessor.STEP_NAMES.transform, resultReport.details)  
  }

  #addOccurrencesToTransformSyncReport (resultReport) {
    resultReport.warnings.forEach(warning => {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.transform, 
        type: SyncReport.OCCURENCE_TYPES.warning,
        info: warning.message,
        details: warning.error
      }) 
    })
    if (!resultReport.error) { return }
    this.syncReport.addOccurrence({ 
      process: this.processName,
      step: SyncProcessor.STEP_NAMES.transform, 
      type: SyncReport.OCCURENCE_TYPES.error,
      info: 'Falha na etapa de transfomação dos voos',
      details: { 
        error: resultReport.error,
        details: resultReport.details
      }
    }) 
  }

// ======================================================================== Load step ========================================================================

async load () {
  this.syncReport.startStep(this.processName, SyncProcessor.STEP_NAMES.transform)
  let resultReport = null
  try {
    resultReport = await loadFlights()
  } catch (error) {
    this.syncReport.addOccurrence({ 
      process: this.processName,
      step: SyncProcessor.STEP_NAMES.load, 
      type: SyncReport.OCCURENCE_TYPES.error,
      info: 'Falha crítica na etapa de carregamento dos voos',
      details: error
    }) 
    throw error
  }
  this.#addOccurrencesToLoadSyncReport(resultReport)
  if (resultReport.error) throw resultReport.error
  this.syncReport.endStep(this.processName, SyncProcessor.STEP_NAMES.load, resultReport.details)  
}

#addOccurrencesToLoadSyncReport (resultReport) {
  resultReport.warnings.forEach(warning => {
    this.syncReport.addOccurrence({ 
      process: this.processName,
      step: SyncProcessor.STEP_NAMES.load, 
      type: SyncReport.OCCURENCE_TYPES.warning,
      info: warning.message,
      details: warning.error
    }) 
  })
  if (!resultReport.error) { return }
  this.syncReport.addOccurrence({ 
    process: this.processName,
    step: SyncProcessor.STEP_NAMES.load, 
    type: SyncReport.OCCURENCE_TYPES.error,
    info: 'Falha na etapa de carregamento dos voos',
    details: { 
      error: resultReport.error,
      details: resultReport.details
    }
  }) 
}

// ======================================================================== Post-Process step ========================================================================



  async postProcess () {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.postProcess} | Etapa iniciada`)
    this.syncReport.startStep(this.processName, SyncProcessor.STEP_NAMES.postProcess)

    let resultReport = null
    try {
      resultReport = await postProcessFlights()
    } catch (error) {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.load, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Falha crítica na etapa de pós-processamento dos voos',
        details: error
      }) 
      throw error
    }

    const endDetails = {
      relateTakeoffs: resultReport.relateTakeoffs.details,
      relatePilots: resultReport.relatePilots.details,
      relateGliders: resultReport.relateGliders.details
    }
    this.#addOccurrencesToPostProcessSyncReport(resultReport)
    this.syncReport.endStep(this.processName, SyncProcessor.STEP_NAMES.postProcess, endDetails)
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.postProcess} | Etapa finalizada`)
  }

  #addOccurrencesToPostProcessSyncReport (resultReport) {
    const relateTakeoffsReport = resultReport.relateTakeoffs
    relateTakeoffsReport.warnings.forEach(warning => {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.postProcess, 
        type: SyncReport.OCCURENCE_TYPES.warning,
        info: warning.message,
        details: warning.error
      }) 
    })
    const relatePilotsReport = resultReport.relatePilots
    relatePilotsReport.warnings.forEach(warning => {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.postProcess, 
        type: SyncReport.OCCURENCE_TYPES.warning,
        info: warning.message,
        details: warning.error
      }) 
    })
    const relateGlidersReport = resultReport.relateGliders
    relateGlidersReport.warnings.forEach(warning => {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.postProcess, 
        type: SyncReport.OCCURENCE_TYPES.warning,
        info: warning.message,
        details: warning.error
      }) 
    })
  }
}
