import * as cheerio from 'cheerio'
import { logger } from "#logger"
import fs from 'fs'

export async function scrapePilots ({continueFromSyncFile} = {}) {
  logger.info(`Scraping de pilotos iniciado`)   
  const startTime = Date.now()   
  let totalScrapedItems = 0
  try {
    !continueFromSyncFile && clearSyncFile()  
    const lastSavedPage = getLastSavedPage()
    let currentPage = lastSavedPage ? lastSavedPage : 1
    
    logger.info(`Acessando página ${currentPage}`) 
    let $ = await fetchPage(currentPage)  
    
    while (!isEmptyPage($)) {
      logger.info(`Extraindo dados da página ${currentPage}`) 
      const scrapedData = scrapePage($) 
      
      logger.info(`Gravando dados extraidos da página ${currentPage}`)
      savePageOnSyncFile(scrapedData, currentPage)
      
      totalScrapedItems += scrapedData.length
      currentPage++
      logger.info(`Acessando página ${currentPage}`)
      $ = await fetchPage(currentPage) 
    }    
  } catch (error) {
    logger.warn(`Falha no Scraping de pilotos`) 
    return makeReport(startTime, totalScrapedItems, error)
  }
  logger.info(`Scraping de voos finalizado`) 
  return makeReport(startTime, totalScrapedItems)
}

function scrapePage ($) {
  const scrapedPage = $('.main_text table.listTable > tbody > tr:not(:first-child)').toArray().map($tr => {
    const cells = $($tr).children('td')
    const data =  {
      id: $(cells[1]).find('.pilotLink > a').attr('id'),
      name: $(cells[1]).find('.pilotLink > a').text(),
      femaleGender: $(cells[1]).find('.pilotLink > a > img.sprite-icon_female_small').length > 0,
      nationality: $(cells[1]).find('.pilotLink > a > img.fl').attr('title')
    }
    checkScrapedRecord(data, cells)
    return data
  })   
  return scrapedPage  
}

async function fetchPage(page) {
  const url = `https://www.xcbrasil.com.br/pilots/world/alltimes/&page_num=${page}`
  return await cheerio.fromURL(url) 
}

function checkScrapedRecord (record, source) {
  if (!record.id) throw new Error(`Dado "id" não encontrado no item extraido   |    ${JSON.stringify(record)}     |     ${source}`)
  // if (!record.name) throw new Error(`Dado "name" não encontrado no item extraido   |    ${JSON.stringify(record)}     |     ${source}`)
  if (typeof record.femaleGender !== 'boolean' ) throw new Error(`Dado "femaleGender" não encontrado no item extraido   |    ${JSON.stringify(record)}     |     ${source}`)
  if (!record.nationality) throw new Error(`Dado "nationality" não encontrado no item extraido   |    ${JSON.stringify(record)}     |     ${source}`)
}

function isEmptyPage ($) {
  const rows = $('.main_text table.listTable > tbody > tr:not(:first-child)').toArray()
  return rows.length === 0
}

function getLastSavedPage () {
  const data = loadDataFromSyncFile()
  const keys = Object.keys(data)
  if (keys.length === 0) {
    return 0
  }
  const numbers = keys.map(key => parseInt(key.split('_')[1]))
  return Math.max(...numbers)
}

function savePageOnSyncFile(data, page) { 
  const fileData = loadDataFromSyncFile()
  fileData[`page_${page}`] = data
  saveDataOnSyncFile(fileData)
}

function saveDataOnSyncFile(data = {}) {
  const path = process.env.SYNC_FILES_FOLDER
  const fileName = 'pilot-sync-scrape.json'
  const filePath = path + '/' + fileName
  fs.mkdirSync(path, { recursive: true })  
  fs.writeFileSync(filePath, JSON.stringify(data))
}

function loadDataFromSyncFile () {
  const path = process.env.SYNC_FILES_FOLDER
  const fileName = 'pilot-sync-scrape.json'
  const filePath = path + '/' + fileName
  fs.mkdirSync(path, { recursive: true })
  if (!fs.existsSync(filePath)) {
    saveDataOnSyncFile()
  }
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(fileContent)
  return data
}

function clearSyncFile () {
  saveDataOnSyncFile()
}

function makeReport (startTime, totalScrapedItems = 0, error = null) {
  const endTime = Date.now()
  const totalTime = (endTime - startTime) / 1000
  return {
    details: {
      startTime,
      endTime,
      totalTime,
      totalScrapedItems,
    },
    warnings: [],
    error
  }
}