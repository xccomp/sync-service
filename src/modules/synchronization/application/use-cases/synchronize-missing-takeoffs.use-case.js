/** @typedef {import('../../domain/interfaces/repositories/takeoff.repository.interface')} ITakeoffRepository */
/** @typedef {import('../../domain/interfaces/scrapers/takeoff.scraper.interface')} ITakeoffScraper */

export class SynchronizeMissingTakeoffsUseCase {
  #takeoffRepository;
  #takeoffScraper;
  
  /**
   * @param {ITakeoffRepository} takeoffRepository
   * @param {ITakeoffScraper} takeoffScraper
   */
  constructor (takeoffRepository, takeoffScraper) {
    this.#takeoffRepository = takeoffRepository;
    this.#takeoffScraper = takeoffScraper;
  }

  async execute () {
    const missingTakeoffIds = await this.#takeoffRepository.getMissingTakeoffIdsInSynchronization();
    const takeoffs = await this.#takeoffScraper.scrapeByIds(missingTakeoffIds);
    await this.#takeoffRepository.save(takeoffs);
  }
}
