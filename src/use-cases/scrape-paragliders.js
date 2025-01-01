import { logger } from "#logger"
import axios from 'axios'
import * as cheerio from 'cheerio'
import { NotFoundError, XCBrasilRequestError } from "./errors/index.js"

export async function scrapeParagliderBrands () {
  logger.info('Starting paraglider brands scraping procces...')

  const url = 'http://www.xcbrasil.com.br/GUI_EXT_add_glider.php'
  let htmlPage = null
  try {
    htmlPage = await (await axios.get(url)).data 
  } catch (error) {
    throw new XCBrasilRequestError('Request /GUI_EXT_add_glider.php to XCBrasil failed', error)
  }

  const $ = cheerio.load(htmlPage)
  const data = $.extract({
    brands: [
      {
        selector: '#gliderBrandID > option',
        value: (el, key) => ({
          id: $(el).attr('value'),
          name: $(el).text()
        }),
      }
    ]
  })

  logger.info('Paraglider brands scrape procces completed')
  return data.brands
}

export async function scrapeParagliderModels (brandId = null) {
  logger.info('Starting paraglider models scraping procces...')

  const brands = await scrapeParagliderBrands()
  if (brandId && !brands.some(el => el.id === brandId )) {
    throw new NotFoundError(`Brand ID ${brandId} not found`)
  }
  
  const data = []
  const brandIdList = brandId ? [brandId] : brands.map(el => el.id)
  for (let index = 0; index < brandIdList.length; index++) {
    const id = brandIdList[index]
    
    logger.info(`Getting XCBrasil data of brand ID ${id}...`)
    const url = `http://www.xcbrasil.com.br/AJAX_gliders.php?op=gliders_list&brandID=${id}`
    let models = null   
    try {
      models = await (await axios.get(url)).data.Records
    } catch (error) {
      logger.error(error)
      throw new XCBrasilRequestError(`Request /AJAX_gliders.php?op=gliders_list&brandID=${id} to XCBrasil failed`, error)
    }
  
    if (!Array.isArray(models)) {
      throw new NotFoundError(`Models of brand ID ${id} not found`)
    }

    data.push(...models)
  }

  logger.info('Paraglider models scrape procces completed')
  return data
}

export async function scrapeParagliders () {
  logger.info('Starting paraglider scraping procces...')

  const data = {
    brands: await scrapeParagliderBrands(),
    models: await scrapeParagliderModels()
  }

  logger.info('Paraglider models scrape procces completed')
  return data
}






