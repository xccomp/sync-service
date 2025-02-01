import axios from 'axios'
import * as cheerio from 'cheerio'
import XCCompDB from "#libs/xccomp-db/index.js"
import { logger } from "#logger"
import { GliderCertifications } from '#domain/entities/glider-certifications.js'
import { SyncProcessor } from '../sync-porcessor.js'
import SyncReport from '#sync-report'
import { postProcess } from './post-process-gliders.js'

export default class GliderSyncProcessor {
  
  constructor ({firstStep, lastStep, options, syncReport}) {
    this.processName = 'GLIDER-SYNC'
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

// ======================= Scraping step ==========================

  async scrape () {
    this.#loggerScrape(`Start step`)
    this.syncReport.startStep(this.processName, SyncProcessor.STEP_NAMES.scrape)
    
    const brands = await this.#scrapeBrands()
    const models = []
    for (const brand of brands) {
      const brandModels = await this.#scrapeModels(brand.id, brand.name)
      models.push(...brandModels)
    }
   
    try {
      const data = { brands, models }
      this.syncProcessor.saveDataOnSyncFile(data, SyncProcessor.STEP_NAMES.scrape)
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


  async #scrapeBrands () {
    this.#loggerScrape('Glider brands scraping process started')
    const url = 'http://www.xcbrasil.com.br/GUI_EXT_add_glider.php'
    let htmlPage = null
   
    try {
      this.#loggerScrape('Getting brands data from XCBrasil')
      htmlPage = await (await axios.get(url)).data 
    
    } catch (error) {
      this.#loggerScrape('Getting brands data from XCBrasil process failed')
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.scrape, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Getting brands data from XCBrasil process failed',
        details: error
      })
      throw error
    }
 

    let data =  null 
    try {
      this.#loggerScrape('Extracting paraglider brands from XCBrasil data')
      const $ = cheerio.load(htmlPage)
      data = $.extract({
        brands: [{
          selector: '#gliderBrandID > option',
          value: (el) => ({
            id: $(el).attr('value'),
            name: $(el).text()
          }),
        }]
      })
      const index = data.brands.findIndex(el => (el.id === '0'))
      index >= 0 && data.brands.splice(index, 1)
    
    } catch (error) {
      this.#loggerScrape('Extracting paraglider brands from XCBrasil data failed')
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.scrape, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Extracting paraglider brands from XCBrasil data failed',
        details: error
      })
      throw error
    }

    this.#loggerScrape('Glider brands scraping process completed')
    return data.brands
  }


  async #scrapeModels (brandId, brandName) {
    this.#loggerScrape(`Glider models scraping process started - brand ${brandName}, id ${brandId}`)
    let models = null   
    const url = `http://www.xcbrasil.com.br/AJAX_gliders.php?op=gliders_list&brandID=${brandId}`
    
    try {
      models = await (await axios.get(url)).data.Records
    } catch (error) {
      this.#loggerScrape(`Glider models scraping process failed - brand ${brandName}, id ${brandId}`)
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.scrape, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: `Glider models scraping process failed - brand ${brandName}, id ${brandId}`,
        details: error
      })
      throw error
    }

    if (!Array.isArray(models) || !models.length) {
      this.#loggerScrape(`Glider models scraping process experienced a data inconsistency - brand ${brandName}, id ${brandId}`)
      logger.warn(`Models of brand ${brandName} - ${brandId} not found`)
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.scrape, 
        type: SyncReport.OCCURENCE_TYPES.dataInconssitence,
        info: `Models of brand ${brandName} - ${brandId} not found`,
        details: { request: url, requestResult: models}
      })
      models = []
    }

    this.#loggerScrape('Glider models scraping process completed')
    return models
  }


  #loggerScrape(text) {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.scrape} | ${text}`)
  }


// ======================= Transform step ==========================

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
      transformedData = {
        brands: this.#transformBrands(scrapedData.brands),
        models: this.#transformModels(scrapedData.models)
      }
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


  #transformBrands (brands) {
    this.#loggerTransform(`Transforming glider brands data`)
    return brands.map(brand => ({
      id: Number(brand.id),
      name: brand.name
    }))
  }

  
  #transformModels (models) {
    this.#loggerTransform(`Transforming glider models data`)
    const mapCertification = new Map([
      ['1', GliderCertifications.LFT_1], 
      ['2', GliderCertifications.LFT_1_2],
      ['4', GliderCertifications.LFT_2],
      ['8', GliderCertifications.LFT_2_3],
      ['16', GliderCertifications.LFT_3],
      ['32', GliderCertifications.EN_A],
      ['64', GliderCertifications.EN_B],
      ['128', GliderCertifications.EN_C],
      ['256', GliderCertifications.EN_D],
      ['1024', GliderCertifications.EN_CCC]
    ])
    return models.map(model => ({
      id: Number(model.gliderID),
      brandId: Number(model.brandID),
      name: model.gliderName,
      certification: mapCertification.get(model.gliderCert) || GliderCertifications.NONE
    }))
  }


  #loggerTransform(text) {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.transform} | ${text}`)
  }


