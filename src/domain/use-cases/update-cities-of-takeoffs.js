import { sleep } from "#libs/utils/pormise-utils.js"
import XCCompDB from "#libs/xccomp-db/index.js"
import { logger } from "#logger"
import axios from "axios"
import { getTakeoffsWithoutCities} from "./get-takeoffs.js"
import { isNumeric, stringTemplate } from "#libs/utils/string-utils.js"


export async function updateCitiesOfTakeoffs ()  {
  const result = {
    searches: { successList: [], errorList: [] },
    updates:  { successList: [], errorList: [] }
  }
  try {
    // WARNING: The step-by-step process is necessary to avoid losing large amounts of data
    // obtained from calls to the Google Geocoding API if an error occurs during the process,
    // as these calls can generate financial costs. The step-by-step process can be understood
    // as a checkpoint strategy.
    const takeoffsWithoutCities = await getTakeoffsWithoutCities()
    const takeoffsPerStep = Number(process.env.LOADING_CITIES_OF_TAKEOFF_STEP_SIZE)
    const steps = getNumberOfSteps(takeoffsWithoutCities.length, takeoffsPerStep)
    for (let step = 1; step <= steps; step++) {
      const initTime = Date.now()
      const takeoffsOfStep = getTekeoffsOfStep(takeoffsWithoutCities, step ,takeoffsPerStep)
      
      const citiesFromGoogleAPI = await getCitiesFromGoogleAPI(takeoffsOfStep)
      result.searches.successList.push(...citiesFromGoogleAPI.successList)  
      result.searches.errorList.push(...citiesFromGoogleAPI.errorList)    
      
      const updatedTakeoffs = await updateTakeoffsWithTheCities(citiesFromGoogleAPI.successList)
      result.updates.successList.push(...updatedTakeoffs.successList)  
      result.updates.errorList.push(...updatedTakeoffs.errorList)   

      const stapeDuration = (Date.now() - initTime)/1000  
      logger.warn(`ETAPA ${step} / ${steps} ---- DURAÇÃO: ${stapeDuration}`)   
    }
    return result
  } catch (error) {
    result.error = error
    return result
  }
}

function getNumberOfSteps (numberOfTakeoffs, takeoffsPerStep) {
  return Math.ceil(numberOfTakeoffs / takeoffsPerStep)
}

function getTekeoffsOfStep(listOftakeoffs, step, takeoffsPerStep) {
  const firstIndex = step * takeoffsPerStep - takeoffsPerStep
  const lasIndex = firstIndex + takeoffsPerStep
  return listOftakeoffs.slice(firstIndex, lasIndex)

}

async function getCitiesFromGoogleAPI (takeofs) {
  const result = { 
    successList: [], // item = { id, latitude, longitude, city: { name, state: country} }
    errorList: [], // { error, item }
  }
  for (const takeoff of takeofs) {

    let cancelUpdate = false 
    logger.info('Buscando cidade de rampa: ' + JSON.stringify(takeoff))
    let response = null
    try {
      await sleep(100)
      
      const url = stringTemplate('https://maps.googleapis.com/maps/api/geocode/json?language=${language}&key=${key}&latlng=${latlng}',{
        language: 'pt-BR',
        key: process.env.GOOGLE_GEOCODING_API_KEY,
        latlng: takeoff.latitude+','+takeoff.longitude
      })
 
      response = await (await axios.get(url)).data
            
      if (!response.results.length) {
        throw new Error(`A Google Geocoding API não retornou nenhum resultado para as coordenada da rampa ${JSON.stringify(takeoff)}`)
      } 
    
    } catch (error) {
      result.errorList.push({
        error: error,
        item: takeoff
        })
      logger.warn(`Falha na tentativa de buscar cidade da rampa ${JSON.stringify(takeoff)}`)
      logger.error(error)
      cancelUpdate = true
    }
    if (cancelUpdate) continue
    
    try {
      const geocodingData = response.results[0].address_components
      const city = {
        country: geocodingData.find(d => d.types.includes('country'))?.long_name,
        state: geocodingData.find(d => d.types.includes('administrative_area_level_1'))?.long_name,
        name: geocodingData.find(d => d.types.includes('locality'))?.long_name
          || geocodingData.find(d => d.types.includes('administrative_area_level_3'))?.long_name
          || geocodingData.find(d => d.types.includes('administrative_area_level_2'))?.long_name
      }
      result.successList.push({ ...takeoff, city })
    } catch (error) {
      result.errorList.push({
        error: error,
        item: takeoff
        })
      logger.warn(`Falha na tentativa de extrair od dados da cidade do resultado da Google Geocoding API para rampa ${takeoff.id}. Resposta Google Geocoding API: ${JSON.stringify(response)}`)
      logger.error(error)
    }
  }
  return result
}

async function updateTakeoffsWithTheCities (successfulSearches) {
  const result = { 
    successList: [], // item = { id, latitude, longitude, city: { name, state: country} }
    errorList: [], // { error, item }
  }
  const dbClient  = await XCCompDB.getClient()  
 
  for (const takeoff of successfulSearches) {
    try {
      logger.info('Gravando cidade de rampa: ' + JSON.stringify(takeoff))
      const insertSql = stringTemplate(`
        WITH res as (
          INSERT INTO cities (name, state, country) 
          VALUES ($$$[name]$$, $$$[state]$$, $$$[country]$$)
            ON CONFLICT(name, state, country) DO NOTHING
            RETURNING id
        )
        SELECT id FROM res
        UNION ALL
        SELECT id FROM cities c WHERE c.name=$$$[name]$$ and c.state=$$$[state]$$ and c.country=$$$[country]$$
        LIMIT 1
      `,
      takeoff.city,
      true
      ) 
      const dbReturn = await dbClient.query(insertSql)
      
      if (!dbReturn.rows.length) throw new Error('O banco de dados não retornou nenhum resultado para a instrução: ' + insertSql)
      if (!isNumeric(dbReturn.rows[0].id) || dbReturn.rows[0].id < 1) throw new Error('O banco de dados retornou um código de cidade inválido para inserir na Rampa : ' + insertSql)
      
      takeoff.city.id = dbReturn.rows[0].id
      const updateSql = `
        UPDATE takeoffs
        SET 
          city_id = ${takeoff.city.id},
          updated_at = NOW()
        WHERE id = ${takeoff.id}
      `
      await dbClient.query(updateSql)
      
      result.successList.push(takeoff)
    } catch (error) {
      result.errorList.push({ error, item: takeoff})
      logger.warn(`Falha na tentativa de gravar a cidade e vincular a decolagem a ela:  ${JSON.stringify(takeoff)}`)
      logger.error(error)
    }  
  }
  dbClient && dbClient.release()
  return result
}
