import XCCompDB from "#libs/xccomp-db/index.js"


export async function getBrasilianCitiesWithoutIbgeCities () {
  let dbClient = null
  try {
    dbClient = await XCCompDB.getClient()
    const sql = 'SELECT id, name, state FROM cities c WHERE c.ibge_city_id IS NULL and c.state=$$Minas Gerais$$ AND c.country = $$Brasil$$ ORDER BY c.name ASC'
    const queryResult = await dbClient.query(sql)
    return queryResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      state: row.state,
    }))
  } catch (error) {
    throw error
  } finally  {
    dbClient && dbClient.release()
  }
} 
