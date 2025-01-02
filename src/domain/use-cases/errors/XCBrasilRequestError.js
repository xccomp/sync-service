import GenericError from "./GenericError.js"

export default class XCBrasilRequestError extends GenericError {
  constructor(message, originalError) {
    super(message, 'XCBrasilRequestError', originalError)
  }

  static sameTypeOfError (error) {
    error.name === 'XCBrasilRequestError'
  }
}