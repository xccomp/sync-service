import express from 'express'
import cors from 'cors'
import Server from './server.js'
import { paragliderRouter } from '#server/routers/index.js'

export default class ServerBuilder {
  static #httpServer

  static async build () {
    this.#createHttpServerInstance()
    this.#setHttpServerConfigs()
    this.#setHttpServerMiddlewares()
    this.#setHttpServerRoutes()
    const server = this.#createServer()
    return server
  }

  static #createHttpServerInstance () {
    this.#httpServer = express()
  }

  static #setHttpServerConfigs () {
    this.#httpServer.disable('x-powered-by')
  }

  static #setHttpServerMiddlewares () {
    this.#httpServer.use(express.json())
    this.#httpServer.use(cors())
  }

  static #setHttpServerRoutes () {
    this.#httpServer.use('/paraglider', paragliderRouter)
  }

  static #createServer () {
    const server = new Server()
    server.httpServer = this.#httpServer
    server.port = 3001
    return server
  }
}