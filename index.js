import { logger } from '#logger'
import { ServerBuilder } from '#server/index.js'
import XCCompDb from './src/libs/xccomp-db/index.js'

if (!await XCCompDb.testConnection()) {
  logger.error('Unable to establish connection to database xccomp')
  process.exit(1)
} 
  
const server = await ServerBuilder.build()
server.start()