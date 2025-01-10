import { logger } from '#logger'
import fs from 'fs'
import error2json from '@stdlib/error-to-json'
import { log } from 'console'

export default class SyncReport  {
  
  #reportId = null
  #data = []

  constructor (reportId) {
    this.#reportId = reportId || Date.now
  }

  set reportId (value) {
    this.#reportId = value
  }

  get reportId () {
    return this.#reportId
  }

  static OCCURENCE_TYPES = {
    startSync: 1,
    endSync: 2,
    startProcess: 3,
    endProcess: 4,
    startStep: 5,
    endStep: 6,
    dataInconssitence: 7,
    criticalDataInconssitence: 8,
    warning: 9,
    error: 10
  }


  start (previstProcessAndSteps) {
    this.addOccurrence({type: SyncReport.OCCURENCE_TYPES.startSync, details: previstProcessAndSteps})
  }

  end () {
    this.addOccurrence({type: SyncReport.OCCURENCE_TYPES.endSync })
  }

  startProcces (process, previstSteps) {
    this.addOccurrence({ process, type: SyncReport.OCCURENCE_TYPES.startProcess, details: previstSteps })
  } 

  endProcces (process) {
    this.addOccurrence({ process , type: SyncReport.OCCURENCE_TYPES.endProcess })
  }

  startStep (process, step) {
    this.addOccurrence({ process, step, type: SyncReport.OCCURENCE_TYPES.startStep })
  } 

  endStep (process, step, details) {
    this.addOccurrence({ process, step, type: SyncReport.OCCURENCE_TYPES.endStep, details })
  }

  addOccurrence({ process, step, type, info, details }) {
    const parsedDetails = this.parseDetails(details)
    this.#data.push(
      { 
        time: Date.now(),
        process,
        step,
        type,
        info,
        details: parsedDetails
      }
    )
  }

  parseDetails (details) {
    if (!details) return details
    if (details instanceof Error) {
      return {
        name: details.name, 
        message: details.message,
        stack: details.stack
      }
    } 
    if (Array.isArray(details)) {
      return details.map(el => this.parseDetails(el))
    }
    if (details instanceof Object) {
      const parsedObj = {}
      Object.keys(details).forEach(key => parsedObj[key] = this.parseDetails(details[key])) 
      return parsedObj
    } 
    return details
  }


  generate ({ saveReportOnFile = true, reportOnreturn = false, errorOnReturn = false } = {}) {
    try {
      const times = {
        begin: this.#data.find(el => el.type === SyncReport.OCCURENCE_TYPES.startSyn)?.time,
        end: this.#data.find(el => el.type === SyncReport.OCCURENCE_TYPES.endSync)?.time,
        duration: this.#data.find(el => el.type === SyncReport.OCCURENCE_TYPES.endSync)?.time - this.#data.find(el => el.type === SyncReport.OCCURENCE_TYPES.startSyn)?.time
      }
      const inconsistences = this.#data.filter(el => el.type === SyncReport.OCCURENCE_TYPES.dataInconssitence)
      const criticalInconsistences = this.#data.filter(el => el.type === SyncReport.OCCURENCE_TYPES.criticalDataInconssitence)
      const warnings = this.#data.filter(el => el.type === SyncReport.OCCURENCE_TYPES.warning)
      
      const error = this.#data.filter(el => el.type === SyncReport.OCCURENCE_TYPES.error)
      const logs = this.#data

      const report = { 
          times,
          inconsistences,
          criticalInconsistences,
          warnings,
          error,
          logs,
        }

      if (saveReportOnFile) {
        fs.writeFileSync(`./sync-files/${this.#reportId}-report-sync.json`, JSON.stringify(report))
      }

      if (reportOnreturn) return report
    } catch (error) {
      logger.info('Generate report by sync-report failed')
      logger.error(error)
      if (errorOnReturn) return { error: error.message }
      throw new error
    }
  }
}
