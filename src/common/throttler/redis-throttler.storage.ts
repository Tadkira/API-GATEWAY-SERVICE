import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Custom Redis Storage for NestJS ThrottlerModule v5+.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('redis.host') || 'localhost',
      port: this.configService.get<number>('redis.port') || 6379,
      password: this.configService.get<string>('redis.password') || undefined,
      keyPrefix: 'throttle:',
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{ totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number }> {
    const hits = await this.redis.incr(key);
    if (hits === 1) {
      await this.redis.pexpire(key, ttl * 1000);
    }
    
    const pttl = await this.redis.pttl(key);
    const timeToExpire = Math.max(0, Math.ceil(pttl / 1000));

    // Simple blocking logic (optional, but required by interface)
    const isBlocked = hits > limit;
    const timeToBlockExpire = isBlocked ? timeToExpire : 0;

    return {
      totalHits: hits,
      timeToExpire: timeToExpire,
      isBlocked,
      timeToBlockExpire,
    };
  }
}
