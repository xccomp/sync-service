import { logger } from "#logger"
import { getUnknownGliders } from '#domain/use-cases/gliders/get-unknown-gliders.js'
import { createGliderNameMapping } from "#domain/use-cases/gliders/create-glider-name-mapping.js"
import { isNumeric } from "#libs/utils/string-utils.js"
import { relateFlightsToGliders } from "#domain/use-cases/gliders/relate-flights-to-gliders.js"

export default class TakeoffController {

  static async mapGlider (req, res) {
    try {   
      const mappingList = req.body
      if (!mappingList || !Array.isArray(mappingList))  res.status(400).send('Parâmetro inválido. Use [{gliderModelId, gliderName}...n]')
      // TODO: validar itens do parâmetro

      await createGliderNameMapping(mappingList)  
      const updatedFlights = await relateFlightsToGliders()
      res.send({ updatedFlights })
    } catch (error) {
      logger.error(error)
      res.status(500).send(error.message)
    }
  } 

  static async getUnknownGliders (req, res) {
    try {    
      const onlyInCompetion = req.query.only_in_competition || false    
      res.send(await getUnknownGliders(onlyInCompetion))
    } catch (error) {
      logger.error(error)
      res.status(500).send(error.message)
    }
  } 

  static async getGliders (req, res) {
    try {     
      res.send(true)
    } catch (error) {
      logger.error(error)
      res.status(500).send(error.message)
    }
  } 


}


