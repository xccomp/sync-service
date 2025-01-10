import { RegionalLeagues } from "#domain/entities/regional-leagues.js"
import XCCompDB from "#libs/xccomp-db/index.js"

export async function getPodiumGeneralRanking (category) {
  const dbClient = await XCCompDB.getClient()
  try {
    const sql = `
      SELECT
        r.pilot_id AS id,
        p.name,	
        r.general_${category.toLowerCase()} AS "score" 
      FROM rankings r 
      INNER JOIN pilots p ON r.pilot_id = p.xcbrasil_id
      ORDER BY r.general_${category.toLowerCase()} DESC
      LIMIT 3
    `
    const result = await dbClient.query(sql)
    return result.rows
  } catch (error) {
    throw error

  } finally {
    dbClient.release()
  }

}


export async function getPodiumRegionalLeague (regionalLeage) {
  const prefixLeage = getPrefixLeague(regionalLeage)
  const dbClient = await XCCompDB.getClient()
  try {
    const sql = `
      (SELECT
          r.pilot_id AS id,
          p.name,	
        r.${prefixLeage}_open AS "score" 
      FROM rankings r 
      INNER JOIN pilots p ON r.pilot_id = p.xcbrasil_id
      ORDER BY r.${prefixLeage}_open DESC
      LIMIT 1)

      UNION ALL

      (SELECT
          r.pilot_id AS id,
          p.name,	
        r.${prefixLeage}_serial AS "score" 
      FROM rankings r 
      INNER JOIN pilots p ON r.pilot_id = p.xcbrasil_id
      ORDER BY r.${prefixLeage}_serial DESC
      LIMIT 1)

      UNION ALL

      (SELECT
          r.pilot_id AS id,
          p.name,	
        r.${prefixLeage}_sport AS "score" 
      FROM rankings r 
      INNER JOIN pilots p ON r.pilot_id = p.xcbrasil_id
      ORDER BY r.${prefixLeage}_sport DESC
      LIMIT 1)

      UNION ALL

      (SELECT
          r.pilot_id AS id,
          p.name,	
        r.${prefixLeage}_fun AS "score" 
      FROM rankings r 
      INNER JOIN pilots p ON r.pilot_id = p.xcbrasil_id
      WHERE p.license_level < 3
      ORDER BY r.${prefixLeage}_fun DESC
      LIMIT 1)
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