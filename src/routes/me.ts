import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, (req: AuthRequest, res) => {
  res.json(req.user);
});

export default router;
