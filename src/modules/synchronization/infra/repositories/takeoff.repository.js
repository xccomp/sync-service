import { ITakeoffRepository } from "#modules/synchronization/domain/interfaces/repositories/takeoff.repository.interface.js"

/** @typedef {import('../../domain/entities/takeoff.entity')} Takeoff */
/** @typedef {import('#libs/xccomp-db/index.js')} XCCompDB */

export class TakeoffRepository extends ITakeoffRepository {

  #xccompDb;

  /**
   * @param {XCCompDB} xccompDb - XCComp Database connection manager.
   */
  constructor (xccompDb) {
    super();
    this.#xccompDb = xccompDb;
  }

  /**
   * @param {Takeoff[]} takeoffs - An array of takeoffs entity instances to save on database.
   */
  async save (takeoffs) {
    const dbClient = await this.#xccompDb.getClient()
    try {
      const values = {
        ids: [],
        names: [],
        latitudes: [],
        longitudes: [],
        cityIds: []
      };
      takeoffs.forEach(takeoff => {
        values.ids.push(takeoff.id)
        values.names.push(takeoff.name)
        values.latitudes.push(takeoff.latitude)
        values.longitudes.push(takeoff.longitude)
        values.cityIds.push(takeoff.city_id)
      });
      const sql = `
        INSERT INTO takeoffs (id, name, latitude, longitude, city_id)
        SELECT * FROM UNNEST($1::int[], $2::text[], $3::numeric[], $4::numeric[], $5::int[])
      `;
      await dbClient.query(sql, Object.values(values));
    } catch (error) {
      throw error;
    } finally {
      dbClient.release();
    }
  }

  /**
   * @return {Number[]} A list of missing takeoff ids in sinchronization.
   */
  async getMissingTakeoffIdsInSynchronization () {
    const dbClient = await this.#xccompDb.getClient()
    try {
      const sql = `
        SELECT DISTINCT f.takeoff_id
        FROM flights_sync f
        WHERE NOT EXISTS (
          SELECT 1 
          FROM takeoffs t 
          WHERE t.id = f.takeoff_id
        );
      `;
      const result = await dbClient.query(sql);
      return result.rows.map(row => row.takeoff_id);
    } catch (error) {
      throw error;
    } finally {
      dbClient.release();
    }
  }
}
