import XCCompDB from '#libs/xccomp-db/index.js';
import { DataSanitizer } from '#libs/sanitizer/DataSanitizer.js';
import * as cheerio from 'cheerio';

import { PilotRepository } from '../infra/repositories/pilot.repository.js';
import { TakeoffRepository } from '../infra/repositories/takeoff.repository.js';

import { PilotScraper } from '../infra/scrapers/pilot.scraper.js';
import { TakeoffScraper } from '../infra/scrapers/takeoff.scraper.js';

import { SynchronizePilotsByIdUseCase } from '../application/use-cases/synchronize-pilots-by-id.use-case.js';
import { SynchronizeMissingPilotsUseCase } from '../application/use-cases/synchronize-missing-pilots.use-case.js';
import { SynchronizeTakeoffsByIdUseCase } from '../application/use-cases/synchronize-takeoffs-by-id.use-case.js';



const pilotRepository = new PilotRepository(XCCompDB);
const takeoffRepository = new TakeoffRepository(XCCompDB);


const pilotScraper = new PilotScraper(cheerio, DataSanitizer);
const takeoffScraper = new TakeoffScraper(cheerio, DataSanitizer);

const synchronizePilotsByIdUseCase = new SynchronizePilotsByIdUseCase(pilotRepository, pilotScraper);
const synchronizeMissingPilotsUseCase = new SynchronizeMissingPilotsUseCase(pilotRepository, pilotScraper);
const synchronizeTakeoffsByIdUseCase = new SynchronizeTakeoffsByIdUseCase(pilotRepository, pilotScraper);


const injectionContainer = {
  useCases: {
    synchronizePilotsByIdUseCase,
    synchronizeMissingPilotsUseCase,
    synchronizeTakeoffsByIdUseCase
  },
  repositories: {
    pilotRepository,
    takeoffRepository
  },
  scrapers: {
    pilotScraper,
    takeoffScraper
  }
}

export default Object.freeze(injectionContainer);
