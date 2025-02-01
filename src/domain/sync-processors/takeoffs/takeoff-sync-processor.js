
import axios from 'axios'
import XCCompDB from '#libs/xccomp-db/index.js'
import { logger } from '#logger'
import { SyncProcessor } from '../sync-porcessor.js'
import SyncReport from '#sync-report'
import { XMLParser } from 'fast-xml-parser'
import { updateCitiesOfTakeoffs } from '#domain/use-cases/update-cities-of-takeoffs.js'
import { updateIbgeCitiesOfCities } from '#domain/use-cases/update-ibge-cities-of-cities.js'

export default class TakeoffSyncProcessor {
  
  constructor ({firstStep, lastStep, options, syncReport}) {
    this.processName = 'TAKEOFF-SYNC'
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
  // takeoff-sync-scrape: [{
  //   id: string,
  //   name: string,
  //   latitude: string,
  //   longitude: string,
  // }]
  //
  // takeoff-sync-transform: [{
  //   cbvlId: integer,
  //   name: string,
  //   club: string,
  //   cbvlPending: boolean,
  //   licenseLevel: integer
  // }]


// ======================================================================== Scraping step ========================================================================

  async scrape () {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.scrape} | Etapa iniciada`)
    this.syncReport.startStep(this.processName, SyncProcessor.STEP_NAMES.scrape)
   
    let xmlData = null
    try {
      const url = 'http://www.xcbrasil.com.br/EXT_takeoff.php?op=get_latest&tm=999999999'
      xmlData = await (await axios.get(url)).data
      if (!xmlData || xmlData === '' ) {
        throw new Error(`Nenhum dado encontrado em ${url}`)
      }
  
    } catch (error) {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.scrape, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Falha na busca de dados no XCBrasil',
        details: error
      })
      throw error
    }

    let scrapedData = null
    try {
    const parseOptions = {
      updateTag: (tagName) => {
        if (tagName === 'search') { return 'root' }
        if (tagName === 'waypoint') { return 'takeoffs' }
        if (tagName === 'id') { return 'id' }
        if (tagName === 'name') { return 'name' }
        if (tagName === 'lat') { return 'latitude' }
        if (tagName === 'lon') { return 'longitude' }
        return false
      }
    }
    const xmlParser = new XMLParser(parseOptions)
    scrapedData = xmlParser.parse(xmlData)
  } catch (error) {
    this.syncReport.addOccurrence({ 
      process: this.processName,
      step: SyncProcessor.STEP_NAMES.scrape, 
      type: SyncReport.OCCURENCE_TYPES.error,
      info: 'falha na extração de dados do XML',
      details: error
    })
    throw error
  }

  try {
    this.syncProcessor.saveDataOnSyncFile(scrapedData.root.takeoffs, SyncProcessor.STEP_NAMES.scrape)
  } catch (error) {
    this.syncReport.addOccurrence({ 
      process: this.processName,
      step: SyncProcessor.STEP_NAMES.scrape, 
      type: SyncReport.OCCURENCE_TYPES.error,
      info: 'Falha na gravação de arquivo de sincronismo',
      details: error
    })
    throw error
  }
  logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.scrape} | Etapa finalizda`)
}



// ======================================================================== Transform step ========================================================================

  async transform () {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.transform} | Etapa iniciada`)
    this.syncReport.startStep(this.processName, SyncProcessor.STEP_NAMES.transform)
    
    let scrapedData = null 
    try {
      scrapedData = this.syncProcessor.loadDataFromSyncFile(SyncProcessor.STEP_NAMES.scrape)
    } catch (error) {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.transform, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Falha na leitura de arquivo de sincronismo',
        details: error
      })
      throw error
    }

    let transformedData = null
    try {
      transformedData = this.#normalizeData(scrapedData)
    } catch (error) {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.transform, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Falha na tentativa de normalização de dados',
        details: error
      })
      throw error 
    }

    try {
      this.syncProcessor.saveDataOnSyncFile(transformedData, SyncProcessor.STEP_NAMES.transform)
    } catch (error) {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.transform, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Falha na gravação de arquivo de sincronismo',
        details: error
      })
      throw error
    }
    this.syncReport.endStep(this.processName, SyncProcessor.STEP_NAMES.transform)
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.transform} | Etapa finalizda`)
  }

  #normalizeData (scrapedData) {
    const normalizedData = scrapedData.map(takeoff => ({
      id: Number(takeoff.id),
      name: takeoff.name, 
      latitude: Number(takeoff.latitude),
      longitude: Number(takeoff.longitude)
    }))
    return normalizedData
  }


