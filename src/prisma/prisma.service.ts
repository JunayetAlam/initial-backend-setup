import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { resolveDatabaseUrl } from './database-url.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    const connectionString = resolveDatabaseUrl((key) =>
      config.get<string>(key),
    );
    if (!connectionString) {
      throw new Error(
        'Set DATABASE_URL, or PROJECT_SLUG and POSTGRES_USER/PASSWORD/PORT',
      );
    }

    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 5000,
    });
    const isDev = config.get<string>('NODE_ENV') === 'development';

    super({
      adapter: new PrismaPg(pool),
      log: isDev ? ['error', 'warn'] : ['error'],
      omit: {
        user: {
          password: true,
          otp: true,
          otpExpiry: true,
          otpAttempts: true,
          otpFor: true,
          passwordResetToken: true,
          passwordResetTokenExpires: true,
          isEmailVerified: true,
          emailVerificationToken: true,
          emailVerificationTokenExpires: true,
          isAgreeWithTerms: true,
        },
      },
    });

    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
