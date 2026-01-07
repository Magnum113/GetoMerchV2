// Jest setup file
// Mock Next.js specific functionality
global.NextRequest = class NextRequest {
  constructor(url, init) {
    this.url = url
    this.method = init?.method || 'GET'
    this.headers = init?.headers || {}
    this.body = init?.body
  }
  
  async json() {
    return JSON.parse(this.body)
  }
}
