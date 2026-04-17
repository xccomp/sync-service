/** @typedef {import('../../domain/interfaces/repositories/pilot.repository.interface')} IPilotRepository */
/** @typedef {import('../../domain/interfaces/scrapers/pilot.scraper.interface')} IPilotScraper */

export class SynchronizeMissingPilotsUseCase {
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

  async execute () {
    const missingPilotIds = await this.#pilotRepository.getMissingPilotIdsInSynchronization();
    const pilots = await this.#pilotScraper.scrapeByIds(missingPilotIds);
    await this.#pilotRepository.save(pilots);
  }
}
