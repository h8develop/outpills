import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminProductsService } from './admin-products.service';
import { AdminOrdersService } from './admin-orders.service';
import { ProductsModule } from '../products/products.module';
import { InventoryModule } from '../inventory/inventory.module';
import { StorageModule } from '../storage/storage.module';
import { CategoriesModule } from '../categories/categories.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, ProductsModule, InventoryModule, StorageModule, CategoriesModule],
  controllers: [AdminController],
  providers: [AdminProductsService, AdminOrdersService],
})
export class AdminModule {}
