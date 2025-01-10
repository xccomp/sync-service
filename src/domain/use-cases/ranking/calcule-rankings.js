import { calculeGeneralRanking } from "./calcule-general-ranking.js"
import { calculeRegionalRankings } from "./calcule-regional-rankings.js"

export async function calculeRankings () {
  await calculeGeneralRanking()
  await calculeRegionalRankings()
}