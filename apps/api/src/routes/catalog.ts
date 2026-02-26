import { Router } from "express";
import { getPhoneCatalog } from "../data/phoneCatalog.js";
import { requireAuth } from "../middleware/auth.js";

export const catalogRouter = Router();

catalogRouter.use(requireAuth);

catalogRouter.get("/phone-models", (_req, res) => {
  res.json({ catalog: getPhoneCatalog() });
});
