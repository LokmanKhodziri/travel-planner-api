import { Module } from "@nestjs/common";
import { TripsModule } from "../trips/trips.module";
import { MuslimFeaturesController } from "./muslim-features.controller";
import { MuslimFeaturesService } from "./muslim-features.service";

@Module({
  imports: [TripsModule],
  controllers: [MuslimFeaturesController],
  providers: [MuslimFeaturesService],
})
export class MuslimFeaturesModule {}
