import { logger } from "#logger"
import XCCompDB from "#libs/xccomp-db/index.js"
import { syncTakeoffById } from "#domain/use-cases/sync-takeoff-by-id.js"

export async function postProcessFlights () {
  logger.info(`Pós-processamento de voos iniciado`) 
  const startTime = Date.now()

  logger.info(`Criando os relacionamentos de voos com gliders`) 
  const resultRelateGliders = await relateGliders()

  logger.info(`Pós-processamento de voos finalizado`) 
  return makeReport(startTime, resultRelateGliders)
}


async function relateGliders () {
  const result = {
    flightsUpdated: null,
    flightsNotUpdated: null,
    glidersOfFlightsNotUpdated: null,
    error: null
  } 
  const dbClient = await XCCompDB.getClient()
  try {
    const updateSql = `
      -- Preenche o campo "glider_model_id" na tabela "flights" usando a tabela de
      -- mapeamento de nomes gliders "glider_name_mappings"
      UPDATE flights
      SET glider_model_id = subquery.glider_model_id
      FROM (
        SELECT  sm.glider_model_id, sm.name
        FROM flights sf
        INNER JOIN glider_name_mappings sm ON sf.glider_xcbrasil = sm.name
      ) AS subquery
      WHERE flights.glider_model_id IS NULL 
        AND flights.glider_xcbrasil = subquery.name
      RETURNING flights.id
    `
    const resultUpdate = await dbClient.query(updateSql)
    result.flightsUpdated = resultUpdate.rows.length

    const verificationSql = `
      -- Retorna um registo com a quantidade de voos sem referência à um modelo de 
      -- glider (flights.glider_model_id = glider_model.id) e a quantidade de nomes
      -- de gliders diferentes pertencentes à esses voos sem referências 
      SELECT DISTINCT
        SUM(count(id)) OVER() AS total_flights,
        SUM(count(distinct glider_xcbrasil)) OVER() AS total_gliders
      FROM flights f
      WHERE f.glider_model_id IS NULL
      GROUP BY glider_xcbrasil
    `
    const resultVerification = await dbClient.query(verificationSql)
    result.flightsNotUpdated = resultVerification.rows[0].total_flights
    result.glidersOfFlightsNotUpdated = resultVerification.rows[0].total_gliders
    return result
  } catch (error) {
    result.error = error
    return result
  } finally {
    dbClient.release()
  }
}


function makeReport (startTime, resultRelateGliders) {
  const endTime = Date.now()
  const totalTime = (endTime - startTime) / 1000
  return {
    relateGliders: makeRelateGlidersReport(startTime, endTime, totalTime, resultRelateGliders)   
  }
}


function makeRelateGlidersReport (startTime, endTime, totalTime, resultRelateGliders) {
  const warnings = [] 
  if (resultRelateGliders.flightsNotUpdated ) {
    warnings.push({ 
      message: `Não foi possível inserir a referência à um glider em um ou mais voos - Total de voos: ${resultRelateGliders.flightsNotUpdated}`
    })
  }
  if (resultRelateGliders.error) {
    warnings.push({ 
      message: 'Falha inesperada no processo de inserir referências de gliders em voos',
      error: resultRelateGliders.error
    })
  }
  return {
    details: {
      startTime,
      endTime,
      totalTime,
      flightsUpdated: resultRelateGliders.flightsUpdated,
      flightsNotUpdated: resultRelateGliders.flightsNotUpdated,
      glidersOfFlightsNotUpdated: resultRelateGliders.glidersOfFlightsNotUpdated
    },
    warnings
  }
}

