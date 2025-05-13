class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequestsPerMinute: number;
  private readonly requestInterval: number = 60000; // 1 minute in milliseconds

  constructor() {
    this.maxRequestsPerMinute = parseInt(import.meta.env.VITE_MAX_REQUESTS_PER_MINUTE || '60');
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(timestamp => now - timestamp < this.requestInterval);
    return this.requests.length < this.maxRequestsPerMinute;
  }

  getTimeUntilNextRequest(): number {
    const now = Date.now();
    if (this.canMakeRequest()) return 0;
    
    // Find the oldest request that will expire
    const oldestRequest = Math.min(...this.requests);
    return this.requestInterval - (now - oldestRequest);
  }

  addRequest() {
    const now = Date.now();
    this.requests = this.requests.filter(timestamp => now - timestamp < this.requestInterval);
    this.requests.push(now);
  }
}

export const rateLimiter = new RateLimiter();