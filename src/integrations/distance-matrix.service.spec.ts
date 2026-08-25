import {
  parseTravelMode,
  resolveTravelMode,
  WALKING_AUTO_THRESHOLD_METERS,
} from "./distance-matrix.service";

describe("parseTravelMode", () => {
  it("accepts walking, driving, and transit", () => {
    expect(parseTravelMode("walking")).toBe("walking");
    expect(parseTravelMode("transit")).toBe("transit");
  });

  it("defaults to driving", () => {
    expect(parseTravelMode("bike")).toBe("driving");
    expect(parseTravelMode(undefined)).toBe("driving");
  });
});

describe("resolveTravelMode", () => {
  const klcc = { latitude: 3.1579, longitude: 101.7116 };
  const nearby = { latitude: 3.1583, longitude: 101.712 };

  it("auto-switches short hops to walking", () => {
    const result = resolveTravelMode("driving", klcc, nearby);
    expect(result.mode).toBe("walking");
    expect(result.autoWalk).toBe(true);
    expect(WALKING_AUTO_THRESHOLD_METERS).toBe(800);
  });

  it("keeps the preferred mode for longer hops", () => {
    const far = { latitude: 3.2, longitude: 101.8 };
    expect(resolveTravelMode("transit", klcc, far)).toEqual({
      mode: "transit",
      autoWalk: false,
    });
  });
});
