import { logger } from "#logger"
import { RegionalRankingsCategories } from "#domain/entities/regional-rankings-categories.js"
import { RegionalLeagues } from "#domain/entities/regional-leagues.js"
import { MesoregionsOfLeagues } from "#domain/entities/mesoregions-of-leagues.js"
import XCCompDB from "#libs/xccomp-db/index.js"


export async function calculeRegionalRankings (regionalLeagues = []) {
  
  await calculeRegionalRanking(RegionalLeagues.CERRADO_MINEIRO)
  await calculeRegionalRanking(RegionalLeagues.SUL_DE_MINAS)
  await calculeRegionalRanking(RegionalLeagues.VALE_DO_RIO_DOCE)
  await calculeRegionalRanking(RegionalLeagues.ZONA_DA_MATA)
  return true
}


async function calculeRegionalRanking (regionalLeague) {
  const categories = [ 
    RegionalRankingsCategories.FUN,
    RegionalRankingsCategories.SPORT, 
    RegionalRankingsCategories.SERIAL, 
    RegionalRankingsCategories.OPEN 
  ] 

  const pilots = await getPilotsWithoutPending()
  for (const category of categories) {
    logger.info(`Calculando RANKING DA LIGA ${regionalLeague} --- ${category} `)
    const flights =  await getValidFlightsPerCategory(category, regionalLeague) 
     for (const pilot of pilots) {
        if (!pilotIsValidOnCategory(pilot, category)) continue
        const flightsOfPilot = flights.filter(flight => flight.pilotId === pilot.id)
        const rankedFlights = selectValidFlights(flightsOfPilot)
        const totalScore = rankedFlights.reduce((acc, flight) => { return acc + flight.olcScore }, 0)
        await savePilotRank(pilot.id, totalScore, rankedFlights, category, regionalLeague)
     }
  }
}


async function getPilotsWithoutPending () {
  const dbClient = await XCCompDB.getClient()
  try {
    const sql = `
      SELECT
        xcbrasil_id AS "id",
        license_level AS "licenseLevel",
        female
      FROM pilots
      WHERE cbvl_pending = false
    `
    const result = await dbClient.query(sql)
    return result.rows
  } catch (error) {
    throw error

  } finally {
    dbClient.release()
  }
}


async function getValidFlightsPerCategory (category, regionalLeague) {
  const dbClient = await XCCompDB.getClient()
  try {
    const sql = `
      SELECT 
        f.pilot_id AS "pilotId",
        f.id AS "flightId",
        f.olc_score AS "olcScore",
        f.airspace_check AS "airspaceCheck",
        t.latitude,
        t.longitude

      FROM flights f
        INNER JOIN pilots p ON f.pilot_id = p.xcbrasil_id
        INNER JOIN glider_models g ON f.glider_model_id = g.id
        INNER JOIN takeoffs t ON f.takeoff_id = t.id
        INNER JOIN cities c ON t.city_id = c.id
        INNER JOIN ibge_cities i ON c.ibge_city_id =  i.id

      WHERE
        c.state = 'Minas Gerais'
        AND ${{
          [RegionalRankingsCategories.FUN]: 'g.certification < 30', 
          [RegionalRankingsCategories.SPORT]: 'g.certification < 40', 
          [RegionalRankingsCategories.SERIAL]: 'g.certification < 50', 
          [RegionalRankingsCategories.OPEN]: 'g.certification < 100',
        }[category]}
        AND i.mesoregion IN ($$${getMesoregionsOfLeague(regionalLeague).join('$$,$$')}$$)

      ORDER BY f.pilot_id
    `
    const result = await dbClient.query(sql)
    return result.rows
  } catch (error) {
    throw error
  } finally {
    dbClient.release()
  }
}

function getMesoregionsOfLeague (regionalLeague) {
  return MesoregionsOfLeagues[regionalLeague]
}


function pilotIsValidOnCategory (pilot, category) {
  if (category === RegionalRankingsCategories.FUN && pilot.licenseLevel > 2) { return false }
  return true
}


function selectValidFlights (flightsOfPilot) {
  flightsOfPilot.sort((a,b) => b.olcScore - a.olcScore)
  const selectedFlights = []
  for (const flight of flightsOfPilot) {
    if (verifyInvalidAirspaceCheck(flight)) continue
    selectedFlights.push(flight)
    if (selectedFlights.length === 6) break
  }
  return selectedFlights
}

function verifyInvalidAirspaceCheck (flight) {
  return flight.airspaceCheck === AirspaceCheckValues.INVALID
}

async function savePilotRank (pilotId, totalScore, rankedFlights, category, regionalLeague) {
  const dbClient = await XCCompDB.getClient()
  const flights = rankedFlights.map(fl => ({id: fl.flightId, score: fl.olcScore}))
  
  const categoryScoreField  = `${getPrefixLeague(regionalLeague)}_${category.toLowerCase()}`
  const categoryFlightsField  = `flights_${getPrefixLeague(regionalLeague)}_${category.toLowerCase()}`

  try {
    const sql = `
      INSERT INTO rankings(
        pilot_id,
        ${categoryScoreField},
        ${categoryFlightsField}
        )
      VALUES (${pilotId}, ${totalScore}, $$${JSON.stringify(flights)}$$)
      ON CONFLICT (pilot_id) DO UPDATE SET 
        ${categoryScoreField} = ${totalScore},
        ${categoryFlightsField} = $$${JSON.stringify(flights)}$$
    `
    await dbClient.query(sql)
  } catch (error) {
    throw error
  } finally {
    dbClient.release()
  }

}


function getPrefixLeague (regionalLeague) {
  return {
    [RegionalLeagues.CERRADO_MINEIRO]: 'cr',
    [RegionalLeagues.SUL_DE_MINAS]: 'sm',
    [RegionalLeagues.VALE_DO_RIO_DOCE]: 'rd',
    [RegionalLeagues.ZONA_DA_MATA]: 'zm'
  }[regionalLeague]
}
