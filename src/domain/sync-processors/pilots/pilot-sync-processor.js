import fs from 'fs'
import axios from 'axios'
import * as cheerio from 'cheerio'
import XCCompDB from '#libs/xccomp-db/index.js'
import { logger } from '#logger'
import { SyncProcessor } from '../sync-porcessor.js'
import { executeRules } from './sync-pilot-rules.js'
import SyncReport from '#sync-report'
import { updateXcbrasilIds } from '#domain/use-cases/update-xcbrasil-ids.js'

export default class PilotSyncProcessor {
  
  constructor ({firstStep, lastStep, syncReport}) {
    this.processName = 'PILOT-SYNC'
    this.syncReport = syncReport

    this.syncProcessor = new SyncProcessor({ 
      firstStep,
      lastStep, 
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
    
    let scrapedData = {}
    try {
      const $ = cheerio.load(fs.readFileSync('./sync-files/pilot-sync-source.html'))  
      scrapedData = $('tbody').find('tr').toArray().map( $el => {
        const cells = $($el).children('td')
        return {
          cbvlId: $(cells[0]).find('button').attr('data-row-id') || '',
          name: $(cells[2]).text() || '',
          club: $(cells[3]).text() || '',
          cbvlPending: $(cells[4]).text() || '',
          license: $(cells[5]).text() || '',
        }
      })      
    } catch (error) {
      this.#loggerScrape('Scrap cvs files failed')
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.scrape, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Scrap cvs files failed',
        details: error
      })
      throw error
    }

    const checkeData = await executeRules(scrapedData, 'scrape', this.syncProcessor.syncConfig, this.syncReport)
   
    try {
      this.syncProcessor.saveDataOnSyncFile(checkeData, SyncProcessor.STEP_NAMES.scrape)
    } catch (error) {
      this.#loggerScrape('Save sync file failed')
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.scrape, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Save sync file failed',
        details: error
      })
      throw error
    }
    
    this.#loggerScrape('Completed step')
    this.syncReport.endStep(this.processName, SyncProcessor.STEP_NAMES.scrape)
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

    const checkeData = await executeRules(transformedData, 'transform', this.syncProcessor.syncConfig, this.syncReport)

    try {
      this.syncProcessor.saveDataOnSyncFile(checkeData, SyncProcessor.STEP_NAMES.transform)
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
    const pilotHasMap = new Map()
    scrapedData.forEach(record => {
      const parsedRecord = {
        cbvlId: Number(record.cbvlId.split('_')[0]),
        name: record.name,
        club: record.club,
        cbvlPending: !record.cbvlPending.includes('Liberado'),
        licenseLevel: record.license.includes('PP') ? this.#transformPilotLevel(record.license) : -1
      }
      if (parsedRecord.licenseLevel === -1) { return }
      if (!pilotHasMap.has(parsedRecord.cbvlId)) { return pilotHasMap.set(parsedRecord.cbvlId, parsedRecord) }

      const existingRecord = pilotHasMap.get(parsedRecord.cbvlId) 
      existingRecord.cbvlPending = !parsedRecord.cbvlPending ? false : existingRecord.cbvlPending
      existingRecord.licenseLevel = Math.max(existingRecord.licenseLevel, parsedRecord.licenseLevel)
    })
    return [...pilotHasMap.values()]
  }

  
  #transformPilotLevel(levelsData) {
    if (levelsData.includes('Nivel 1')) return 1
    if (levelsData.includes('Nivel 2')) return 2
    if (levelsData.includes('Nivel 3')) return 3
    if (levelsData.includes('Nivel 4')) return 4
    if (levelsData.includes('Nivel 5')) return 5
    if (levelsData.includes('Nivel 6')) return 6
    if (levelsData.includes('Aluno')) return 0
    return 10   
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
    const sql = 'INSERT INTO pilots_sync(cbvl_id, cbvl_pending, name, club, license_level) VALUES ' 
      + pilots.map(p => `(${p.cbvlId}, ${p.cbvlPending}, '${p.name}', '${p.club}', ${p.licenseLevel})`).join(',')
    
    await dbClient.query(sql)    
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
      ON t.cbvl_id = s.cbvl_id
      WHEN MATCHED AND t.name != s.name THEN
        UPDATE SET
          name = s.name,
          club = s.club,
          cbvl_pending = s.cbvl_pending,
          license_level = s.license_level,
          updated_at = NOW()
      WHEN MATCHED AND t.club != s.club THEN
        UPDATE SET
          name = s.name,
          club = s.club,
          cbvl_pending = s.cbvl_pending,
          license_level = s.license_level,
          updated_at = NOW()
      WHEN MATCHED AND t.cbvl_pending != s.cbvl_pending THEN
        UPDATE SET
          name = s.name,
          club = s.club,
          cbvl_pending = s.cbvl_pending,
          license_level = s.license_level,
          updated_at = NOW()
      WHEN MATCHED AND t.license_level != s.license_level THEN
        UPDATE SET
          name = s.name,
          club = s.club,
          cbvl_pending = s.cbvl_pending,
          license_level = s.license_level,
          updated_at = NOW()
      WHEN NOT MATCHED THEN
        INSERT (cbvl_id, cbvl_pending, name, club, license_level, inserted_at) 
        VALUES (s.cbvl_id, s.cbvl_pending, s.name, s.club, s.license_level, NOW())
      RETURNING
        merge_action() as action,
        t.cbvl_id,
        t.name,
        t.club,
        t.cbvl_pending,
        t.license_level,
        t.inserted_at,
        t.updated_at
    `
    const reportMerg = await dbClient.query(sql)
    this.#loggerSynchronize('Pilots synchronization - Merge table report')
    this.#loggerSynchronize(JSON.stringify(reportMerg))
  }
  

  #loggerSynchronize(text) {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.synchronize} | ${text}`)
  }
 



