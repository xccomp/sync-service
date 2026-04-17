/** @typedef {import('#modules/synchronization/domain/entities/takeoff.entity')} Takeoff */

export class ITakeoffScraper {
  /**
   * @param {number[]} ids - An array for takeoff ids.
   * @returns {Takeoff[]} An array with scraped takeoffs.
   */
  async scrapeByIds (ids) {
    throw new Error('Method is not implemented');
  }
}