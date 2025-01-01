import pg from 'pg'
import dotenv from 'dotenv'
import { logger } from '#logger'

dotenv.config()

class SyncDB {
  
  static #pool = new pg.Pool({
    connectionString: process.env.POSTGRESS_CONNECTION_STRING
  })

  static async query(text, params) {
    const res = await SyncDB.#pool.query(text, params)
    return res
  }

  static async getClient() {
    return SyncDB.#pool.connect()
  }

  static async testConnection () {
    try {
      const result = await SyncDB.query('SELECT NOW()')
      return Boolean(result.rows.length)
    } catch (error) {
      logger.error(error)
      return false
    }
  } 
}

export default SyncDB

