import express from "express";
import {
    addLike,
    findLikeByUserAndArticle,
    countLikesForArticle,
    softRemoveLike
} from "../../../data/likes-dao.js";
import { requireAuth } from "../../../middleware/auth-middleware.js";
import { retrieveArticleById } from "../../../data/articles-dao.js";
import { getUserById } from "../../../data/user-dao.js";
import { createNotification, findActiveLikeNotification } from "../../../data/notifications-dao.js";
import { publishToUser } from "../../../utils/notification-bus.js";
import { enrichNotification } from "../../../utils/enrich-notification.js";

const router = express.Router({ mergeParams: true });

// Public endpoint: get like count (no auth required)
router.get("/count", async (req, res) => {
    try {
        const { articleId } = req.params;
        const likesCount = await countLikesForArticle(articleId);
        return res.json({ likesCount });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// get like status for current user
router.get("/", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { articleId } = req.params;

        const existingLike = await findLikeByUserAndArticle(userId, articleId);
        const likesCount = await countLikesForArticle(articleId);

        return res.json({
            liked: !!existingLike,
            likesCount
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// user needs to login to like and unlike; only one like per article
router.post("/", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { articleId } = req.params;
        const existingLike = await findLikeByUserAndArticle(userId, articleId);
        if (existingLike) {
            return res.status(200).json({ message: `User already liked the article` });
        }
        const newLike = await addLike({
            article_id: articleId,
            user_id: userId,
            comment_id: null
        });

        // Only send notification for article.like if not already sent
        try {
            const article = await retrieveArticleById(articleId);
            if (article && article.author_id !== userId) {
                // Check for existing active like notification
                const existingNotif = await findActiveLikeNotification({
                    actor_id: userId,
                    recipient_id: article.author_id,
                    article_id: parseInt(articleId)
                });
                if (!existingNotif) {
                    const user = await getUserById(userId);
                    const notification = await createNotification({
                        actor_id: userId,
                        recipient_id: article.author_id,
                        article_id: parseInt(articleId),
                        type: "article.like",
                        message: `${user.username} liked your article \"${article.title}\"`,
                        link: `/articles/${articleId}`
                    });
                    // Enrich notification for SSE
                    notification.actor_username = user.username;
                    notification.article_title = article.title;
                    const enrichedNotification = enrichNotification(notification);
                    publishToUser(article.author_id, enrichedNotification);
                }
            }
        } catch (notifErr) {
            // Don't fail the like if notification fails
            console.error("Notification creation failed:", notifErr.message);
        }

        const location = `/api/articles/${articleId}/likes`;
        return res.status(201).location(location).json({ message: `Like added successfully`, like: newLike });
    } catch (err) {
        return res.status(422).json({ error: err.message });
    }
});



// router.get("/", async (req, res) => {
//     try {
//         const articleId = req.params.articleId;
//         const likesCount = await countLikesForArticle(articleId);
//         return res.json({ message: `Total likes for article with ID: ${articleId}`, likesCount });
//     } catch (err) {
//         return res.status(404).json({ error: `Can't count likes for article ID: ${articleId}`, details: err.message });
//     }
// });


router.delete("/", requireAuth, async (req, res) => {
    try {
        // const userId = req.user.user_id;
        const userId = req.user.id;
        const { articleId } = req.params;

        const existingLike = await findLikeByUserAndArticle(userId, articleId);
        if (!existingLike) {
            return res.status(404).json({ message: `Like not found on this article` });
        }
        // Always use soft remove for user unlike (preserve like record for notification logic)
        await softRemoveLike(existingLike.id);
        return res.sendStatus(204);
    } catch (err) {
        return res.status(422).json({ error: err.message });
    }
});

export default router;
