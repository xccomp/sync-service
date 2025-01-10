import XCCompDB from "#libs/xccomp-db/index.js"

export async function getUnknownGliders (onlyInCompetion) {
  const dbClient = await XCCompDB.getClient()
  try {
    const sql = `
      SELECT DISTINCT f.glider_xcbrasil AS name
      FROM flights f
      WHERE 
        NOT EXISTS (
          SELECT id FROM glider_name_mappings g WHERE g.name = f.glider_xcbrasil 
        )
      ${onlyInCompetion ? 'AND f.pilot_id IS NOT NULL ' : ''} 
    `
    
    const result = await dbClient.query(sql)
    return result.rows.map(el => el.name)
  } catch (error) {
    throw error

  } finally {
    dbClient.release()
  }
}
