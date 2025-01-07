import XCCompDB from "#libs/xccomp-db/index.js"


export async function getTakeoffsWithoutCities () {
  let dbClient = null
  try {
    dbClient = await XCCompDB.getClient()
    const sql = 'SELECT t.id, t.name, t.latitude, t.longitude FROM takeoffs t WHERE t.city_id is null ORDER BY t.name ASC'
    const queryResult = await dbClient.query(sql)
    return queryResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude
    }))
  } catch (error) {
    throw error
  } finally  {
    dbClient && dbClient.release()
  }
} 
