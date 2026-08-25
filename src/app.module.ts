import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ActivitiesModule } from "./activities/activities.module";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { BudgetModule } from "./budget/budget.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { HealthController } from "./health/health.controller";
import { IntegrationsModule } from "./integrations/integrations.module";
import { AppCacheModule } from "./cache/app-cache.module";
import { LocationsModule } from "./locations/locations.module";
import { MuslimFeaturesModule } from "./muslim-features/muslim-features.module";
import { PlacesModule } from "./places/places.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TripsModule } from "./trips/trips.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === "test",
    }),
    PrismaModule,
    AppCacheModule,
    IntegrationsModule,
    AuthModule,
    TripsModule,
    LocationsModule,
    ActivitiesModule,
    ExpensesModule,
    BudgetModule,
    MuslimFeaturesModule,
    PlacesModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
