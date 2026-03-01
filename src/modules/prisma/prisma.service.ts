import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = process.env.DATABASE_URL ?? '';
    const separator = url.includes('?') ? '&' : '?';
    const pooledUrl = `${url}${separator}connection_limit=20&pool_timeout=30`;

    super({
      datasourceUrl: pooledUrl,
      log:
        process.env.NODE_ENV === 'production'
          ? ['error', 'warn']
          : [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'info' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ],
      transactionOptions: {
        maxWait: 5000,
        timeout: 15000,
      },
    });

    if (process.env.NODE_ENV !== 'production') {
      (this as any).$on('query', (e: any) => {
        this.logger.debug(
          `Query: ${e.query} — Params: ${e.params} — Duration: ${e.duration}ms`,
        );
      });
    }
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected (pool: connection_limit=20)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
