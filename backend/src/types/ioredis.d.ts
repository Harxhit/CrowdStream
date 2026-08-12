import "ioredis";

declare module "ioredis" {
  interface RedisCommander<Context> {
    rateLimitCheck(
      key: string,
      userId: string,
      roomId: string,
      capacity: number,
      initialTokens: number,
      refillInterval: number,
      tokenCost: number
    ): Promise<[number, number, number]>; // [allowed, remaining, retryAt]
  }
}