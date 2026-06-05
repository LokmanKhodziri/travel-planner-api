import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { searchPlaces } from "../services/places.js";

const router = Router();
router.use(requireAuth);

router.get("/search", async (req: AuthRequest, res) => {
  const input =
    typeof req.query.input === "string" ? req.query.input.trim() : "";
  if (!input) {
    res.status(400).json({ error: "input query required" });
    return;
  }

  try {
    const suggestions = await searchPlaces(input);
    res.json(suggestions);
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({
        error: (e as Error).message ?? "Failed to load place suggestions",
      });
  }
});

export default router;
