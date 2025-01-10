
import { logger } from "#logger"
import fs from 'fs'

export function transformFlights () {
  logger.info(`Transformação de voos iniciada`) 
  const startTime = Date.now()
  let totalTransformedItems = 0
  try {
    const dataToTransform = loadDataFromSyncFile()
    const transformedData = {}
    Object.keys(dataToTransform).forEach(key => {
      logger.info(`Transformando dados por data| data: ${key}`)  
      const data = dataToTransform[key].map(transformData)
      transformedData[key] = data
    })
    saveDataOnSyncFile(transformedData)
    totalTransformedItems = Object.keys(transformedData).reduce((acc, key) => {return acc + transformedData[key].length }, 0)
  } catch (error) {
    logger.warn(`Falha na transformação de voos`) 
    return makeReport(startTime, totalTransformedItems, error)
  }
  logger.info(`Transformação de voos finalizada`) 
  return makeReport(startTime, totalTransformedItems)
}

function transformData (data) {
  const record = { 
    id: Number(data.id.split('_')[1]),
    pilotId: Number(data.pilotId.split(',')[5].split('_')[1].trim().replaceAll(`'`, '')),
    takeoffId: Number(data.takeoffId.split(',')[5].trim().replaceAll(`'`, '')),
    glider: data.glider,
    date: data.date.split('/').reverse().join('-'),
    duration: transformDuration(data),
    linearDistance: Number(data.linearDistance.replace(/\u00a0/g, " ").split(' ')[0]),
    olcDistance: Number(data.olcDistance.replace(/\u00a0/g, " ").split(' ')[0]),
    olcScore: Number(data.olcScore.trim()),
    xcType: transformXcType(data),
    validity:  transformValidity(data),
  }
  checkTransformedRecord(record, data)
  return record
}

function transformDuration (data) {
  const duration = data.duration
  const times = duration.split(':').map(el => Number(el))
  return times[0] * 3600 + times[1] * 60
}

function transformXcType (data) {
  const xcType = data.xcType
  if (xcType.includes('sprite-icon_turnpoints')) return 1
  if (xcType.includes('sprite-icon_triangle_free')) return 2
  if (xcType.includes('sprite-icon_triangle_fai')) return 3
  if (xcType.includes('sprite-photo_icon_blank')) return 4

  
  throw new Error(`Falha na tentativa de converter o tipo de voo: dado = "${JSON.stringify(data)}"`)
}

function transformValidity (data) {
  const validity = data.validity
  if (validity.includes('sprite-icon_valid_ok')) return 3
  if (validity.includes('sprite-icon_valid_nok')) return 2
  if (validity.includes('sprite-icon_valid_unknown')) return 1
  throw new Error(`Falha na tentativa de converter o a validade de voo: dado = "${JSON.stringify(data)}"`)
}

function checkTransformedRecord (record, source) {
  if (Number.isNaN(record.id) || record.id <= 0) throw new Error(`Dado "id" inválido no item transformado   |    ${JSON.stringify(record)}     |     ${JSON.stringify(source)}`)
  if (Number.isNaN(record.pilotId) || record.pilotId <= 0) throw new Error(`Dado "pilotId" inválido no item transformado   |    ${JSON.stringify(record)}     |     ${JSON.stringify(source)}`)
  if (Number.isNaN(record.takeoffId) || record.pilotId <= 0) throw new Error(`Dado "takeoffId" inválido no item transformado   |    ${JSON.stringify(record)}     |     ${JSON.stringify(source)}`)
  if (!record.glider) throw new Error(`Dado "glider" inválido no item transformado   |    ${JSON.stringify(record)}     |     ${JSON.stringify(source)}`)
  if (!record.date) throw new Error(`Dado "date" inválido no item transformado   |    ${JSON.stringify(record)}     |     ${JSON.stringify(source)}`)
  if (Number.isNaN(record.duration) || record < 0) throw new Error(`Dado "duration" inválido no item transformado   |    ${JSON.stringify(record)}     |     ${JSON.stringify(source)}`)
  if (Number.isNaN(record.linearDistance) || record.linearDistance < 0) throw new Error(`Dado "linearDistance" inválido no item transformado   |    ${JSON.stringify(record)}     |     ${JSON.stringify(source)}`)
  if (Number.isNaN(record.olcDistance )|| record.olcDistance < 0) throw new Error(`Dado "olcDistance" inválido no item transformado   |    ${JSON.stringify(record)}     |     ${JSON.stringify(source)}`)
  if (Number.isNaN(record.olcScore) || record.olcScore < 0) throw new Error(`Dado "olcScore" inválido no item transformado   |    ${JSON.stringify(record)}     |     ${JSON.stringify(source)}`)
  if (Number.isNaN(record.xcType) || ![1,2,3,4].includes(record.xcType)) throw new Error(`Dado "xcType" inválido no item transformado   |    ${JSON.stringify(record)}     |     ${JSON.stringify(source)}`)
  if (Number.isNaN(record.validity) || ![1,2,3].includes(record.validity)) throw new Error(`Dado "validity" inválido no item transformado   |    ${JSON.stringify(record)}     |     ${JSON.stringify(source)}`)
}

function saveDataOnSyncFile(data) {
  const filePath = './sync-files/flight-sync-transform.json'
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
