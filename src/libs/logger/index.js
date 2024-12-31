import pino from 'pino'

export const logger = pino({
  levelFirst: true,
  colorize: true
})
