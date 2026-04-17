import { logger } from "#logger"
import XCCompDB from "#libs/xccomp-db/index.js"
import injectionContainer from '#modules/synchronization/core/injection-container.js'
import fs from 'fs'


export async function loadFlights () {
  logger.info(`Carregamento de voos iniciado`) 
  const startTime = Date.now()
  let totalItemsLoadedIntoSyncTable = 0
  let totalItemsSynchronized = 0
  try {
    await clearSyncTable()
    const dataToLoad = loadDataFromSyncFile()
    for (const key of Object.keys(dataToLoad)) {
      const oneDayData = dataToLoad[key]
      logger.info(`Carregando dados na tabela de sincornismo de voos por data | data: ${key}`)  
      await laodDataOnSyncTables(oneDayData)
      totalItemsLoadedIntoSyncTable += oneDayData.length
    }
    logger.info('Sincronizando rampas necessarias para o sincronismo de voos') 
    await synchronizeMissingTakeoffs()
    logger.info('Sincronizando pilotos necessarios para o sincronismo de voos') 
    await synchronizeMissingPilots()
    logger.info(`Executando sincronismo de tabelas de voos`) 
    totalItemsSynchronized = await executeTablesSync()
  } catch (error) {
    logger.warn(`Falha no carregamento de voos`) 
    return makeReport(startTime, totalItemsLoadedIntoSyncTable, totalItemsSynchronized, error)
  }
  logger.info(`Carregamento de voos finalizado`) 
  return makeReport(startTime, totalItemsLoadedIntoSyncTable, totalItemsSynchronized)
}


async function laodDataOnSyncTables (dataToLoad) {
  const dbClient = await XCCompDB.getClient()
  try {
    const sql = `
      INSERT INTO
        flights_sync (
          id,
          pilot_id,
          takeoff_id,
          glider,
          date,
          duration,
          linear_distance,
          olc_distance,
          olc_score,
          xc_type
        )
      VALUES 
        ${dataToLoad.map(d => `(
          ${d.id},
          ${d.pilotId},
          ${d.takeoffId},
          $$${d.glider}$$,
          $$${d.date}$$,
          ${d.duration},
          ${d.linearDistance},
          ${d.olcDistance},
          ${d.olcScore},
          ${d.xcType}           
        )`).join(',')}
    `
    await dbClient.query(sql) 
  } catch (error) {
    throw error
  } finally {
    dbClient.release()
  }
}

async function executeTablesSync () {
  const dbClient = await XCCompDB.getClient()
  try {
    const sql = `
      MERGE INTO flights t
      USING flights_sync s
      ON t.id = s.id
      WHEN NOT MATCHED THEN
        INSERT (
          id,
          pilot_id,
          takeoff_id,
          glider_xcbrasil,
          date,
          duration,
          linear_distance,
          olc_distance,
          olc_score,
          xc_type
        )
        VALUES (
          s.id,
          s.pilot_id,
          s.takeoff_id,
          s.glider,
          s.date,
          s.duration,
          s.linear_distance,
          s.olc_distance,
          s.olc_score,
          s.xc_type
        )
      RETURNING
        merge_action() as action,
        t.id,
        t.pilot_id,
        t.takeoff_id,
        t.olc_score
    `  
    const result = await dbClient.query(sql) 
    return result.rows.length
  } catch (error) {
    throw error
  } finally {
    dbClient.release()
  }
}

async function clearSyncTable () {
  const dbClient = await XCCompDB.getClient()
  try {
    const sql = 'DELETE FROM flights_sync'
    await dbClient.query(sql)
  } catch (error) {
    throw error
  } finally {
    dbClient.release()
  }
}

function makeReport (startTime, totalItemsLoadedIntoSyncTable, totalItemsSynchronized, error = null) {
  const endTime = Date.now()
  const totalTime = (endTime - startTime) / 1000
  return {
    details: {
      startTime,
      endTime,
      totalTime,
      totalItemsLoadedIntoSyncTable,
      totalItemsSynchronized
    },
    warnings: [],
    error
  }
}

function loadDataFromSyncFile () {
  fs.mkdirSync('./sync-files', { recursive: true })
  const filePath = './sync-files/flight-sync-transform.json'
  if (!fs.existsSync(filePath)) {
    saveDataOnSyncFile({})
  }
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(fileContent)
  return data
}

async function synchronizeMissingTakeoffs () {
  const { takeoffRepository } = injectionContainer.repositories;
  const { takeoffScraper } = injectionContainer.scrapers;
  const missingTakeoffIds = await takeoffRepository.getMissingTakeoffIdsInSynchronization();
  const takeoffs = await takeoffScraper.scrapeByIds(missingTakeoffIds);
  await takeoffRepository.save(takeoffs);
}

async function synchronizeMissingPilots () {
  const { pilotRepository } = injectionContainer.repositories;
  const { pilotScraper } = injectionContainer.scrapers;
  const missingPilotIds = await pilotRepository.getMissingPilotIdsInSynchronization();
  const pilots = await pilotScraper.scrapeByIds(missingPilotIds);
  await pilotRepository.save(pilots);
}