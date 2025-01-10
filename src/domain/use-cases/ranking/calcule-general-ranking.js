import { logger } from "#logger"
import { GeneralRankingCategories } from "#domain/entities/general-ranking-categories.js"
import { getDistanceFromLatLonInKm } from "#libs/utils/geo-utils.js"
import XCCompDB from "#libs/xccomp-db/index.js"


export async function calculeGeneralRanking () {
  const categories = [ 
    GeneralRankingCategories.FUN,
    GeneralRankingCategories.SPORT, 
    GeneralRankingCategories.SERIAL, 
    GeneralRankingCategories.FEMALE, 
    GeneralRankingCategories.OPEN 
  ] 
  const pilots = await getPilotsWithoutPending()
  for (const category of categories) {
    logger.info(`Calculando RANKING GERAL --- ${category} `)
    const flights =  await getValidFlightsPerCategory(category) 
     for (const pilot of pilots) {
        if (!pilotIsValidOnCategory(pilot, category)) continue
        const flightsOfPilot = flights.filter(flight => flight.pilotId === pilot.id)
        const rankedFlights = selectValidFlights(flightsOfPilot)
        const totalScore = rankedFlights.reduce((acc, flight) => { return acc + flight.olcScore }, 0)
        await savePilotRank(pilot.id, totalScore, category, rankedFlights)
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


async function getValidFlightsPerCategory (category) {
  const dbClient = await XCCompDB.getClient()
  try {
    const sql = `
      SELECT 
        f.pilot_id AS "pilotId",
        f.id AS "flightId",
        f.olc_score AS "olcScore",
        f.air_space_check AS "airSpaceCheck",
        f.validity,
        t.latitude,
        t.longitude

        FROM flights f
        INNER JOIN pilots p ON f.pilot_id = p.xcbrasil_id
        INNER JOIN glider_models g ON f.glider_model_id = g.id
        INNER JOIN takeoffs t ON f.takeoff_id = t.id
        INNER JOIN cities c ON t.city_id = c.id
        -- INNER JOIN ibge_cities i ON c.ibge_city_id =  i.id

        WHERE
          c.state = 'Minas Gerais'
          AND ${{
            [GeneralRankingCategories.FUN]: 'g.certification < 30', 
            [GeneralRankingCategories.SPORT]: 'g.certification < 40', 
            [GeneralRankingCategories.SERIAL]: 'g.certification < 50', 
            [GeneralRankingCategories.OPEN]: 'g.certification < 100',
            [GeneralRankingCategories.FEMALE]: 'p.female = true'
          }[category]}

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


function pilotIsValidOnCategory (pilot, category) {
  if (category === GeneralRankingCategories.FUN && pilot.licenseLevel > 2) { return false }
  if (category === GeneralRankingCategories.FEMALE && !pilot.female) { return false }
  return true
}


function selectValidFlights (flightsOfPilot) {
  flightsOfPilot.sort((a,b) => b - a)
  const selectedFlights = []
  for (const flight of flightsOfPilot) {
    if (!flight.validity) continue
    // if (!flight.airSpaceCheck) continue
    if (verifyFlyProximitWithTwoFlights(flight, selectedFlights)) continue
    selectedFlights.push(flight)
    if (selectedFlights.length === 10) break
  }
  return selectedFlights
}

function verifyFlyProximitWithTwoFlights (flight, verificationList) {
  let count = 0
  verificationList.forEach(reference => {
    const distance = getDistanceFromLatLonInKm(reference.latitude, reference.longitude, flight.latitude, flight.longitude)
    if (distance > 3) count++ 
  })
  return count > 2
}


async function savePilotRank (pilotId, totalScore, category, rankedFlights) {
  const dbClient = await XCCompDB.getClient()
  const flights = rankedFlights.map(fl => ({id: fl.flightId, score: fl.olcScore}))
  const categoryScoreField  = 'general_' + category.toLowerCase()
  const categoryFlightsField  = 'flights_general_' + category.toLowerCase()

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