// ======================= Load step ==========================


  async load () {
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

      this.#loggerLoad('Clearing synchronization tables')
      await dbClient.query('START TRANSACTION')
      this.#clearOldSyncDataOnDb(dbClient)
      await dbClient.query('COMMIT')

      this.#loggerLoad('Loading brands on synchronization tables')
      await dbClient.query('START TRANSACTION')
      this.#loadBrands(transformedData.brands, dbClient)
      await dbClient.query('COMMIT')

      this.#loggerLoad('Loading models on synchronization tables')
      await dbClient.query('START TRANSACTION')
      this.#loadModels(transformedData.models, dbClient)
      await dbClient.query('COMMIT')
      
    } catch (error) {
      this.#loggerLoad('Gliders loading data failed')
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.load, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Gliders loading data failed',
        details: error
      })
      dbClient && await dbClient.query('ROLLBACK')
      throw error
    } finally {
      dbClient && dbClient.release()
    }
    
    this.#loggerLoad('End step')
    this.syncReport.endStep(this.processName, SyncProcessor.STEP_NAMES.load)
  }

  async #clearOldSyncDataOnDb (dbClient) {
    const sqlDeleteModels = 'DELETE FROM glider_models_sync'
    const sqlDeleteBrands = 'DELETE FROM glider_brands_sync'
    await dbClient.query(sqlDeleteModels)
    await dbClient.query(sqlDeleteBrands)
  }
  
  async #loadBrands (brands, dbClient) {
    const sql = 'INSERT INTO glider_brands_sync(id, name, inserted_at) VALUES ' 
      + brands.map(brand => `(${brand.id}, '${brand.name}', NOW())`).join(',')
    await dbClient.query(sql)    
  }
  
  async #loadModels (models, dbClient) {
    const sql = 'INSERT INTO glider_models_sync(id, name, certification, brand_id, inserted_at) VALUES' 
      + models.map(model => `(${model.id},'${model.name}', ${model.certification}, ${model.brandId}, NOW())`).join(',')
    await dbClient.query(sql)   
  }

  #loggerLoad(text) {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.load} | ${text}`)
  }



// ======================= Synchronize step ==========================



  async synchronize () {
    this.#loggerSynchronize('Start step')
    this.syncReport.startStep(this.processName, SyncProcessor.STEP_NAMES.synchronize)

    let dbClient = null
    try {
      dbClient = await XCCompDB.getClient()
      await dbClient.query('BEGIN')
      await this.#synchronizeBrands(dbClient)
      await this.#synchronizeModels(dbClient)
      this.#loggerSynchronize('Commiting transaction of glider data table synchronization')
      await dbClient.query('COMMIT')
      this.#loggerSynchronize('Glider data table synchronization completed')
    } catch (error) {
      this.#loggerSynchronize('Glider data table synchronization failed')
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.synchronize, 
        type: SyncReport.OCCURENCE_TYPES.error,
        info: 'Glider data table synchronization failed',
        details: error
      })
      dbClient && await dbClient.query('ROLLBACK')
      throw error
    } finally {
      dbClient && dbClient.release()
    }

    this.#loggerSynchronize('End step')
    this.syncReport.endStep(this.processName, SyncProcessor.STEP_NAMES.synchronize)
  }


  async #synchronizeBrands (dbClient) {
    const sqlMergeBrands = `
      MERGE INTO glider_brands t
      USING glider_brands_sync s
      ON t.id = s.id
      WHEN MATCHED AND t.name != s.name THEN
        UPDATE SET
          name = s.name,
          updated_at = NOW()
      WHEN NOT MATCHED THEN
        INSERT (id, name, inserted_at)
        VALUES (s.id, s.name, NOW())
      RETURNING
        merge_action() as action,
        t.id,
        t.name,
        t.inserted_at,
        t.updated_at
    `
    const reportMergBrands = await dbClient.query(sqlMergeBrands)
    this.#loggerSynchronize('Glider brands synchronization - Merge table report')
    this.#loggerSynchronize(reportMergBrands)
  }
  
  async #synchronizeModels (dbClient) {
    const sqlMergeModels = `
      MERGE INTO glider_models t
      USING glider_models_sync s
      ON t.id = s.id
      WHEN MATCHED AND t.name != s.name THEN
        UPDATE SET
          name = s.name,
          certification = s.certification,
          brand_id = s.brand_id,
          updated_at = NOW()
      WHEN MATCHED AND t.certification != s.certification THEN
        UPDATE SET
          name = s.name,
          certification = s.certification,
          brand_id = s.brand_id,
          updated_at = NOW()
      WHEN MATCHED AND t.brand_id != s.brand_id THEN
        UPDATE SET
          name = s.name,
          certification = s.certification,
          brand_id = s.brand_id,
          updated_at = NOW()
      WHEN NOT MATCHED THEN
        INSERT (id, name, certification, brand_id, inserted_at)
        VALUES (s.id, s.name, s.certification, s.brand_id, NOW())
      RETURNING
        merge_action() as action,
        t.id,
        t.name,
        t.certification,
        t.brand_id,
        t.inserted_at,
        t.updated_at
    `
    const reportMergeModels = await dbClient.query(sqlMergeModels)
    this.#loggerSynchronize('Glider models synchronization - Merge table report')
    this.#loggerSynchronize(reportMergeModels)
  }

  #loggerSynchronize(text) {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.synchronize} | ${text}`)
  }
 


// ======================= Post-Process step ==========================



  async postProcess () {
    this.#loggerPostProcess('Start step')
    this.syncReport.startStep(this.processName, SyncProcessor.STEP_NAMES.postProcess)
    const result = await postProcess()
    if (result.mappingResults.error) { 
      this.syncReport.addOccurrence({ 
        process: this.processName,
        step: SyncProcessor.STEP_NAMES.postProcess, 
        type: SyncReport.OCCURENCE_TYPES.warning,
        info: 'Houve um problema na criação de mapeamentos de gliders',
        details: result.mappingResults.error
      })
    }

    this.#loggerPostProcess('End step')
    this.syncReport.endStep(this.processName, SyncProcessor.STEP_NAMES.postProcess, result.mappingResults)
  }

  #loggerPostProcess(text) {
    logger.info(`sync-procces: ${this.processName} - step: ${SyncProcessor.STEP_NAMES.postProcess} | ${text}`)
  }
}






