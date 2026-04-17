import { IPilotRepository } from '#modules/synchronization/domain/interfaces/repositories/pilot.repository.interface.js'

/** @typedef {import('../../domain/entities/pilot.entity')} Pilot */
/** @typedef {import('#libs/xccomp-db/index.js')} XCCompDB */

export class PilotRepository extends IPilotRepository {

  #xccompDb;

  /**
   * @param {XCCompDB} xccompDb - XCComp Database connection manager.
   */
  constructor (xccompDb) {
    super();
    this.#xccompDb = xccompDb;
  }

  /**
   * @param {Pilot[]} pilots - An array of pilot entity instances to save on database.
   */
  async save (pilots) {
    const dbClient = await this.#xccompDb.getClient()
    try {
      const values = {
        ids: [],
        names: [],
        genders: [],
        nationalities: []
      };
      pilots.forEach(pilot => {
        values.ids.push(pilot.id)
        values.names.push(pilot.name)
        values.genders.push(pilot.gender)
        values.nationalities.push(pilot.nationality)
      });
      const sql = `
        INSERT INTO pilots (id, name, gender, nationality)
        SELECT * FROM UNNEST($1::int[], $2::text[], $3::text[], $4::text[])
      `;
      await dbClient.query(sql, Object.values(values));
    } catch (error) {
      throw error;
    } finally {
      dbClient.release();
    }
  }

  /**
   * @return {Number[]} A list of missing pilot ids in sinchronization.
   */
  async getMissingPilotIdsInSynchronization () {
    const dbClient = await this.#xccompDb.getClient()
    try {
      const sql = `
        SELECT DISTINCT f.pilot_id
        FROM flights_sync f
        WHERE NOT EXISTS (
          SELECT 1 
          FROM pilots p 
          WHERE p.id = f.pilot_id
        );
      `;
      const result = await dbClient.query(sql);
      return result.rows.map(row => row.pilot_id);
    } catch (error) {
      throw error;
    } finally {
      dbClient.release();
    }
  }
}
