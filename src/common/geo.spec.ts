import { distanceMeters, resolveTripCoordinates } from "./geo";

describe("distanceMeters", () => {
  it("returns ~0 for the same point", () => {
    expect(distanceMeters(3.139, 101.687, 3.139, 101.687)).toBeCloseTo(0, 5);
  });

  it("computes a sensible distance between nearby KL points", () => {
    const meters = distanceMeters(3.139, 101.687, 3.1478, 101.6953);
    expect(meters).toBeGreaterThan(1000);
    expect(meters).toBeLessThan(2000);
  });
});

describe("resolveTripCoordinates", () => {
  it("prefers explicit destination coordinates", () => {
    expect(
      resolveTripCoordinates({
        destinationLat: 3.14,
        destinationLng: 101.69,
        destinationCity: "Kuala Lumpur",
        locations: [{ latitude: 1, longitude: 2 }],
      }),
    ).toEqual({
      latitude: 3.14,
      longitude: 101.69,
      city: "Kuala Lumpur",
    });
  });

  it("averages saved locations when destination is missing", () => {
    expect(
      resolveTripCoordinates({
        destinationLat: null,
        destinationLng: null,
        destinationCity: "Penang",
        locations: [
          { latitude: 5.4, longitude: 100.3 },
          { latitude: 5.6, longitude: 100.5 },
        ],
      }),
    ).toEqual({
      latitude: 5.5,
      longitude: 100.4,
      city: "Penang",
    });
  });

  it("returns null when there is no destination and no locations", () => {
    expect(
      resolveTripCoordinates({
        destinationLat: null,
        destinationLng: null,
        destinationCity: null,
        locations: [],
      }),
    ).toBeNull();
  });
});
