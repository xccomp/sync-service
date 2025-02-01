import { logger } from '#logger'
import { scrapeFlights } from '#domain/sync-processors/flights/scrape-flights.js'
import { transformFlights } from '#domain/sync-processors/flights/transform-flights.js'
import { loadFlights } from '#domain/sync-processors/flights/load-flights.js'
import { postProcessFlights } from '#domain/sync-processors/flights/post-process-flights.js'
import { parseServerDateParameter } from '#libs/utils/date-utils.js'

export default class TakeoffController {

  static async syncScrape (req, res) {
    try {   
      const startDate = parseServerDateParameter(req.body.startDate)
      const endDate = parseServerDateParameter(req.body.endDate)
      const continueFromSyncFile = req.body.continueFromSyncFile
      const overrideOnlyDateOnSyncFile = req.body.overrideOnlyDateOnSyncFile
      if (continueFromSyncFile && overrideOnlyDateOnSyncFile) {
        throw new Error('Parâmetros "continueFromSyncFile" e "overrideOnlyDateOnSyncFile" não podem ser "true" ao mesmo tempo')
      }
      const scrapeReport = await scrapeFlights({startDate, endDate, continueFromSyncFile})
      if (scrapeReport.error) scrapeReport.error = parseError(scrapeReport.error)
      res.send(scrapeReport)
    } catch (error) {
      logger.error(error)
      res.status(500).send(error.message)
    }
  } 
  
  
  static async syncTransform (req, res) {
    try {     
      const transformReport = transformFlights()
      if (transformReport.error) transformReport.error = parseError(transformReport.error)
      res.send(transformReport)
    } catch (error) {
      logger.error(error)
      res.status(500).send(error.message)
    }
  } 


  static async syncLoad (req, res) {
    try {     
      const loadReport = await loadFlights()
      if (loadReport.error) loadReport.error = parseError(loadReport.error)
      res.send(loadReport)
    } catch (error) {
      logger.error(error)
      res.status(500).send(error.message)
    }
  } 

  static async syncPostProcess (req, res) {
    try {     
      const postProcessReport = await postProcessFlights()
      if (postProcessReport.error) postProcessReport.error = parseError(postProcessReport.error)
      res.send(postProcessReport)
    } catch (error) {
      logger.error(error)
      res.status(500).send(error.message)
    }
  } 


}

function parseError (error) { 
  return {
    name: error.name,
    message: error.message,
    stack: error.stack  
  }
}
