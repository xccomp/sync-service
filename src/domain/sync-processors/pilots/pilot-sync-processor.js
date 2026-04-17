import fs from 'fs'
import axios from 'axios'
import * as cheerio from 'cheerio'
import XCCompDB from '#libs/xccomp-db/index.js'
import { logger } from '#logger'
import { SyncProcessor } from '../sync-porcessor.js'
import { executeRules } from './sync-pilot-rules.js'
import SyncReport from '#sync-report'
import { updateXcbrasilIds } from '#domain/use-cases/update-xcbrasil-ids.js'

import { scrapePilots } from './scrape-pilots.js'
import { log } from 'console'

export default class PilotSyncProcessor {
  
  constructor ({firstStep, lastStep, options, syncReport}) {
    this.processName = 'PILOT-SYNC'
    this.syncReport = syncReport

    this.syncProcessor = new SyncProcessor({ 
      firstStep,
      lastStep, 
      options,
      syncReport,
      processName: this.processName,
      scrapeStep:       async () => { await this.scrape() },
      transformStep:    async () => { await this.transform() },
      loadStep:         async () => { await this.load() },
      synchronizeStep:  async () => { await this.synchronize() },
      postProcessStep:  async () => { await this.postProcess() }
    })

  }

  async execute () {
    await this.syncProcessor.execute()
  }

  // LAYOUT OF SYNC FILES
  // pilot-sync-scrape: [{
  //   cbvlId: string,
  //   name: string,
  //   club: string,
  //   cbvlPending: string,
  //   license: string,
  // }]
  //
  // pilot-sync-transform: [{
  //   cbvlId: integer,
  //   name: string,
  //   club: string,
  //   cbvlPending: boolean,
  //   licenseLevel: integer
  // }]


// ======================================================================== Scraping step ========================================================================
  async scrape () {
    this.#loggerScrape(`Start step`)
    this.syncReport.startStep(this.processName, SyncProcessor.STEP_NAMES.scrape)
    let resultReport = null
    try {     
      const { continueFromSyncFile } = this.syncProcessor.options
      resultReport = await scrapePilots({continueFromSyncFile})
    } catch (error) {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.scrape, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Falha crítica na etapa de scraping dos pilotos',
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
      info: 'Falha na etapa de scraping dos pilotos',
      details: { 
        error: resultReport.error,
        details: resultReport.details
      }
    }) 
  }

  #loggerScrape(text) {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.scrape} | ${text}`)
  }


// ======================================================================== Transform step ========================================================================

  async transform () {
    this.#loggerTransform('Start step')
    this.syncReport.startStep(this.processName, SyncProcessor.STEP_NAMES.transform)
    
    let scrapedData = null 
    try {
      scrapedData = this.syncProcessor.loadDataFromSyncFile(SyncProcessor.STEP_NAMES.scrape)
    } catch (error) {
      this.#loggerTransform('Read sync file failed')
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.transform, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Read sync file failed',
        details: error
      })
      throw error
    }

    let transformedData = null
    try {
      transformedData = this.#normalizeData(scrapedData)      
    } catch (error) {
      this.#loggerTransform('Data handle failed')
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.transform, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Data handle failed',
        details: error
      })
      throw error 
    }

    // const checkeData = await executeRules(transformedData, 'transform', this.syncProcessor.syncConfig, this.syncReport)

    try {
      this.syncProcessor.saveDataOnSyncFile(transformedData, SyncProcessor.STEP_NAMES.transform)
    } catch (error) {
      this.#loggerTransform('Save sync file failed')
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.transform, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Save sync file failed',
        details: error
      })
      throw error
    }

    this.#loggerTransform('Completed step')
    this.syncReport.endStep(this.processName, SyncProcessor.STEP_NAMES.transform)
  }

  #normalizeData (scrapedData) {
    const normalizedData = Object.values(scrapedData).flat()
    normalizedData.forEach(record => {
      record.id = Number(record.id.split('_0u')[1]),
      record.name = record.name.trim().replaceAll('  ', ' '),
      record.gender = record.femaleGender ? 'F' : 'M',
      record.nationality = record.nationality
    })
    return normalizedData
  }



  #loggerTransform(text) {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.transform} | ${text}`)
  }


