import XCCompDB from "#libs/xccomp-db/index.js"


export async function getPilotsWithoutXcbrId () {
  let dbClient = null
  try {
    dbClient = await XCCompDB.getClient()
    const sql = 'SELECT id, cbvl_id, name FROM pilots p WHERE p.xcbrasil_id is null ORDER BY p.name ASC'
    const queryResult = await dbClient.query(sql)
    return queryResult.rows.map(row => ({ 
      id: row.id,
      cbvlId: row.cbvl_id,
      name: row.name,
    }))
  } catch (error) {
    throw error
  } finally  {
    dbClient && dbClient.release()
  }
} 
