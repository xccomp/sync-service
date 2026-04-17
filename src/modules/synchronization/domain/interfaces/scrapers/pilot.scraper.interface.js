/** @typedef {import('../../entities/pilot.entity')} Pilot */

export class IPilotScraper {
  /**
   * @param {number[]} ids - An array for pilot ids.
   * @returns {Pilot[]} An array with scraped pilots.
   */
  async scrapeByIds (ids) {
    throw new Error('Method is not implemented');
  }
}