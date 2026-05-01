import { Throttle } from '@nestjs/throttler';

/**
 * Custom Throttler Decorators for specific routes.
 * Rules: { name: { ttl: seconds, limit: requests } }
 */

// Register: 5 requests per 60 seconds
export const ThrottleRegister = () => 
  Throttle({ default: { ttl: 60, limit: 5 } });

// Login: 10 requests per 60 seconds
export const ThrottleLogin = () => 
  Throttle({ default: { ttl: 60, limit: 10 } });

// OCR: 5 requests per 300 seconds (5 minutes)
export const ThrottleOcr = () => 
  Throttle({ default: { ttl: 300, limit: 5 } });

// Seat Lock: 10 requests per 30 seconds
export const ThrottleSeatLock = () => 
  Throttle({ default: { ttl: 30, limit: 10 } });
