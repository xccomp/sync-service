export default class BaseError extends Error {
  constructor(message, name, originalError) {
    super(message)
    this.name = name
    this.originalError = originalError
  }

  static sameTypeOfError (error) {
    error.name === 'BaseError'
  }
}