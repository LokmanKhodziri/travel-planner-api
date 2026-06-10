import "dotenv/config";
import app from "./app.js";

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST ?? "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Travel Planner API listening on http://${HOST}:${PORT}`);
});
