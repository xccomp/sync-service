import fs from 'fs'
import axios from 'axios'
import * as cheerio from 'cheerio'
import XCCompDB from "../../libs/xccomp-db/index.js"
import { logger } from "#logger"
import { NotFoundError, XCBrasilRequestError } from "./errors/index.js"
import { paragliderCertifications } from '#domain/entities/paraglider-certifications.js'

export async function executeSyncProcesc (firstStep = 1, lastStep = 4) {
  validateStepsParams(firstStep, lastStep)
  const steps = [
    scrape,
    prepare,
    load,
    synchronize
  ]

  let syncLog = `Gliders SYNC process started | selected steps: ${steps[firstStep - 1].name}`
  for (let index = firstStep; index < lastStep; index++) {
    const process = steps[index]
    syncLog += `, ${process.name}`
  }
  logger.info(syncLog)

  for (let index = firstStep - 1; index < lastStep; index++) {
    const process = steps[index]
    await process()
  }
  return true
}

export async function scrape () {
  logger.info('Gliders scraping process started')
  const brands = await scrapeBrands()
  const models = []
  for (const brand of brands) {
    const brandModels = await scrapeModels(brand.id, brand.name)
    models.push(...brandModels)
  }
  saveDataOnSyncFile({ brands, models }, 'scraped')
  logger.info('Gliders scraping process completed')
  return true
}

export async function prepare () {
  logger.info('Gliders preparing data process started')
  const scrapedData = loadDataFromSyncFile('scraped')
  const preparedBrands = prepareBrands(scrapedData.brands)
  const preparedModels = prepareModels(scrapedData.models)
  const preparedData = preparedBrands.map(brand => ({
    ...brand,
    models: preparedModels.filter(model => model.brandId === brand.id)
  }))
  saveDataOnSyncFile(preparedData, 'prepared')
  logger.info('Gliders preparing data process completed')
  return true
}

export async function load () {
  logger.info('Gliders loading data process started')
  const preparedData = loadDataFromSyncFile('prepared')
  const dbClient = await XCCompDB.getClient()
  try {
    await dbClient.query('BEGIN')
    clearOldSyncDataOnDb(dbClient)
    for (const brand of preparedData) {
      logger.info(`Inserting brand and models on database - brand ${brand.name} (${brand.id})`)
      await loadBrand(brand, dbClient)
      for (const model of brand.models) {
        await loadModel(model, dbClient)
      }
    }
    logger.info('Commiting transaction of gliders loading data process')
    await dbClient.query('COMMIT')
    logger.info('Gliders loading data process completed')
  } catch (error) {
    await dbClient.query('ROLLBACK')
    logger.info('Gliders loading data process failed')
    logger.error(error)
    throw error
  } finally {
    dbClient.release()
  }
  return true
}

export async function synchronize () {
  logger.info('Glider data table synchronization process started')
  const dbClient = await XCCompDB.getClient()
  try {
    await dbClient.query('BEGIN')
    await synchronizeBrands(dbClient)
    await synchronizeModels(dbClient)
    logger.info('Commiting transaction of glider data table synchronization process')
    await dbClient.query('COMMIT')
    logger.info('Glider data table synchronization process completed')
  } catch (error) {
    await dbClient.query('ROLLBACK')
    logger.info('Glider data table synchronization process failed')
    logger.error(error)
    throw error
  } finally {
    dbClient.release()
  }
  return true
}

async function scrapeBrands () {
  logger.info(`Glider brands scraping process started`)
  const url = 'http://www.xcbrasil.com.br/GUI_EXT_add_glider.php'
  let htmlPage = null
  try {
    logger.info(`Getting brands data from XCBrasil`)
    htmlPage = await (await axios.get(url)).data 
  } catch (error) {
    logger.info(`Getting brands data from XCBrasil process failed`)
    logger.error(error)
    throw new XCBrasilRequestError('Request /GUI_EXT_add_glider.php to XCBrasil failed', error)
  }
  logger.info(`Extracting paraglider brands from XCBrasil data`)
  const $ = cheerio.load(htmlPage)
  const data = $.extract({
    brands: [
      {
        selector: '#gliderBrandID > option',
        value: (el, key) => ({
          id: $(el).attr('value'),
          name: $(el).text()
        }),
      }
    ]
  })
  const index = data.brands.findIndex(el => (el.id === '0'))
  index >= 0 && data.brands.splice(index, 1)
  logger.info(`Glider brands scraping process completed`)
  return data.brands
}

async function scrapeModels (brandId, brandName) {
  logger.info(`Glider models scraping process started - brand ${brandName}, id ${brandId}`)
  let models = null   
  const url = `http://www.xcbrasil.com.br/AJAX_gliders.php?op=gliders_list&brandID=${brandId}`
  try {
    models = await (await axios.get(url)).data.Records
  } catch (error) {
    logger.info(`Glider models scraping process failed - brand ${brandName}, id ${brandId}`)
    logger.error(error)
    throw new XCBrasilRequestError(`Request /AJAX_gliders.php?op=gliders_list&brandID=${brandId} to XCBrasil failed`, error)
  }
  if (!Array.isArray(models)) {
    logger.info('Glider models scraping process failed- brand ${brandName}, id ${brandId}`')
    logger.error(`Models of brand ${brandName} - ${brandId}  not found`)
    throw new NotFoundError(`Models of brand ${brandName} - ${brandId}  not found`)
  }
  logger.info('Glider models scraping process completed')
  return models
}

