import { logger } from "#logger"
import XCCompDB from "#libs/xccomp-db/index.js"
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
          xc_type,
          validity
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
          ${d.xcType},
          ${d.validity}             
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
          date,
          duration,
          linear_distance,
          olc_distance,
          olc_score,
          xc_type,
          validity,
          pilot_xcbrasil,
          takeoff_xcbrasil,
          glider_xcbrasil
        )
        VALUES (
          s.id,
          s.date,
          s.duration,
          s.linear_distance,
          s.olc_distance,
          s.olc_score,
          s.xc_type,
          s.validity,
          s.pilot_id,
          s.takeoff_id,
          s.glider
        )
      RETURNING
        merge_action() as action,
        t.id,
        t.pilot_xcbrasil,
        t.takeoff_xcbrasil,
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
  const filePath = './sync-files/flight-sync-transform.json'
  if (!fs.existsSync(filePath)) {
    saveDataOnSyncFile({})
  }
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(fileContent)
  return data
}