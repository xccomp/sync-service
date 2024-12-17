import { startService } from "../src/service.js"

describe('Service tests', () => {
  it(`Show return status "sync-service it's on =)"`, () => {
    const response = startService()
    expect(response).toBe(`sync-service it's on =)`)
  })
})