// ======================================================================== Load step ========================================================================

  async load () {
    // 
    this.#loggerLoad('Start step')
    this.syncReport.startStep(this.processName, SyncProcessor.STEP_NAMES.load)

    let transformedData = null
    try {
      transformedData = this.syncProcessor.loadDataFromSyncFile(SyncProcessor.STEP_NAMES.transform)
    } catch (error) {
      this.#loggerLoad('Read sync file failed')
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.load, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Read sync file failed',
        details: error
      })
      throw error
    }
 
    let dbClient = null
    try {
      dbClient = await XCCompDB.getClient()
      await this.#clearOldSyncDataOnDb(dbClient)
      await this.#loadPilots(transformedData, dbClient) 
    } catch (error) {
      this.#loggerLoad('Pilots loading data failed')
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.load, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Pilots loading data failed',
        details: error
      })
      throw error
    } finally {
      dbClient && dbClient.release()
    }
    
    this.#loggerLoad('End step')
    this.syncReport.endStep(this.processName, SyncProcessor.STEP_NAMES.load)
  }

  async #clearOldSyncDataOnDb (dbClient) {
    this.#loggerLoad('Clearing synchronization tables')
    const sql = 'DELETE FROM pilots_sync'
    await dbClient.query(sql)
  }
  
  async #loadPilots (pilots, dbClient) {
    this.#loggerLoad('Loading pilots on synchronization tables')
    const BATCH_SIZE = 1000;
    const steps = Math.ceil(pilots.length / BATCH_SIZE)
    let currentStep = 1

    for (let i = 0; i < pilots.length; i += BATCH_SIZE) {
      this.#loggerLoad(`Creating batch ${currentStep}/${steps}`)
      const batch = pilots.slice(i, i + BATCH_SIZE);
      const values = {
        ids: [],
        names: [],
        genders: [],
        nationalities: []
      }
      batch.forEach(pilot => {
        values.ids.push(pilot.id)
        values.names.push(pilot.name)
        values.genders.push(pilot.gender)
        values.nationalities.push(pilot.nationality)
      })
      const sql = `
        INSERT INTO pilots_sync (id, name, gender, nationality)
        SELECT * FROM UNNEST($1::int[], $2::text[], $3::text[], $4::text[])
      `
      this.#loggerLoad(`Saving batch ${currentStep}/${steps} to the database.`)
      await dbClient.query(sql, Object.values(values))
      currentStep++
      console.log(`Batch saved successfully`);
    }
   
  }

  #loggerLoad(text) {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.load} | ${text}`)
  }




// ======================================================================== Synchronize step ========================================================================




  async synchronize () {
    this.#loggerSynchronize('Start step')
    this.syncReport.startStep(this.processName, SyncProcessor.STEP_NAMES.synchronize)

    let dbClient = null
    try {
      dbClient = await XCCompDB.getClient()
      await this.#synchronizePilots(dbClient)
    } catch (error) {
      this.#loggerSynchronize('Pilot data table synchronization failed')
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.synchronize, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Glider data table synchronization failed',
        details: error
      })
      throw error
    } finally {
      dbClient && dbClient.release()
    }

    this.#loggerSynchronize('End step')
    this.syncReport.endStep(this.processName, SyncProcessor.STEP_NAMES.synchronize)
  }


  async #synchronizePilots (dbClient) {
    const sql = `
      MERGE INTO pilots t
      USING pilots_sync s
      ON t.id = s.id
      WHEN MATCHED AND t.name != s.name THEN
        UPDATE SET
          name = s.name,
          gender = s.gender,
          nationality = s.nationality,
          updated_at = NOW()
      WHEN MATCHED AND t.gender != s.gender THEN
        UPDATE SET
          name = s.name,
          gender = s.gender,
          nationality = s.nationality,
          updated_at = NOW()
      WHEN MATCHED AND t.nationality != s.nationality THEN
        UPDATE SET
          name = s.name,
          gender = s.gender,
          nationality = s.nationality,
          updated_at = NOW()
      WHEN NOT MATCHED THEN
        INSERT (id, name, gender, nationality)
        VALUES (s.id, s.name, s.gender, s.nationality)
      RETURNING
        merge_action() as action,
        t.id,
        t.name,
        t.gender,
        t.nationality,
        t.created_at,
        t.updated_at
    `
    const reportMerg = await dbClient.query(sql)
    this.#loggerSynchronize('Pilots synchronization - Merge table report')
    this.#loggerSynchronize(JSON.stringify(reportMerg))
  }
  

  #loggerSynchronize(text) {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.synchronize} | ${text}`)
  }


  
  


// ======================================================================== Post-process step ========================================================================

  postProcess () {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.postProcess} | Sincronismo de pilotos não possui a etapa "post-process", portanto ela foi considerada como concluída com sucesso.`)
  }
 
}


