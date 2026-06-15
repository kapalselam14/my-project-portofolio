import express from "express";
import multer from "multer";
import {
    createArticle,
    createImages,
    retrieveArticles,
    countArticlesForAuthorId,
    retrieveArticleById,
    updateArticle,
    deleteArticle,
    softDeleteArticle,
    retrieveImagesByArticleId
} from "../../data/articles-dao.js";
import { requireAuth, requireSelfOrAdmin } from "../../middleware/auth-middleware.js";
import { getArticlesLikedByUser } from "../../data/articles-dao.js";
import { countLikesForArticle } from "../../data/likes-dao.js";
import { retrieveCommentsByArticleId } from "../../data/comments-dao.js";

const router = express.Router();

// Multer config for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/uploads/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"));
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB file size limit
});

// POST /api/articles/upload-images (upload images without creating article)
router.post("/upload-images", requireAuth, upload.fields([
    { name: "headerImage", maxCount: 1 },
    { name: "images", maxCount: 25 }
]), async (req, res) => {
    try {
        const uploadedUrls = {
            headerImageUrl: null,
            embeddedImageUrls: []
        };

        // Process header image
        if (req.files.headerImage && req.files.headerImage[0]) {
            uploadedUrls.headerImageUrl = "/uploads/" + req.files.headerImage[0].filename;
        }

        // Process embedded images
        if (req.files.images) {
            uploadedUrls.embeddedImageUrls = req.files.images.map(
                img => "/uploads/" + img.filename
            );
        }

        return res.status(200).json(uploadedUrls);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /api/articles (with images, auth required)
router.post("/", requireAuth, upload.fields([
    { name: "headerImage", maxCount: 1 },
    { name: "images", maxCount: 25 }
]), async (req, res) => {
    try {
        const { title, content } = req.body;
        const author_id = req.user.id;
        let header_image_url = null;
        if (req.files.headerImage && req.files.headerImage[0]) {
            header_image_url = "/uploads/" + req.files.headerImage[0].filename;
        }
        const newArticle = await createArticle({
            author_id,
            title,
            content,
            header_image_url
        });

        // Save embedded images if present
        if (req.files.images) {
            for (const img of req.files.images) {
                await createImages({
                    article_id: newArticle.id,
                    url: "/uploads/" + img.filename
                });
            }
        }

        const location = `/api/articles/${newArticle.id}`;
        return res.status(201).location(location).json({
            message: `Article created with ID: ${newArticle.id}`,
            article: newArticle
        });
    } catch (err) {
        return res.status(422).json({ error: err.message });
    }
});


// GET /api/articles (search & sort & filter by authorId)
router.get("/", async (req, res) => {
    try {
        const { search, authorId, sortBy, sortOrder } = req.query;

        // Validate sortBy parameter (only allow specific values)
        const validSortBy = ['title', 'username', 'date'];
        const finalSortBy = validSortBy.includes(sortBy) ? sortBy : 'date';

        // Validate sortOrder parameter (only allow asc or desc)
        const finalSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

        const articles = await retrieveArticles({
            search,
            authorId,
            sortBy: finalSortBy,
            sortOrder: finalSortOrder
        });
        // return res.json(articles);
        const articlesWithStats = await Promise.all(articles.map(async (a) => {
            const likes = await countLikesForArticle(a.id);
            let comments = [];
            try {
                comments = await retrieveCommentsByArticleId(a.id);
            } catch (err) {
                // If no comments, use empty array
                comments = [];
            }
            return { ...a, likes, comments: comments.length };
        }));
        return res.json(articlesWithStats);
    } catch (err) {
        return res.status(404).json({ error: `Can't find articles`, details: err.message });
    }
});

// Count articles for a specific author
router.get("/author/:authorId/count", async (req, res) => { // this needs to be before the "/:articleId" route
    try {
        const authorId = req.params.authorId;
        const count = await countArticlesForAuthorId(authorId);
        return res.json({ authorId, articleCount: count });
    } catch (err) {
        return res.status(404).json({ error: `Can't count articles for author ID: ${authorId}`, details: err.message });
    }
});

// GET /api/articles/:articleId
router.get("/:articleId", async (req, res) => {
    const articleId = req.params.articleId;
    try {
        const article = await retrieveArticleById(articleId);
        console.log("Retrieved article:", article);
        const images = await retrieveImagesByArticleId(articleId);
        return res.json({ message: `Requested article with ID: ${articleId}`, article, images });
    } catch (err) {
        return res.status(404).json({ error: `Can't find article with ID: ${articleId}`, details: err.message });
    }
});

// GET /api/articles/liked/:userId - for liked article history
router.get("/liked/:userId", requireAuth, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }
        const articles = await getArticlesLikedByUser(userId);
        return res.json(articles);
    } catch (err) {
        return res.status(500).json({ error: "Unable to fetch liked articles", details: err.message });
    }
});

// only author himself or admin can update or delete the article

// PUT /api/articles/:articleId (auth required)
router.put("/:articleId", requireAuth, async (req, res) => {
    try {
        const { articleId } = req.params;
        const article = await retrieveArticleById(articleId);

        if (article.author_id !== req.user.id && !req.user.is_admin) {
            return res.status(403).json({
                error: "You don't have permission to edit this article"
            });
        }

        const isUpdated = await updateArticle(articleId, req.body);
        if (isUpdated) {
            const updatedArticle = await retrieveArticleById(articleId);
            return res.json({ message: `Article with ID: ${articleId} updated`, article: updatedArticle });
        }
        return res.sendStatus(404);
    } catch (err) {
        return res.status(422).json({ error: err.message });
    }
});

// DELETE /api/articles/:articleId (auth required)
router.delete("/:articleId", requireAuth, async (req, res) => {
    try {
        const { articleId } = req.params;
        const article = await retrieveArticleById(articleId);

        if (article.author_id !== req.user.id && !req.user.is_admin) {
            return res.status(403).json({
                error: "You don't have permission to delete this article"
            });
        }
        if (req.query.hard === "1" || req.query.hard === "true") {
            await deleteArticle(articleId); //permanent delete
        } else {
            await softDeleteArticle(articleId); //soft delete when user is deleted
        }
        return res.sendStatus(204);
    } catch (err) {
        return res.status(422).json({ error: err.message });
    }
});


import articleCommentsRoutes from "./articles/api-articles-comments.js";
router.use("/:articleId/comments", articleCommentsRoutes);

import articleLikesRoutes from "./articles/api-articles-likes.js";
router.use("/:articleId/likes", articleLikesRoutes);

import articleImagesRoutes from "./articles/api-articles-images.js";
router.use("/:articleId/images", articleImagesRoutes);

export default router;