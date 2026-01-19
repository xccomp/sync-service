import XCCompDB from "#libs/xccomp-db/index.js"



export async function registerTakeoffsInCompetitions(takeoffs = []) {
  
  
}



const getActiveCompetitions () {
  let dbClient = null
  try {
    dbClient = await XCCompDB.getClient()
    const sql = `
      SELECT 
        id,
        name,
      FROM competitions c WHERE c.is_active = TRUE
    `
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