import * as cheerio from 'cheerio'
import XCCompDB from '#libs/xccomp-db/index.js'
import { updateCitiesOfTakeoffs } from '#domain/use-cases/update-cities-of-takeoffs.js'
import { updateIbgeCitiesOfCities } from '#domain/use-cases/update-ibge-cities-of-cities.js'


export async function syncTakeoffById (id) {
  const scraped = await scrape(id)
  const transformed = transform(scraped)
  await load(transformed)
  await postProcess()
}


async function scrape (id) {
  const url = `http://www.xcbrasil.com.br/takeoff/${id}`
  const $ = await cheerio.fromURL(url) 
  const elementName = $('div.main_text > div > div > div > div:first-child').toArray()[0]
  const elementCoordinates = $('div.main_text table.Box tr.col3_in:last-of-type > td:first-child a').toArray()[0]
  return {
    id,
    name: $(elementName).text(),
    coordinates: $(elementCoordinates).attr('href')
  } 
}


function transform (scrapedData) {
  const name = scrapedData.name.split('Waypoint : ')[1].split('(')[0].replaceAll(/\u00a0/g, " ").trim()
  const latitude = scrapedData.coordinates.split('&').reverse()[1].replaceAll('latitude=', '')
  const longitude = scrapedData.coordinates.split('&').reverse()[0].replaceAll('longitude=', '')
  return {
    id: scrapedData.id,
    name,
    latitude: Number(latitude),
    longitude: Number(longitude)
  }
}

async function load (data) {
  const dbClient = await XCCompDB.getClient()
  try {
    const sql = `
      INSERT INTO public.takeoffs(
        id, name, latitude, longitude)
      VALUES (${data.id}, $$${data.name}$$, ${data.latitude}, ${data.longitude})
      ON CONFLICT DO NOTHING
    `
    dbClient.query(sql)
  } catch (error) {
    
  } finally {
    dbClient.release()
  }
}


async function postProcess () {
  await updateCitiesOfTakeoffs()
  await updateIbgeCitiesOfCities()
}