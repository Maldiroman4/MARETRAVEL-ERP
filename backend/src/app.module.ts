import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { GdsTicketsModule } from './modules/gds-tickets/gds-tickets.module';
import { DebitNotesModule } from './modules/debit-notes/debit-notes.module';
import { CreditNotesModule } from './modules/credit-notes/credit-notes.module';
import { CashReceiptsModule } from './modules/cash-receipts/cash-receipts.module';
import { SupportModule } from './modules/support/support.module';
import { PrintModule } from './modules/print/print.module';
import { TravelRemindersModule } from './modules/travel-reminders/travel-reminders.module';
import { JwtAuthGuard } from './common/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), '..'),
      serveRoot: '/',
      exclude: ['/api/{*path}'],
    }),
    PrismaModule,
    AuthModule,
    AccountsModule,
    GdsTicketsModule,
    DebitNotesModule,
    CreditNotesModule,
    CashReceiptsModule,
    SupportModule,
    PrintModule,
    TravelRemindersModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