function prepareBrands (brands) {
  logger.info(`Preparing glider brands data`)
  return brands.map(brand => ({
    id: Number(brand.id),
    name: brand.name,
    models: []
  }))
}
 
function prepareModels (models) {
  logger.info(`Preparing glider models data`)
  const mapCertification = new Map([
    ['1', paragliderCertifications.LFT_1], 
    ['2', paragliderCertifications.LFT_1_2],
    ['4', paragliderCertifications.LFT_2],
    ['8', paragliderCertifications.LFT_2_3],
    ['16', paragliderCertifications.LFT_3],
    ['32', paragliderCertifications.EN_A],
    ['64', paragliderCertifications.EN_B],
    ['128', paragliderCertifications.EN_C],
    ['256', paragliderCertifications.EN_D],
    ['1024', paragliderCertifications.EN_CCC]
  ])
  return models.map(model => ({
    id: Number(model.gliderID),
    brandId: Number(model.brandID),
    name: model.gliderName,
    certification: mapCertification.get(model.gliderCert) || paragliderCertifications.NONE
  }))
}

function saveDataOnSyncFile(data, type) {
  logger.info('Sync file saving process started')
  try {
    fs.writeFileSync(`./sync-files/${type}-sync-gliders.json`, JSON.stringify(data))
  } catch (error) {
    logger.info('Sync file saving process failed')
    logger.error(error)
    throw new Error('Sync file saving process failed')
  }
  logger.info('Sync file saving process completed')
}

function loadDataFromSyncFile (type) {
  logger.info('Sync file loading process started')
  let data = null 
  try {
    const fileContent = fs.readFileSync(`./sync-files/${type}-sync-gliders.json`, 'utf8')
    data = JSON.parse(fileContent) 
  } catch (error) {
    logger.info('Sync file loading process failed')
    logger.error(error)
    throw new Error('Sync file loading process failed')
  }
  logger.info('Sync file loading process completed')
  return data
}

async function clearOldSyncDataOnDb (dbClient) {
  const sqlDeleteBrands = 'DELETE FROM glider_brands_sync'
  const sqlDeleteModels = 'DELETE FROM glider_models_sync'
  await dbClient.query(sqlDeleteBrands)
  await dbClient.query(sqlDeleteModels)
}

async function loadBrand (brand, dbClient) {
  const preparedStatement = {
    name: 'glider-brands-load',
    text: 'INSERT INTO glider_brands_sync(id, name) VALUES($1, $2)',
    values: [brand.id, brand.name]
  }
  await dbClient.query(preparedStatement)
  
}

async function loadModel (model, dbClient) {
  const preparedStatement = {
    name: 'glider-models-load',
    text: 'INSERT INTO glider_models_sync(id, brand_id, name, certification) VALUES($1, $2, $3, $4)',
    values: [ model.id, model.brandId, model.name, model.certification  ]
  }
  await dbClient.query(preparedStatement)
}

async function synchronizeBrands (dbClient) {
  const sqlMergeBrands = `
    MERGE INTO glider_brands t
    USING glider_brands_sync s
    ON t.id = s.id
    WHEN MATCHED AND t.name != s.name THEN
      UPDATE SET
        name = s.name,
        last_updated = CURRENT_TIMESTAMP
    WHEN NOT MATCHED THEN
      INSERT (id, name)
      VALUES (s.id, s.name)
    RETURNING
      merge_action() as action,
      t.id,
      t.name,
      t.last_updated
  `
  const reportMergBrands = await dbClient.query(sqlMergeBrands)
  logger.info('Glider brands synchronization - Merge table report')
  logger.info(reportMergBrands)
}

async function synchronizeModels (dbClient) {
  const sqlMergeModels = `
    MERGE INTO glider_models t
    USING glider_models_sync s
    ON t.id = s.id
    WHEN MATCHED AND t.name != s.name THEN
      UPDATE SET
        name = s.name,
        certification = s.certification,
        brand_id = s.brand_id,
        last_updated = CURRENT_TIMESTAMP
    WHEN MATCHED AND t.certification != s.certification THEN
      UPDATE SET
        name = s.name,
        certification = s.certification,
        brand_id = s.brand_id,
        last_updated = CURRENT_TIMESTAMP
    WHEN MATCHED AND t.brand_id != s.brand_id THEN
      UPDATE SET
        name = s.name,
        certification = s.certification,
        brand_id = s.brand_id,
        last_updated = CURRENT_TIMESTAMP
    WHEN NOT MATCHED THEN
      INSERT (id, name, certification, brand_id)
      VALUES (s.id, s.name, s.certification, s.brand_id)
    RETURNING
      merge_action() as action,
      t.id,
      t.name,
      t.certification,
      t.brand_id,
      t.last_updated
  `
  const reportMergeModels = await dbClient.query(sqlMergeModels)
  logger.info('Glider models synchronization - Merge table report')
  logger.info(reportMergeModels)
}

function validateStepsParams (firstStep, lastStep) {
  const validSteps = [1, 2, 3, 4] 
  if (validSteps.includes(firstStep) || validSteps.includes(lastStep)) {
    throw new Error('The firstStep and lastStep must be between 1 and 4 ')
  }
  if (lastStep < firstStep) {
    throw new Error('The lastStep must be greater than or equal to the firstStep')
  }
} 