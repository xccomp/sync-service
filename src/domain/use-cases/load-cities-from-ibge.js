import XCCompDB from "#libs/xccomp-db/index.js"
import axios from "axios"

export async function loadCitiesFromIbge ()  {
  const citiesData = await getCitiesFromIbgeApi()
  await saveCities(citiesData)
  return true
}

async function getCitiesFromIbgeApi () {
  const url = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/MG/municipios'
  const cities = await (await axios.get(url)).data
  return cities.map(city => ({
    id: city.id,
    name: city.nome,
    microregion: city.microrregiao.nome,
    mesoregion: city.microrregiao.mesorregiao.nome,
    uf: city.microrregiao.mesorregiao.UF.nome,
    region: city.microrregiao.mesorregiao.UF.regiao.nome
  }))
}

async function saveCities (citiesData) {
  let dbClient = null
  try {
    dbClient = await XCCompDB.getClient()  
    const sql = `
      INSERT INTO
        ibge_cities(id, name, microregion, mesoregion, uf, region)
      VALUES  
        ${citiesData.map(city => `(
          ${city.id},
          $$${city.name}$$,
          $$${city.microregion}$$,
          $$${city.mesoregion}$$,
          $$${city.uf}$$,
          $$${city.region}$$)
        `).join(',')}
    `
    await dbClient.query(sql)  
  } catch (error) {
    throw error
  } finally {
    dbClient && dbClient.release()
  }
}

