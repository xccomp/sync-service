import { logger } from "#logger"

export default class ExempleController {

  static exempleGet (req, res) {
    logger.info('controller: ExempleController | method: exempleGet')
    res.send({
      controller: 'ExempleController',
      method: 'exempleGet'
    })
  }


  static exemplePost (req, res) {
    logger.info('controller: ExempleController | method: exemplePost')
    res.send({
      controller: 'ExempleController',
      method: 'exemplePost'
    })
  }

}
