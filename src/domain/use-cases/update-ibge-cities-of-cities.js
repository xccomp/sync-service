import { sleep } from "#libs/utils/pormise-utils.js"
import XCCompDB from "#libs/xccomp-db/index.js"
import { logger } from "#logger"
import { getBrasilianCitiesWithoutIbgeCities } from "./get-cities.js"


export async function updateIbgeCitiesOfCities ()  {
  const result = {
    searches: { successList: [], errorList: [] },
    updates:  { successList: [], errorList: [] }
  }
  try {
    const citeiesWithoutIbgeCities = await getBrasilianCitiesWithoutIbgeCities()
    result.searches = await findRelationshipBetweenCitiesAndIbgeCities(citeiesWithoutIbgeCities) 
    result.updates = await updateCitiesRelationship(result.searches.successList)
    return result
  } catch (error) {
    result.error = error
    return result
  }
}


async function findRelationshipBetweenCitiesAndIbgeCities (cities) {
  const result = { 
    successList: [], // item = { id, name, state, countri, ibgeCity: { id, name, state } }
    errorList: [], // { error, item }
  }
  let dbClient = null
  for (const city of cities) {
    try {
      dbClient  = !dbClient ? await XCCompDB.getClient() : dbClient  
      logger.info('Buscando possível relacionamento "cidade X cidade_ibge": ' + JSON.stringify(city))
      let ibgeCity = await findIbgeCityByNames (city, dbClient)
      ibgeCity = ibgeCity ? ibgeCity : await findIbgeCityDirectByException(city, dbClient) 
      if (!ibgeCity) {
        throw new Error(`Não foi encontrado nenhuma "cidade ibge" correspondenete à cidade  ${JSON.stringify(city)}`)
      }
      result.successList.push({ ...city, ibgeCity })
    } catch (error) {
      result.errorList.push({
        error: error,
        item: city
        })
      logger.warn(`Falha na tentativa de buscar "cidade ibge" correspondenete à cidade ${JSON.stringify(city)}`)
      logger.error(error)
      
    } 
  }
  dbClient?.release()
  return result
}


async function updateCitiesRelationship (cities) {
  const result = { 
    successList: [], // item = { id, latitude, longitude, city: { name, state: country} }
    errorList: [], // { error, item }
  }
  const dbClient  = await XCCompDB.getClient()  
 
  for (const city of cities) {
    try {
      const updateSql = `
        UPDATE cities
        SET 
          ibge_city_id = ${city.ibgeCity.id},
          updated_at = NOW()
        WHERE id = ${city.id}
      `
      await dbClient.query(updateSql)
     
      result.successList.push(city)
    } catch (error) {
      result.errorList.push({ error, item: city})
      logger.warn(`Falha na tentativa adicionar o vinculo da cidade com a "cidade ibge":  ${JSON.stringify(city)}`)
      logger.error(error)
    }  
  }
  dbClient && dbClient.release()
  return result
}


async function findIbgeCityByNames(city, dbClient) {
  const sql = `
    SELECT c.id, c.name, c.state 
    FROM ibge_cities c
    WHERE c.name=$$${city.name}$$ and c.state=$$${city.state}$$ 
  `
  const queryResult = await dbClient.query(sql)
  const record = queryResult.rows?.length ? queryResult.rows[0] : null 
  return record
}

async function findIbgeCityDirectByException(city, dbClient) {
  const sql = `
    SELECT c.id, c.name, c.state
    FROM city_exception_mappings m
    INNER JOIN ibge_cities c ON m.ibge_city_id = c.id
    WHERE m.city_name=$$${city.name}$$ AND m.state_name=$$${city.state}$$
  `
  const queryResult = await dbClient.query(sql)
  const record = queryResult.rows?.length ? queryResult.rows[0] : null 
  return record
}