import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { DocumentsController } from '@/documents/documents.controller';
import { DocumentsService } from '@/documents/documents.service';
import { OrdersController } from '@/orders/orders.controller';
import { OrdersService } from '@/orders/orders.service';
import { AddressesController } from '@/addresses/addresses.controller';
import { AddressesService } from '@/addresses/addresses.service';
import { PriceSettingsController } from '@/price-settings/price-settings.controller';
import { PriceSettingsService } from '@/price-settings/price-settings.service';
import { AgentsController } from '@/agents/agents.controller';
import { AgentsService } from '@/agents/agents.service';
import { PointsController } from '@/points/points.controller';
import { PointsService } from '@/points/points.service';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 } // 50MB
    })
  ],
  controllers: [
    AppController,
    DocumentsController,
    OrdersController,
    AddressesController,
    PriceSettingsController,
    AgentsController,
    PointsController
  ],
  providers: [
    AppService,
    DocumentsService,
    OrdersService,
    AddressesService,
    PriceSettingsService,
    AgentsService,
    PointsService
  ],
})
export class AppModule {}