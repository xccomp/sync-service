export class SynchronizePilotsByIdUseCase {
  #pilotRepository;
  #pilotScraper;
  
  /**
   * @param {IPilotRepository} pilotRepository
   * @param {IPilotScraper} pilotScraper
   */
  constructor (pilotRepository, pilotScraper) {
    this.#pilotRepository = pilotRepository;
    this.#pilotScraper = pilotScraper;
  }

  /**
   * @param {Number} ids
   */
  async execute ({ ids }) {
    const pilots = await this.#pilotScraper.scrapeByIds(ids);
    await this.#pilotRepository.save(pilots);
  }
}
