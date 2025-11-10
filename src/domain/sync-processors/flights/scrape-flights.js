import * as cheerio from 'cheerio'
import { logger } from "#logger"
import fs from 'fs'

export async function scrapeFlights ({ startDate, endDate, continueFromSyncFile, overrideOnlyDateOnSyncFile} = {}) {
  logger.info(`Scraping de voos iniciado`)  
  const startTime = Date.now()  
  let totalScrapedItems = 0
  try {
    checkParams(startDate, endDate, continueFromSyncFile, overrideOnlyDateOnSyncFile)
    const {selectedDate, dateLimit} = slelectDates(startDate, endDate, continueFromSyncFile) 
    !continueFromSyncFile && !overrideOnlyDateOnSyncFile && clearSyncFile()  
    while (selectedDate <= dateLimit) {
      let $ = null 
      let page = 1
      const scrapedData = []
      do {
        logger.info(`Buscando página | date: ${formatDate(selectedDate)} | página ${page}`) 
        $ = await fetchPage(selectedDate, page)  
        logger.info(`Extraindo dados da página | data: ${formatDate(selectedDate)} | página ${page}`) 
        const scrapedPage = scrapePage($)   
        scrapedData.push(...scrapedPage)
        page++
      } while (!isEmptyPage($))

      logger.info(`Gravando dados no arquivo de sincronismo | ${formatDate(selectedDate)} | páginas: ${page -1}`) 
      addDataOnSyncFile(selectedDate, scrapedData)
      totalScrapedItems += scrapedData.length
      incrementDate(selectedDate)
    }
  } catch (error) {
    logger.warn(`Falha no Scraping de voos`) 
    return makeReport(startTime, totalScrapedItems, error)
  }
  logger.info(`Scraping de voos finalizado`) 
  return makeReport(startTime, totalScrapedItems)
}

function scrapePage ($) {
  const scrapedPage = $('.main_text table.listTable > tbody > tr:not(:first-child)').toArray().map($tr => {
    const cells = $($tr).children('td')
    const data =  {
      id: $($tr).attr('id'),
      date: $(cells[1]).children('div').text(),
      pilotId: $(cells[2]).find('.pilotLink > a').attr('href'),
      takeoffId: $(cells[2]).find('.takeoffLink > a').attr('href'),
      duration: $(cells[3]).text(),
      linearDistance: $(cells[4]).text(),
      olcDistance: $(cells[5]).text(),
      olcScore: $(cells[6]).text(),
      xcType: $(cells[6]).find('img:first-of-type').attr('class'),
      glider: $(cells[8]).find('div > img').attr('title') || 'Glider não declarado'
    }
    checkScrapedRecord(data, cells)
    return data
  })   
  return scrapedPage  
}

async function fetchPage(selectedDate, page) {
  const url = makeUrl(selectedDate, page)
  return await cheerio.fromURL(url) 
}

function checkScrapedRecord (record, source) {
  if (!record.id) throw new Error(`Dado "id" não encontrado no item extraido   |    ${JSON.stringify(record)}     |     ${source}`)
  if (!record.pilotId) throw new Error(`Dado "pilotId" não encontrado no item extraido   |    ${JSON.stringify(record)}     |     ${source}`)
  if (!record.takeoffId) throw new Error(`Dado "takeoffId" não encontrado no item extraido   |    ${JSON.stringify(record)}     |     ${source}`)
  if (!record.glider) throw new Error(`Dado "glider" não encontrado no item extraido   |    ${JSON.stringify(record)}     |     ${source}`)
  if (!record.date) throw new Error(`Dado "date" não encontrado no item extraido   |    ${JSON.stringify(record)}     |     ${source}`)
  if (!record.duration) throw new Error(`Dado "duration" não encontrado no item extraido   |    ${JSON.stringify(record)}     |     ${source}`)
  if (!record.linearDistance) throw new Error(`Dado "linearDistance" não encontrado no item extraido   |    ${JSON.stringify(record)}     |     ${source}`)
  if (!record.olcDistance) throw new Error(`Dado "olcDistance" não encontrado no item extraido   |    ${JSON.stringify(record)}     |     ${source}`)
  if (!record.olcScore) throw new Error(`Dado "olcScore" não encontrado no item extraido   |    ${JSON.stringify(record)}     |     ${source}`)
  if (!record.xcType) throw new Error(`Dado "xcType" não encontrado no item extraido   |    ${JSON.stringify(record)}     |     ${source}`)
}

