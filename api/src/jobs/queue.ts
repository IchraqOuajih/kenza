import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import 'dotenv/config'

export const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })

export const relanceQueue = new Queue('relances', { connection })