import { chromium } from "playwright";
import "dotenv/config";

async function main() {
  const { TEST_JWT } = process.env;
  if (!TEST_JWT) {
    console.error("Set TEST_JWT env var to the jwt token to use");
    process.exit(2);
  }
  const TRIP_ID = process.env.TEST_TRIP_ID ?? "";
  if (!TRIP_ID) {
    console.error("Set TEST_TRIP_ID env var to the trip id to open");
    process.exit(2);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.context().addCookies([
    {
      name: "jwt",
      value: TEST_JWT,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  const url = `http://localhost:3001/trips/${TRIP_ID}`;
  await page.goto(url, { waitUntil: "networkidle" });
  const html = await page.content();
  console.log(html.slice(0, 20000));

  // Check for Nearby panel placeholders
  const nearbyText = await page.locator("text=Nearby").count();
  console.log("nearbyTabCount=", nearbyText);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
