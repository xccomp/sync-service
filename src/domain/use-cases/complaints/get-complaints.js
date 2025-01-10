import XCCompDB from "#libs/xccomp-db/index.js"


export async function getComplaints (status = []) {
  const dbClient = await XCCompDB.getClient()
  try {
    const sql = `
      SELECT *
      FROM complaints
      WHERE 
        status in (${status.join(',')})
    `
    const result = await dbClient.query(sql)
    return result.rows
  } catch (error) {
    throw error

  } finally {
    dbClient.release()
  }
}


export async function getComplaintsById (id) {
  const dbClient = await XCCompDB.getClient()
  try {
    const sql = `
      SELECT *
      FROM complaints
      WHERE 
        id = ${id}
    `
    const result = await dbClient.query(sql)
    return result.rows.length ? result.rows[0] : null
  } catch (error) {
    throw error

  } finally {
    dbClient.release()
  }
}
