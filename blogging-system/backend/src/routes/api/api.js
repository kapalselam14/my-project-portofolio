import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  return res.json({ message: "Welcome to the API root!" });
});

// import child routes
// import imageRoutes from "./api-images.js";
// router.use("/images", imageRoutes);

import articleRoutes from "./api-articles.js";
router.use("/articles", articleRoutes);

import commentRoutes from "./api-comments.js";
router.use("/comments", commentRoutes);

import userRoutes from "./api-users.js";
router.use("/users", userRoutes);

import authRoutes from "./api-auth.js";
router.use("/", authRoutes);

// Notifications routes
import notificationRoutes from "./api-notifications.js";
router.use("/notifications", notificationRoutes);

export default router;
