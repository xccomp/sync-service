import XCCompDB from "#libs/xccomp-db/index.js"


export async function getGeneralRankings () {
  const rawRankings = await getRankingsFromDB()
  const rankings = {
    open: [],
    female: [],
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

    if (record.female) { 
      rankings.female.push({
        pilot,
        scores: {
          total: record.femaleScore,
          flights: JSON.parse(record.femaleFlights)
        }
      })
    }

  }
  
  sortRankings(rankings)
 
  return rankings
}




async function getRankingsFromDB () {
  const dbClient = await XCCompDB.getClient()
  try {
    const sql = `
      SELECT 
        r.pilot_id AS id,
        p.name,
        p.female,
        p.license_level AS "licenseLevel",
        r.general_open AS "openScore",
        r.flights_general_open AS "openFlights",
        r.general_female AS "femaleScore",
        r.flights_general_female AS "femaleFlights",
        r.general_serial AS "serialScore",
        r.flights_general_serial AS "serialFlights",
        r.general_sport AS "sportScore",
        r.flights_general_sport AS "sportFlights",
        r.general_fun AS "funScore",
        r.flights_general_fun AS "funFlights"
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

function sortRankings (rankings) {
  rankings.open.sort((a, b) => b.scores.total - a.scores.total)
  rankings.female.sort((a, b) => b.scores.total - a.scores.total)
  rankings.serial.sort((a, b) => b.scores.total - a.scores.total)
  rankings.sport.sort((a, b) => b.scores.total - a.scores.total)
  rankings.fun.sort((a, b) => b.scores.total - a.scores.total)
}


