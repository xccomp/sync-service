import { IPilotScraper } from '#modules/synchronization/domain/interfaces/scrapers/pilot.scraper.interface.js';
import { Pilot } from '#modules/synchronization/domain/entities/pilot.entity.js';

export class PilotScraper extends IPilotScraper {

  #cheerio;
  #dataSanitizer;

  constructor (cheerio, dataSanitizer) {
    super();
    this.#cheerio = cheerio;
    this.#dataSanitizer = dataSanitizer;
  }

  /**
   * @param {number[]} ids - An array for pilot ids.
   * @returns {Pilot[]} An array with scraped pilots.
   */
  async scrapeByIds (ids) {
    try {
      const pilots = [];
      for (const id of ids) {
        // TODO: Verificar necessidade de colocar um sleep para requisiçòes ao XCBrasil.
        const $ = await this.#cheerio.fromURL(`https://www.xcbrasil.com.br/pilot/0_${id}`);
        const htmlRows = $('.main_text table.main_text:first-of-type tr').toArray();
        const rawData = { 
          firstName: $(htmlRows[0]).find('td:nth-child(2)').text(),
          lastName: $(htmlRows[1]).find('td:nth-child(2)').text(),
          nationality: $(htmlRows[2]).find('td:nth-child(2)').text(),
          gender: $(htmlRows[3]).find('td:nth-child(2)').text()
        };
        const parsedData = {
          name: this.#dataSanitizer.toBasic(`${rawData.firstName} ${rawData.lastName}`),
          nationality: this.#dataSanitizer.toBasic(rawData.nationality),
          gender: this.#dataSanitizer.toBasic(rawData.gender).toUpperCase() === 'F' ? 'F' : 'M'
        };
        pilots.push(new Pilot(id, parsedData.name, parsedData.gender, parsedData.nationality));
      }
      return pilots;
    } catch (error) {
      throw error
    }
  }
}
