import { logger } from "#logger"

export default class Server {
  #httpServer = null
  #port = null
  
  constructor (httpServer) {
    this.#httpServer = httpServer 
  }
  
  get httpServer () {
    return this.#httpServer
  } 

  get port () {
    return this.#port
  } 

  set httpServer (httpServer) {
    this.#httpServer = httpServer
  }
  
  set port (port) {
    this.#port = port
  } 

  start () {
    const startedServer = this.#httpServer.listen(this.#port, () => {
      logger.info(`Server listening on port ${this.#port}`)
    })
    startedServer.setTimeout(120000)
  }
}