export class SynchronizeTakeoffsByIdUseCase {
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

  /**
   * @param {Number} ids
   */
  async execute ({ ids }) {
    const takeoffs = await this.#takeoffScraper.scrapeByIds(ids);
    await this.#takeoffRepository.save(takeoffs);
  }
}
