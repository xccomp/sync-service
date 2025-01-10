import { logger } from "#logger"
import XCCompDB from "#libs/xccomp-db/index.js"
import { syncTakeoffById } from "#domain/use-cases/sync-takeoff-by-id.js"

export async function postProcessFlights () {
  logger.info(`Pós-processamento de voos iniciado`) 
  const startTime = Date.now()

  logger.info(`Criando os relacionamentos de voos com rampas`) 
  const resultRelateTakeoffs = await relateTakeoffs()
  logger.info(`Criando os relacionamentos de voos com pilotos`) 
  const resultRelatePilots = await relatePilots()
  logger.info(`Criando os relacionamentos de voos com gliders`) 
  const resultRelateGliders = await relateGliders()

  logger.info(`Pós-processamento de voos finalizado`) 
  return makeReport(startTime, resultRelateTakeoffs, resultRelatePilots, resultRelateGliders)
}

async function relateTakeoffs () {
  const result = {
    flightsUpdated: null,
    flightsNotUpdated: null,
    error: null
  } 
  const dbClient = await XCCompDB.getClient()
  try {
    const updateSql = `
      -- Preenche o campo "takeoff_id" na tabela "flights" caso exista
      -- a referência correta na tabela "takeoffs"
      UPDATE flights f
      SET
        takeoff_id = f.takeoff_xcbrasil
      WHERE 
        takeoff_id IS NULL 
        AND f.takeoff_xcbrasil IN (
          SELECT ft.id 
          FROM flights ff
          INNER JOIN takeoffs ft ON ff.takeoff_xcbrasil = ft.id
        )
      RETURNING f.id
    `
    let resultUpdate = await dbClient.query(updateSql)

    result.flightsUpdated = resultUpdate.rows.length
    const notUpdatedSql = `
      -- Retorna um registo com a quantidade de voos sem referência à
      -- uma rampa (flights.takeoff_id = takeoff.id)
      SELECT takeoff_xcbrasil
      FROM flights f
      WHERE f.takeoff_id IS NULL
    `
    let resultNotUpdatedSql = await dbClient.query(notUpdatedSql)
    result.flightsNotUpdated = resultNotUpdatedSql.rows.length

    for (const takeoff of resultNotUpdatedSql.rows) {
      await syncTakeoffById(takeoff.takeoff_xcbrasil)
      
    }

    resultUpdate = await dbClient.query(updateSql)
    result.flightsUpdated = resultUpdate.rows.length
    resultNotUpdatedSql = await dbClient.query(notUpdatedSql)
    result.flightsNotUpdated = resultNotUpdatedSql.rows.length

    return result
  } catch (error) {
    logger.error(error)
    result.error = error
    return result
  } finally {
    dbClient.release()
  }
}


async function relatePilots () {
  const result = {
    flightsUpdated: null,
    flightsNotUpdated: null,
    error: null
  } 
  const dbClient = await XCCompDB.getClient()
  try {
    const updateSql = `
      -- Preenche o campo "pilot_id" na tabela "flights" caso exista
      -- a referência correta na tabela "pilots"
      UPDATE flights f
      SET
        pilot_id = f.pilot_xcbrasil
      WHERE 
        f.pilot_id IS NULL 
        AND f.pilot_xcbrasil IN (
          SELECT fp.xcbrasil_id 
          FROM flights ff
          INNER JOIN pilots fp ON ff.pilot_xcbrasil = fp.xcbrasil_id
        )
      RETURNING f.id
    `
    const resultUpdate = await dbClient.query(updateSql)
    result.flightsUpdated = resultUpdate.rows.length

    const verificationSql = `
      -- Retorna um registo com a quantidade de voos sem referência à
      -- um piloto (flights.pilot_id = pilot.xcbrasil_id)
      SELECT COUNT(id) AS total 
      FROM flights f
      WHERE f.pilot_id IS NULL
    `
    const resultVerification = await dbClient.query(verificationSql)
    result.flightsNotUpdated = resultVerification.rows[0].total
    return result
  } catch (error) {
    result.error = error
    return result
  } finally {
    dbClient.release()
  }
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


function makeReport (startTime, resultRelateTakeoffs, resultRelatePilots, resultRelateGliders) {
  const endTime = Date.now()
  const totalTime = (endTime - startTime) / 1000
  return {
    relateTakeoffs: makeRelateTakeoffsReport(startTime, endTime, totalTime, resultRelateTakeoffs),
    relatePilots: makeRelatePilotsReport(startTime, endTime, totalTime, resultRelatePilots),
    relateGliders: makeRelateGlidersReport(startTime, endTime, totalTime, resultRelateGliders)   
  }
}


function makeRelateTakeoffsReport (startTime, endTime, totalTime, resultRelateTakeoffs) {
  const warnings = [] 
  if (resultRelateTakeoffs.flightsNotUpdated ) {
    warnings.push({ 
      message: `Não foi possível inserir a referência à uma rampa em um ou mais voos - Total de voos: ${resultRelateTakeoffs.flightsNotUpdated}`
    })
  }
  if (resultRelateTakeoffs.error) {
    warnings.push({ 
      message: 'Falha inesperada no processo de inserir referências de rampas em voos',
      error: resultRelateTakeoffs.error
    })
  }
  return {
    warnings,
    details: {
      startTime,
      endTime,
      totalTime,
      flightsUpdated: resultRelateTakeoffs.flightsUpdated,
      flightsNotUpdated: resultRelateTakeoffs.flightsNotUpdated
    }
  }
}

function makeRelatePilotsReport (startTime, endTime, totalTime, resultRelatePilots) {
  const warnings = [] 
  if (resultRelatePilots.flightsNotUpdated ) {
    warnings.push({ 
      message: `Não foi possível inserir a referência à um piloto em um ou mais voos - Total de voos: ${resultRelatePilots.flightsNotUpdated} - O aviso deve ser desconsiderado caso o banco de dados não esteja carregado com todos pilotos do XCBrasil`
    })
  }
  if (resultRelatePilots.error) {
    warnings.push({ 
      message: 'Falha inesperada no processo de inserir referências de pilotos em voos',
      error: resultRelatePilots.error
    })
  }
  return {
    warnings,
    details: {
      startTime,
      endTime,
      totalTime,
      flightsUpdated: resultRelatePilots.flightsUpdated,
      flightsNotUpdated: resultRelatePilots.flightsNotUpdated
    }
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