// ======================================================================== Post-Process step ========================================================================



  async postProcess () {
    this.#loggerPostProcess('Start step')
    this.syncReport.startStep(this.processName, SyncProcessor.STEP_NAMES.postProcess)


    this.#loggerPostProcess('Atualizando IDs XCBrasil de pilotos XCCOMP-DB')
    const updateXcbrasilIdsResults = await updateXcbrasilIds()
    this.#reportUpdateXcbrasilIdsResults(updateXcbrasilIdsResults)
    
    this.#loggerPostProcess('Gerando relatório de pilotos do banco XCCOMP-DB que não foram encontrados no syncronismo')
    await this.#reportRegistredPilotsMissingFromSync()

    this.#loggerPostProcess('End step')
    this.syncReport.endStep(this.processName, SyncProcessor.STEP_NAMES.postProcess)
  }


  #reportUpdateXcbrasilIdsResults = (updateXcbrasilIdsResults) => {
    if (updateXcbrasilIdsResults.error) {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.postProcess, 
        type: SyncReport.OCCURENCE_TYPES.warning,
        info: 'Falha durante o processo de atualização dos IDs do XCBrasil de pilotos do XCCOMP_DB',
        details: updateXcbrasilIdsResults.error
      })
    }
    const resultSearches = updateXcbrasilIdsResults.searches
    if (resultSearches.errorList?.length) {
      const total = resultSearches.errorList.length + resultSearches.successList.length
      const totalErrors = resultSearches.errorList.length
      const log = `Das ${total} tentativas de busca de IDs do XCBrasil, ${totalErrors} foram malsucedidas`
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.postProcess, 
        type: SyncReport.OCCURENCE_TYPES.warning,
        info: log,
        details: resultSearches.errorList
      })
    } 
    const resultUpdates = updateXcbrasilIdsResults.updates
    if (resultUpdates.errorList?.length) {
      const total = resultUpdates.errorList.length + resultUpdates.successList.length
      const totalErrors = resultUpdates.errorList.length
      const log = `Das ${total} tentativas de gravação de IDs do XCBrasil, ${totalErrors} foram malsucedidas`
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.postProcess, 
        type: SyncReport.OCCURENCE_TYPES.warning,
        info: log,
        details: resultUpdates.errorList
      })
    } 
  }


  async #reportRegistredPilotsMissingFromSync () {
    let dbClient = null
      try {
        dbClient = await XCCompDB.getClient()
        const sql = `
          SELECT p.id, p.cbvl_id, p.xcbrasil_id, p.name
          FROM pilots p
          WHERE NOT EXISTS (
            SELECT 1
            FROM pilots_sync ps
            WHERE p.cbvl_id = ps.cbvl_id
          )
          ORDER BY p.name ASC 
        ` 
        const queryResult = await dbClient.query(sql)
        if (queryResult.rows.length) {
          this.syncReport.addOccurrence({ 
            process: this.processName,
            step: SyncProcessor.STEP_NAMES.postProcess, 
            type: SyncReport.OCCURENCE_TYPES.warning,
            info: `${queryResult.rows.length} pilotos do banco XCCOMP-DB não foram encontrados no syncronismo`,
            details: queryResult.rows
          })
        } 
      } catch (error) {
        this.syncReport.addOccurrence({ 
          process: this.processName,
          step: SyncProcessor.STEP_NAMES.postProcess, 
          type: SyncReport.OCCURENCE_TYPES.warning,
          info: "Houve uma falha na verificação da existencia nos registros nas tabelas de sincronismo.",
          details: resultUpdates.errorList
        })
      } finally  {
        dbClient?.release()
      }
  }
  

  #loggerPostProcess(text) {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.postProcess} | ${text}`)
  }
}






