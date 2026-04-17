export class IPilotRepository {
  
  /**
   * @param {Pilot[]} pilots - An array of pilot entity instances to save on database.
   */
  async save (pilots) {
    throw new Error('The method "save" is not implemented');
  }


  /**
   * @return {Number[]} A list of missing pilot ids in sinchronization.
   */
  async getMissingPilotIdsInSynchronization () {
    throw new Error('The method "getMissingPilotIdsInSynchronization" is not implemented');
  }

}