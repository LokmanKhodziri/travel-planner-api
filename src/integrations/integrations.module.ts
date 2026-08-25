import { Global, Module } from "@nestjs/common";
import { AladhanService } from "./aladhan.service";
import { DistanceMatrixService } from "./distance-matrix.service";
import { GeocodeService } from "./geocode.service";
import { PlacesService } from "./places.service";

@Global()
@Module({
  providers: [
    GeocodeService,
    PlacesService,
    AladhanService,
    DistanceMatrixService,
  ],
  exports: [
    GeocodeService,
    PlacesService,
    AladhanService,
    DistanceMatrixService,
  ],
})
export class IntegrationsModule {}
