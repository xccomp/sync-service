import { ITakeoffScraper } from '#modules/synchronization/domain/interfaces/scrapers/takeoff.scraper.interface.js';
import { Takeoff } from '#modules/synchronization/domain/entities/takeoff.entity.js';


/** @typedef {import('#modules/synchronization/domain/entities/takeoff.entity')} Takeoff */

export class TakeoffScraper extends ITakeoffScraper {

  #cheerio;
  #dataSanitizer;

  constructor (cheerio, dataSanitizer) {
    super();
    this.#cheerio = cheerio;
    this.#dataSanitizer = dataSanitizer;
  }

  /**
   * @param {number[]} ids - An array for takeoff ids.
   * @returns {Takeoff[]} An array with scraped takeoffs.
   */
  async scrapeByIds (ids) {
    try {
      const regexExtractName = /^\s*Nome do Waypoint\s*:\s*(.*?)(?:\s*\([^)]*\))?\s*$/;
      const sanitizationOptions = {
        whitelist: /^[\p{L}0-9\s\-'’().\/"@,:]+$/u,
        fatalPatterns: [/CpjJwWHV/i]
      }
      const takeoffs = [];
      for (const id of ids) {
        // TODO: Verificar necessidade de colocar um sleep para requisiçòes ao XCBrasil.
        const $ = await this.#cheerio.fromURL(`http://www.xcbrasil.com.br/takeoff/${id}`);
        
        const titleDiv =$('div.main_text > div > div > div > div:first-child');
        const coordinatesDiv =$('div.main_text table.Box tr.col3_in:last-of-type > td:first-child a');
        const rawData = { 
          name: $(titleDiv).text(),
          coordinates: $(coordinatesDiv).attr('href')
        };

        const matchName = rawData.name.match(regexExtractName);
        const parsedData = {
          name: matchName ? matchName[1] : `Takeoff ${id}`,
          latitude: Number(rawData.coordinates.split('&').reverse()[1].replaceAll('latitude=', '')),
          longitude: Number(rawData.coordinates.split('&').reverse()[0].replaceAll('longitude=', ''))
        };

        const sanitizedData = {
          name: this.#dataSanitizer.toStrictText(parsedData.name, {...sanitizationOptions, fallback: `Takeoff ${id}`}),
          latitude: parsedData.latitude > 90 || parsedData.latitude < -90 ? 0 : parsedData.latitude,
          longitude: parsedData.longitude > 180 || parsedData.longitude < -180 ? 0 : parsedData.longitude
        }; 

        takeoffs.push(new Takeoff(id, sanitizedData.name, sanitizedData.latitude, sanitizedData.longitude));
      }
      return takeoffs;
    } catch (error) {
      throw error
    }
  }
}
