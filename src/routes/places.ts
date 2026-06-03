import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { autocompletePlaces } from "../services/places.js";

const router = Router();
router.use(requireAuth);

router.get("/search", async (req: AuthRequest, res) => {
  try {
    const input = String(req.query.input ?? "").trim();
    if (!input) {
      res.status(400).json({ error: "input query required" });
      return;
    }

    const suggestions = await autocompletePlaces(input);
    res.json(suggestions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch place suggestions" });
  }
});

export default router;
