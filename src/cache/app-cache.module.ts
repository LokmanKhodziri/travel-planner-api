import { Global, Module } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { AppCacheService } from "./app-cache.service";

@Global()
@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 0,
      max: 1000,
    }),
  ],
  providers: [AppCacheService],
  exports: [AppCacheService, CacheModule],
})
export class AppCacheModule {}
