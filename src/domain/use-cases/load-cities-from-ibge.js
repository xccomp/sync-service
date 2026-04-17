import XCCompDB from "#libs/xccomp-db/index.js"
import axios from "axios"

export async function loadCitiesFromIbge (uf)  {
  const citiesData = await getCitiesFromIbgeApi(uf)
  await saveCities(citiesData)
  return true
}

async function getCitiesFromIbgeApi (uf) {
  const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
  const cities = await (await axios.get(url)).data
  return cities.map(city => ({
    id: city.id,
    name: city.nome,
    microregion: city.microrregiao.nome,
    mesoregion: city.microrregiao.mesorregiao.nome,
    state: city.microrregiao.mesorregiao.UF.nome,
    region: city.microrregiao.mesorregiao.UF.regiao.nome,
    country: 'Brasil'
  }))
}

async function saveCities (citiesData) {
  let dbClient = null
  try {
    const values = {
      ids: [],
      names: [],
      microregions: [],
      mesoregions: [],
      states: [],
      regions: [],
      countries: []
    }
    citiesData.forEach(city => {
      values.ids.push(city.id)
      values.names.push(city.name)
      values.microregions.push(city.microregion)
      values.mesoregions.push(city.mesoregion)
      values.states.push(city.state)
      values.regions.push(city.region)
      values.countries.push(city.country)
    })
    const sql = `
      INSERT INTO ibge_cities (id, name, microregion, mesoregion, state, region, country)
      SELECT * FROM UNNEST(
        $1::int[], 
        $2::text[], 
        $3::text[], 
        $4::text[], 
        $5::text[], 
        $6::text[], 
        $7::text[]
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        microregion = EXCLUDED.microregion,
        mesoregion = EXCLUDED.mesoregion,
        state = EXCLUDED.state,
        region = EXCLUDED.region,
        country = EXCLUDED.country,
        updated_at = NOW()
      ;
    `
    dbClient = await XCCompDB.getClient()  
    await dbClient.query(sql, Object.values(values))  
  } catch (error) {
    throw error
  } finally {
    dbClient && dbClient.release()
  }
}

