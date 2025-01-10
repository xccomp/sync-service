import { logger } from "#logger"
import { calculeRankings } from '#domain/use-cases/ranking/calcule-rankings.js'
import { getGeneralRankings } from "#domain/use-cases/ranking/get-general-ranking.js"
import { getRegionalRankings } from "#domain/use-cases/ranking/get-regional-ranking.js"
import { RegionalLeagues } from "#domain/entities/regional-leagues.js"
import { getPodiumGeneralRanking, getPodiumRegionalLeague } from "#domain/use-cases/ranking/get-podium.js"

export default class RankingController {

  static async getPodium (req, res) { 
    try {
      const ranking = req.params.ranking

      if (ranking === 'general') 
        return res.send(await getPodiumGeneralRanking())
      const league = convertParamLeague(ranking)

      if (!league) return res.status(400).send()
      return res.send(await getPodiumRegionalLeague(league))
    } catch (error) {
      logger.error(error)
      return res.status(500).send(error)
    } 
  }


  static async getRanking (req, res) {
    try {
      const ranking = req.params.ranking

      if (ranking === 'general') 
        return res.send(await getGeneralRankings())
      const league = convertParamLeague(ranking)

      if (!league) return res.status(400).send()
      return res.send(await getRegionalRankings(league))
    } catch (error) {
      logger.error(error)
      return res.status(500).send(error)
    }    
  }

  static async calculeRankings (req, res) {
    try {    
      await calculeRankings()
      res.send()
    } catch (error) {     
      
    }
  }


   
}

function convertParamLeague (ranking) {
  return {
    cerradomineiro: RegionalLeagues.CERRADO_MINEIRO,
    suldeminas: RegionalLeagues.SUL_DE_MINAS,
    valedoriodoce: RegionalLeagues.VALE_DO_RIO_DOCE,
    zonadamata: RegionalLeagues.ZONA_DA_MATA
  }[ranking]
}