import { startService } from './src/service.js' 
import { logger } from '#logger' 

const appStatus = startService()
logger.info(appStatus)
