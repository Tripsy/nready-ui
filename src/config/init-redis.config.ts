import Redis from 'ioredis';
import { Configuration } from '@/config/settings.config';
import { logger } from '@/helpers/logger.helper';

let redisInstance: Redis | null = null;

export const getRedisClient = (): Redis => {
	if (!redisInstance) {
		redisInstance = new Redis({
			host: Configuration.get('redis.host'),
			port: Configuration.get('redis.port'),
			password: Configuration.get('redis.password'),
		});

		redisInstance.on('error', (error) => {
			logger.error('Redis connection error', error);
		});

		redisInstance.on('connect', () => {
			logger.debug('Connected to Redis');
		});
	}

	return redisInstance;
};

export const redisClose = async (): Promise<void> => {
	if (redisInstance) {
		try {
			await redisInstance.quit();
			logger.debug('Redis connection closed gracefully');
		} catch (error) {
			logger.error('Failed to close the Redis connection', error);
			throw error;
		} finally {
			redisInstance = null;
		}
	}
};
