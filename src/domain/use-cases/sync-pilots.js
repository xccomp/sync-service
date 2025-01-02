export async function executeSyncProcesc (firstStep = 1, lastStep = 4) {
  validateStepsParams(firstStep, lastStep)
  const steps = [
    scrape,
    prepare,
    load,
    synchronize
  ]

  let syncLog = `Pilots SYNC process started | selected steps: ${steps[firstStep - 1].name}`
  for (let index = firstStep; index < lastStep; index++) {
    const process = steps[index]
    syncLog += `, ${process.name}`
  }
  logger.info(syncLog)

  for (let index = firstStep - 1; index < lastStep; index++) {
    const process = steps[index]
    await process()
  }
  return true
}

export async function scrape () {
  logger.info('Pilots scraping process started')

  const cbvlPilots = scrapeCbvlPilots()
  const fmvlPiltos = scrapeFmvlPilots()

  saveDataOnSyncFile({ cbvlPilots, fmvlPiltos }, 'scraped')
  logger.info('Pilots scraping process completed')
  return true
}


function scrapeCbvlPilots () {
  loadDataFromSyncFile
}


function saveDataOnSyncFile(data, type) {
  logger.info('Sync file saving process started')
  try {
    fs.writeFileSync(`./sync-files/${type}-sync-pilots.json`, JSON.stringify(data))
  } catch (error) {
    logger.info('Sync file saving process failed')
    logger.error(error)
    throw new Error('Sync file saving process failed')
  }
  logger.info('Sync file saving process completed')
}

function loadDataFromSyncFile (type) {
  logger.info('Sync file loading process started')
  let data = null 
  try {
    const fileContent = fs.readFileSync(`./sync-files/${type}-sync-pilots.json`, 'utf8')
    data = JSON.parse(fileContent) 
  } catch (error) {
    logger.info('Sync file loading process failed')
    logger.error(error)
    throw new Error('Sync file loading process failed')
  }
  logger.info('Sync file loading process completed')
  return data
}