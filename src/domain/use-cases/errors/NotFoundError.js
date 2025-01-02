import GenericError from "./GenericError.js"

export default class NotFoundError extends GenericError {
  constructor(message, originalError) {
    super(message, 'NotFoundError', originalError)
  }

  static sameTypeOfError (error) {
    error.name === 'NotFoundError'
  }
}