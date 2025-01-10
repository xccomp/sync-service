import { logger } from "#logger"
import XCCompDB from "#libs/xccomp-db/index.js"

export async function postProcess () {
  logger.info(`Pós-processamento de gliders iniciado`) 
  const startTime = Date.now()  

  const mappingResults = await createGliderNameMappings() 

  logger.info(`Pós-processamento de gliders finalizado`) 
  return makeReport(startTime, mappingResults)
}

async function createGliderNameMappings () {
  const result = {
    mappingsCreated: null,
    error: null
  }
  const dbClient = await XCCompDB.getClient()
  try {
    const sql = `
      INSERT INTO glider_name_mappings (glider_model_id, name)
        SELECT m.id, CONCAT(b.name, ' ', m.name) AS name FROM glider_models m
        INNER JOIN glider_brands b ON m.brand_id = b.id
      ON CONFLICT DO NOTHING
      RETURNING id
    `
    const resultQuery = await dbClient.query(sql)
    result.mappingsCreated = resultQuery.rows.length
    return result
  } catch (error) {
    result.error = error
    return result
  } finally {
    dbClient.release()
  }
}

function makeReport (startTime,  mappingResults) {
  const endTime = Date.now()
  const totalTime = (endTime - startTime) / 1000
  return {
    startTime,
    endTime,
    totalTime,
    mappingResults
  }
}