function checkParams(startDate, endDate, continueFromSyncFile, overrideOnlyDateOnSyncFile) {
  if (startDate && endDate && startDate > endDate) {
    throw new Error('Parâmetros "startDate" não pode ser maior que o prâmetro "endDate"')
  }
  if (continueFromSyncFile && overrideOnlyDateOnSyncFile) {
    throw new Error('Parâmetros "continueFromSyncFile" e "overrideOnlyDateOnSyncFile" não podem ser "true" ao mesmo tempo')
  }
}

function slelectDates(startDate, endDate, continueFromSyncFile) {
  const DEFAULT_SYNC_DAYS = 6
  const dateLimit = endDate ? endDate : getYesterday()
  const selectedStartDate = startDate ? startDate : getPreviusDate(dateLimit, DEFAULT_SYNC_DAYS)
  let selectedDate = continueFromSyncFile ? selecDateFromSincyFileData() : selectedStartDate
  selectedDate = selectedDate ? selectedDate : selectedStartDate
  return { selectedDate, dateLimit }
}

function selecDateFromSincyFileData () {
  const fileData = loadDataFromSyncFile()
  if (!fileData || !Object.keys(fileData).length) { return null }
  const sortedStringDates = Object.keys(fileData).sort()
  const endStringDate = sortedStringDates[sortedStringDates.length - 1]
  const date = createDateFromString(endStringDate)
  incrementDate(date)
  return date
}

function getYesterday () {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  date.setHours(12, 0, 0, 0)
  return date
}

function getPreviusDate (date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() - days)
  d.setHours(12, 0, 0, 0)
  return d
}

function incrementDate(date) {
  date.setDate(date.getDate() + 1)
}

function createDateFromString (stringDate) {
  if (!stringDate) return null
  const arrDate = stringDate.split('-')
  return new Date(Number(arrDate[0]), Number(arrDate[1]) - 1, Number(arrDate[2]), 12, 0)
}

function makeUrl (date, page) {
  const formatedDate = formatDate(date).replaceAll('-','.')
  return `http://www.xcbrasil.com.br/tracks/world/${formatedDate}/brand:all,cat:1,class:all,xctype:all,club:all,pilot:0_0,takeoff:all&sortOrder=DATE&page_num=${page}`
}

function isEmptyPage ($) {
  const rows = $('.main_text table.listTable > tbody > tr:not(:first-child)').toArray()
  return rows.length === 0
}

function formatDate (date) {
  return `${date.getFullYear()}-${('00' + (date.getMonth() + 1)).slice(-2)}-${('00' + date.getDate()).slice(-2)}` 
}

function addDataOnSyncFile(date, data) {
  const formatedDate = formatDate(date) 
  const fileData = loadDataFromSyncFile()
  fileData[formatedDate] = data
  saveDataOnSyncFile(fileData)
}

function saveDataOnSyncFile(data) {
  const filePath = './sync-files/flight-sync-scrape.json'
  fs.writeFileSync(filePath, JSON.stringify(data))
}

function loadDataFromSyncFile () {
  const filePath = './sync-files/flight-sync-scrape.json'
  if (!fs.existsSync(filePath)) {
    saveDataOnSyncFile({})
  }
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(fileContent)
  return data
}

function clearSyncFile () {
  saveDataOnSyncFile({})
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