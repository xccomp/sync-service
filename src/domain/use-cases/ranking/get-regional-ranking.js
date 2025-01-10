import { RegionalLeagues } from "#domain/entities/regional-leagues.js"
import XCCompDB from "#libs/xccomp-db/index.js"


export async function getRegionalRankings (regionalLeage) {
  const rawRankings = await getRankingsFromDB(regionalLeage)
  const rankings = {
    open: [],
    serial: [],
    sport: [],
    fun: []
  }
  for (const record of rawRankings) {
    const pilot = {
      id: record.id,
      name: record.name
    }

    rankings.open.push({
      pilot,
      scores: {
        total: record.openScore,
        flights: JSON.parse(record.openFlights)
      }
    })

    rankings.serial.push({
      pilot,
      scores: {
        total: record.serialScore,
        flights: JSON.parse(record.serialFlights)
      }
    })

    rankings.sport.push({
      pilot,
      scores: {
        total: record.sportScore,
        flights: JSON.parse(record.sportFlights)
      }
    })
    
    if (record.licenseLevel < 3) { 
      rankings.fun.push({
        pilot,
        scores: {
          total: record.funScore,
          flights: JSON.parse(record.funFlights)
        }
      })
    }
  }
  
  sortRankings(rankings)
  return rankings
}


async function getRankingsFromDB (regionalLeage) {
  const dbClient = await XCCompDB.getClient()
  try {
    const prefixLeague = getPrefixLeague(regionalLeage) 
    const sql = `
      SELECT 
        r.pilot_id AS id,
        p.name,
        p.license_level AS "licenseLevel",
        r.${prefixLeague}_open AS "openScore",
        r.flights_${prefixLeague}_open AS "openFlights",
        r.${prefixLeague}_serial AS "serialScore",
        r.flights_${prefixLeague}_serial AS "serialFlights",
        r.${prefixLeague}_sport AS "sportScore",
        r.flights_${prefixLeague}_sport AS "sportFlights",
        r.${prefixLeague}_fun AS "funScore",
        r.flights_${prefixLeague}_fun AS "funFlights"
      FROM rankings r 
      INNER JOIN pilots p ON r.pilot_id = p.xcbrasil_id
  `
    const result = await dbClient.query(sql)
    return result.rows
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

function sortRankings (rankings) {
  rankings.open.sort((a, b) => b.scores.total - a.scores.total)
  rankings.serial.sort((a, b) => b.scores.total - a.scores.total)
  rankings.sport.sort((a, b) => b.scores.total - a.scores.total)
  rankings.fun.sort((a, b) => b.scores.total - a.scores.total)
}
