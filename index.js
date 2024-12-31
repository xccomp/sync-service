import { ServerBuilder } from '#server/index.js'

const server = await ServerBuilder.build()
server.start()