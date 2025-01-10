import { sleep } from "#libs/utils/pormise-utils.js"
import XCCompDB from "#libs/xccomp-db/index.js"
import { logger } from "#logger"
import axios from "axios"
import { getPilotsWithoutXcbrasilId } from "./get-pilots.js"

               
export async function updateXcbrasilIds ()  {
  const result = {
    searches: null,
    updates: null
  }
  try {
    const pilotsWithoutXcbrId = await getPilotsWithoutXcbrasilId()
    result.searches = await searchForXcbrasilIds(pilotsWithoutXcbrId)
    result.updates = await updatePilotsWithTheXcbrasiIds(result.searches.successList)
    return result
  } catch (error) {
    result.error = error
    return result
  }
}


async function searchForXcbrasilIds (pilotsWithoutXcbrId) {
  const result = { 
    successList: [], // item = { cbvlId, xcbrasiId, name }
    errorList: [], // { error, item }
  }
  for (const pilot of pilotsWithoutXcbrId) {
    let cancelUpdate = false
    logger.info('Buscando ID XCBrasil do piloto: ' + JSON.stringify(pilot))
    let response = null
    try {
      await sleep(100) // TODO: ALTERAR PARA 1000
      const url = `https://sistema.cbvl.com.br/integracao/webservice/check-plt/${pilot.cbvlId}_0_0`
      response = await (await axios.get(url)).data
            
      if (!response.row.flg_check_xcbrasil) {
        throw new Error(`Não foi encontrda conta do XCBrasil vinculada ao piloto: ${JSON.stringify(pilot)}`)
      } 
    
    } catch (error) {
      result.errorList.push({
        error: error,
        item: pilot
        })
      logger.warn(`Falha na tentativa de buscar o id do XcBrasil do piloto: ${JSON.stringify(pilot)}`)
      logger.error(error)
      cancelUpdate = true
    }
    if (cancelUpdate) continue
    
    try {
      const xcbrasilId = Number(response.row.ds_check_xcbrasil.split('_').pop()) 
      result.successList.push({ xcbrasilId, ...pilot })
    } catch (error) {
      result.errorList.push({
        error: error,
        item: pilot
        })
      logger.warn(`Falha na tentativa de parsse do id do XcBrasil do piloto ${pilot.cbvlId}. Resposta XCBrasil: ${JSON.stringify(response)}`)
      logger.error(error)
    }
   
  }
  return result
}

async function updatePilotsWithTheXcbrasiIds (successfulSearches) {
  const result = { 
    successList: [], // item = { cbvlId, xcbrasiId, name }
    errorList: [], // { error, item }

  }
  const dbClient  = await XCCompDB.getClient()  
 
  for (const search of successfulSearches) {
    try {
      const sql = `
        UPDATE pilots
        SET 
          xcbrasil_id = ${search.xcbrasilId},
          updated_at = NOW()
        WHERE cbvl_id = ${search.cbvlId}
      `
      await dbClient.query(sql)
      result.successList.push(search)
    } catch (error) {
      result.errorList.push({ error, item: search})
      logger.warn(`Falha na tentativa de gravar o id do XcBrasil no regiatro do piloto no banco de dados xccomp:  ${JSON.stringify(search)}`)
      logger.error(error)
    }  
  }
  dbClient && dbClient.release()
  return result
}