// ======================================================================== Load step ========================================================================



  async load () {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.load} | Etapa iniciada`)
    this.syncReport.startStep(this.processName, SyncProcessor.STEP_NAMES.load)

    let transformedData = null
    try {
      transformedData = this.syncProcessor.loadDataFromSyncFile(SyncProcessor.STEP_NAMES.transform)
    } catch (error) {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.load, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Falha na leitura de arquivo de sincronismo',
        details: error
      })
      throw error
    }
 
    let dbClient = null
    try {
      dbClient = await XCCompDB.getClient()
      await this.#clearOldSyncDataOnDb(dbClient)
      await this.#saveTakeoffs(transformedData, dbClient) 
    } catch (error) {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.load, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Falha na tentativa de gravar rampas (takeoffs) no banco de dados',
        details: error
      })
      throw error
    } finally {
      dbClient && dbClient.release()
    }
    
    this.syncReport.endStep(this.processName, SyncProcessor.STEP_NAMES.load)
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.scrape} | Etapa finalizada`)
  }

  async #clearOldSyncDataOnDb (dbClient) {
    const sql = 'DELETE FROM takeoffs_sync'
    await dbClient.query(sql)
  }
  
  async #saveTakeoffs (takeoffs, dbClient) {
    const a = takeoffs.find(el => el.latitude > 999.9 || el.latitude < -999.9 || el.longitude > 999.9 || el.longitude < -999.9)
    const sql = `
      INSERT INTO 
        takeoffs_sync (id, name, latitude, longitude) 
      VALUES  
        ${takeoffs.map(t => `(
          ${t.id},
          $$${t.name}$$, 
          ${t.latitude},
          ${t.longitude}
        )`).join(',')}
    `
    await dbClient.query(sql)    
  }




// ======================================================================== Synchronize step ========================================================================




  async synchronize () {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.synchronize} | Etapa iniciada`)
    this.syncReport.startStep(this.processName, SyncProcessor.STEP_NAMES.synchronize)

    let dbClient = null
    try {
      dbClient = await XCCompDB.getClient()
      await this.#synchronizeTakeoffs(dbClient)
    } catch (error) {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.synchronize, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Falha na tentativa de sincronizar as tabelas de rampas (takeoffs)',
        details: error
      })
      throw error
    } finally {
      dbClient && dbClient.release()
    }

    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.synchronize} | Etapa finalizada`)
    this.syncReport.endStep(this.processName, SyncProcessor.STEP_NAMES.synchronize)
  }


  async #synchronizeTakeoffs (dbClient) {
    const sql = `
      MERGE INTO takeoffs t
      USING takeoffs_sync s
      ON t.id = s.id
      WHEN MATCHED AND t.name != s.name THEN
        UPDATE SET
          name = s.name,
          updated_at = NOW()
      WHEN NOT MATCHED THEN
        INSERT (id, name, latitude, longitude) 
        VALUES (s.id, s.name, s.latitude, s.longitude)
      RETURNING
        merge_action() as action,
        t.id,
        t.name,
        t.latitude,
        t.longitude,
        t.inserted_at,
        t.updated_at
    `
    const reportMerg = await dbClient.query(sql)
    console.log(reportMerg)
    return reportMerg
  }
  
 



