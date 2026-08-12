import logger from "./logging";
import { redis } from "./redis.util";

const TOKEN_COST = 1;

interface BucketConfig {
  capacity: number;
  initialTokens: number;
  refillInterval: number;
}

const BUCKET_CONFIG: { [action: string]: BucketConfig } = {
  join: { capacity: 5, initialTokens: 4, refillInterval: 10000 },      // 10s
  chat: { capacity: 20, initialTokens: 19, refillInterval: 2000 },     // 2s
  reactions: { capacity: 100, initialTokens: 99, refillInterval: 200 }, // 200ms
};


export const rateLimiter = async (
  identifier: string,
  idType: 'user' | 'ip',
  action: string,
  roomId: string
) => {
  logger.info("Rate limiting", { action, idType });

  const config = BUCKET_CONFIG[action];
  if (!config) {
    logger.warn("Unknown action", action);
    return { allowed: false, retryAt: 0 };
  }

  const key = `${idType}:${identifier}:rate:${action}`;

  try {
    const [allowed, remaining, retryAt] = await redis.rateLimitCheck(
      key,
      identifier,
      roomId,
      config.capacity,
      config.initialTokens,
      config.refillInterval,
      TOKEN_COST
    );

    if (allowed === 0) {
      logger.warn(`${action} rate limit exceeded`, { identifier, idType, retryAt });
      return { allowed: false, retryAt, action };
    }

    return { allowed: true, remaining };
  } catch (error) {
    logger.error("Rate limiting error", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    return { allowed: true, remaining: 0 , action};
  }
};