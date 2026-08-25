import { Module } from "@nestjs/common";
import { TripUtilsService } from "./trip-utils.service";
import { TripsController } from "./trips.controller";
import { TripsService } from "./trips.service";

@Module({
  controllers: [TripsController],
  providers: [TripsService, TripUtilsService],
  exports: [TripUtilsService],
})
export class TripsModule {}
