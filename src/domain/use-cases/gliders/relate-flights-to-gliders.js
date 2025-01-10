import XCCompDB from "#libs/xccomp-db/index.js"

export async function relateFlightsToGliders () {
  const dbClient = await XCCompDB.getClient()
  try {
    const updateSql = `
    -- Preenche o campo "glider_model_id" na tabela "flights" usando a tabela de
    -- mapeamento de nomes gliders "glider_name_mappings"
    UPDATE flights
    SET glider_model_id = subquery.glider_model_id
    FROM (
      SELECT  sm.glider_model_id, sm.name
      FROM flights sf
      INNER JOIN glider_name_mappings sm ON sf.glider_xcbrasil = sm.name
    ) AS subquery
    WHERE flights.glider_model_id IS NULL 
      AND flights.glider_xcbrasil = subquery.name
    RETURNING flights.id
    `
    const resultUpdate = await dbClient.query(updateSql)
    return resultUpdate.rows.map(el => el.id)
  } catch (error) {
    throw error

  } finally {
    dbClient.release()
  }
}