// ======================================================================== Post-Process step ========================================================================



  async postProcess () {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.postProcess} | Etapa iniciada`)
    this.syncReport.startStep(this.processName, SyncProcessor.STEP_NAMES.postProcess)
    
    const updateCitiesOfTakeoffsResults = await updateCitiesOfTakeoffs()
    this.#reportUpdateCitiesOfTakeoffsResults(updateCitiesOfTakeoffsResults)
    
    const updateIbgeCitiesOfCitiesResults = await updateIbgeCitiesOfCities()
    this.#reportUpdateIbgeCitiesOfCitiesResults(updateIbgeCitiesOfCitiesResults)

    await this.#reportRegistredTakeoffsMissingFromSync()

    this.syncReport.endStep(this.processName, SyncProcessor.STEP_NAMES.postProcess)
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.postProcess} | Etapa finalizada`)
  }


  #reportUpdateCitiesOfTakeoffsResults = (updateCitiesOfTakeoffsResults) => {
    if (updateCitiesOfTakeoffsResults.error) {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.postProcess, 
        type: SyncReport.OCCURENCE_TYPES.warning,
        info: 'Falha durante o processo de atualização da cidades das rampas no XCCOMP_DB',
        details: updateCitiesOfTakeoffsResults.error
      })
    }
    const resultSearches = updateCitiesOfTakeoffsResults.searches
    if (resultSearches.errorList?.length) {
      const total = resultSearches.errorList.length + resultSearches.successList.length
      const totalErrors = resultSearches.errorList.length
      const log = `Das ${total} tentativas de busca de cidades no GOOGLE GEOCODING API, ${totalErrors} foram malsucedidas`
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.postProcess, 
        type: SyncReport.OCCURENCE_TYPES.warning,
        info: log,
        details: resultSearches.errorList
      })
    } 
    const resultUpdates = updateCitiesOfTakeoffsResults.updates
    if (resultUpdates.errorList?.length) {
      const total = resultUpdates.errorList.length + resultUpdates.successList.length
      const totalErrors = resultUpdates.errorList.length
      const log = `Das ${total} tentativas de gravação e vinculação das cidades às rampas no XCCOMP_DB, ${totalErrors} foram malsucedidas`
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.postProcess, 
        type: SyncReport.OCCURENCE_TYPES.warning,
        info: log,
        details: resultUpdates.errorList
      })
    } 
  }

  #reportUpdateIbgeCitiesOfCitiesResults = (updateIbgeCitiesOfCitiesResults) => {
    if (updateIbgeCitiesOfCitiesResults.error) {
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.postProcess, 
        type: SyncReport.OCCURENCE_TYPES.warning,
        info: 'Falha durante o processo de vinculação entre  cidades e "cidades ibge" no XCCOMP_DB',
        details: updateIbgeCitiesOfCitiesResults.error
      })
    }
    const resultSearches = updateIbgeCitiesOfCitiesResults.searches
    if (resultSearches.errorList?.length) {
      const total = resultSearches.errorList.length + resultSearches.successList.length
      const totalErrors = resultSearches.errorList.length
      const log = `Das ${total} tentativas de encontrar uma "cidade ibge" relacionada a uma cidade no XCCOMP_DM, ${totalErrors} foram malsucedidas`
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.postProcess, 
        type: SyncReport.OCCURENCE_TYPES.warning,
        info: log,
        details: resultSearches.errorList
      })
    } 
    const resultUpdates = updateIbgeCitiesOfCitiesResults.updates
    if (resultUpdates.errorList?.length) {
      const total = resultUpdates.errorList.length + resultUpdates.successList.length
      const totalErrors = resultUpdates.errorList.length
      const log = `Das ${total} tentativas de gravação do vínculo das cidades às "cidades ibge" no XCCOMP_DB, ${totalErrors} foram malsucedidas`
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.postProcess, 
        type: SyncReport.OCCURENCE_TYPES.warning,
        info: log,
        details: resultUpdates.errorList
      })
    } 
  }


  async #reportRegistredTakeoffsMissingFromSync () {
    let dbClient = null
      try {
        dbClient = await XCCompDB.getClient()
        const sql = `
          SELECT t.id, t.name
          FROM takeoffs t
          WHERE NOT EXISTS (
            SELECT 1
            FROM takeoffs_sync ts
            WHERE t.id = ts.id
          )
          ORDER BY t.name ASC 
        ` 
        const queryResult = await dbClient.query(sql)
        if (queryResult.rows.length) {
          this.syncReport.addOccurrence({ 
            process: this.processName,
            step: SyncProcessor.STEP_NAMES.postProcess, 
            type: SyncReport.OCCURENCE_TYPES.warning,
            info: `${queryResult.rows.length} Rampas do banco XCCOMP-DB não foram encontrados no syncronismo`,
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
  

}






