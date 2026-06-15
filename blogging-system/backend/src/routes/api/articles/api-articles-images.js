import express from "express";
import { createImages, removeImage, retrieveImagesByArticleId } from "../../../data/articles-dao.js";
import { retrieveArticleById } from "../../../data/articles-dao.js";
import { requireAuth } from "../../../middleware/auth-middleware.js";

const router = express.Router({ mergeParams: true });

// GET /api/articles/:articleId/images
router.get("/", async (req, res) => {
    try {
        const articleId = req.params.articleId;
        const images = await retrieveImagesByArticleId(articleId);
        return res.json(images);
    } catch (err) {
        return res.status(404).json({ error: `Can't find images for article with ID: ${req.params.articleId}`, details: err.message });
    }
});

// POST /api/articles/:articleId/images - Link uploaded image to article
router.post("/", requireAuth, async (req, res) => {
    try {
        const { articleId } = req.params;
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: "Image URL is required" });
        }

        // Verify article exists
        const article = await retrieveArticleById(articleId);

        // Check authorization
        if (article.author_id !== req.user.id && !req.user.is_admin) {
            return res.status(403).json({
                error: "You don't have permission to add images to this article"
            });
        }

        // Create image entry
        const newImage = await createImages({
            article_id: parseInt(articleId),
            url: url
        });

        return res.status(201).json({
            message: "Image linked to article successfully",
            image: newImage
        });
    } catch (err) {
        console.error("Error linking image to article:", err);
        return res.status(500).json({ error: err.message });
    }
});

// DELETE /api/articles/:articleId/images/:imageId
router.delete("/:imageId", requireAuth, async (req, res) => {
    try {
        const { articleId, imageId } = req.params;
        
        // Verify article exists and check authorization
        const article = await retrieveArticleById(articleId);
        
        if (article.author_id !== req.user.id && !req.user.is_admin) {
            return res.status(403).json({
                error: "You don't have permission to delete images from this article"
            });
        }
        
        await removeImage(parseInt(imageId));
        return res.sendStatus(204);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;