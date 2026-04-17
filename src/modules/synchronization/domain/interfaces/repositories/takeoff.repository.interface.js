export class ITakeoffRepository {
  
  /**
   * @param {Takeoff[]} takeoffs - An array of takeoffs entity instances to save on database.
   */
  async save (takeoffs) {
    throw new Error('The method "save" is not implemented');
  }


  /**
   * @return {Number[]} A list of missing takeoff ids in sinchronization.
   */
  async getMissingTakeoffIdsInSynchronization () {
    throw new Error('The method "getMissingTakeoffIdsInSynchronization" is not implemented');
  }

}