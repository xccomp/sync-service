import { logger } from "#logger"
import fs from 'fs'

export class SyncProcessor {

  static STEP_NAMES = {
    scrape: 'SCRAPE',
    transform: 'TRANSFORM',
    load: 'LOAD',
    synchronize: 'SYNCHRONIZE',
    postProcess: 'POST-PROCESS'
  }

  static SEQUENCE_OF_STEPS = [
    SyncProcessor.STEP_NAMES.scrape,
    SyncProcessor.STEP_NAMES.transform,
    SyncProcessor.STEP_NAMES.load,
    SyncProcessor.STEP_NAMES.synchronize,
    SyncProcessor.STEP_NAMES.postProcess
  ]

  constructor ({ 
    firstStep = 1,
    lastStep = 5, 
    processName,
    syncReport,
    scrapeStep,
    transformStep,
    loadStep,
    synchronizeStep,
    postProcessStep
  }) {
    this.firstStep = firstStep
    this.lastStep = lastStep
    this.syncReport = syncReport
    this.processName = processName,
    this.steps = [
      scrapeStep,
      transformStep,
      loadStep,
      synchronizeStep,
      postProcessStep
    ]
    this.syncConfig = this.#loadSyncConfig()
  }

  async execute () {
    logger.info(`${this.processName} process started | planned steps: ${this.getPlannedSteps()}`)
    this.syncReport.startProcces(this.processName, this.getPlannedSteps())
    
    for (let index = this.firstStep - 1; index < this.lastStep; index++) {
      const stepProcess = this.steps[index]
      await stepProcess()
    }

    logger.info(`${this.processName} process completed`)
    this.syncReport.endProcces(this.processName)
    return true
  }

  getPlannedSteps () {
    const steps = []
    for (let index = this.firstStep; index <= this.lastStep; index++) {
      steps.push(SyncProcessor.SEQUENCE_OF_STEPS[index - 1])
    }
    return steps
  }

  saveDataOnSyncFile(data, stepName) {
    const fileName = `${this.processName.toLowerCase()}-${stepName.toLowerCase()}.json`
    fs.writeFileSync(`./sync-files/${fileName}`, JSON.stringify(data))
  }
  
  loadDataFromSyncFile (stepName) {
    const fileName = `${this.processName.toLowerCase()}-${stepName.toLowerCase()}.json`
    const fileContent = fs.readFileSync(`./sync-files/${fileName}`, 'utf8')
    const data = JSON.parse(fileContent) 
    return data
  }

  #loadSyncConfig () {
    try {
      const fileContent = fs.readFileSync(`./sync-files/sync-config.json`, 'utf8')
      const data = JSON.parse(fileContent) 
      return data
    } catch (error) {
      logger.info('Loading sync-config.json file failed')
      throw error
    }
  }
}