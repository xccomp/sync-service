import XCCompDB from "#libs/xccomp-db/index.js"


export async function createGliderNameMapping (mappingList) {
  if (!mappingList || !mappingList.length) return 

  const dbClient = await XCCompDB.getClient()
  try {
    const values = mappingList
      .map( item => `(${item.gliderModelId}, $$${item.gliderName}$$)`)
      .join(',')
    const sql = `
      INSERT INTO glider_name_mappings
        (glider_model_id, name)
      VALUES ${values}
    `
    await dbClient.query(sql)
    return true
  } catch (error) {
    throw error

  } finally {
    dbClient.release()
  }
}