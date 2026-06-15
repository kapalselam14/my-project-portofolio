import express from "express";
import {
    addLike,
    findLikeByUserAndComment,
    softRemoveLike,
    countLikesForComment
} from "../../../data/likes-dao.js";
import { retrieveArticleById } from "../../../data/articles-dao.js";
import { requireAuth } from "../../../middleware/auth-middleware.js";
import { retrieveCommentById } from "../../../data/comments-dao.js";
import { getUserById } from "../../../data/user-dao.js";
import { createNotification } from "../../../data/notifications-dao.js";
import { publishToUser } from "../../../utils/notification-bus.js";

const router = express.Router({ mergeParams: true });

// get like status for current user
router.get("/", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { commentId } = req.params;
        
        const existingLike = await findLikeByUserAndComment(userId, commentId);
        const likesCount = await countLikesForComment(commentId);
        
        return res.json({
            liked: !!existingLike,
            likesCount
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post("/", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { commentId } = req.params;

        // Check for active like
        const existingLike = await findLikeByUserAndComment(userId, commentId, true);
        if (existingLike) {
            return res.status(200).json({ message: `User already liked the comment` });
        }

        // Check for soft-removed like (inactive)
        const softRemovedLike = await findLikeByUserAndComment(userId, commentId, false);
        let newLike;
        if (softRemovedLike && softRemovedLike.is_active === 0) {
            await softRemoveLike(softRemovedLike.id); // Actually reactivates
            newLike = await findLikeByUserAndComment(userId, commentId, true);
        } else {
            newLike = await addLike({
                article_id: null,
                user_id: userId,
                comment_id: commentId
            });
        }
        // Notification
        try {
            const comment = await retrieveCommentById(commentId);
            let articleTitle = "";
            if (comment && comment.article_id) {
                const article = await retrieveArticleById(comment.article_id);
                articleTitle = article && article.title ? article.title : "";
                console.log("Retrieved article for notification:", article);
            }
            if (comment && comment.author_id !== userId) {
                const user = await getUserById(userId);
                const notification = await createNotification({
                    actor_id: userId,
                    recipient_id: comment.author_id,
                    article_id: parseInt(comment.article_id),
                    comment_id: parseInt(comment.id),
                    type: "comment.like",
                    message: `${user.username} liked your comment on \"${articleTitle}\"`,
                    link: `/articles/${comment.article_id}`
                });
                // Manually add type, message, and link fields to the notification object
                // because these are not stored in the database. This ensures the frontend
                // receives the correct notification type and message for comment likes.
                notification.actor_username = user.username;
                notification.article_title = articleTitle;
                publishToUser(comment.author_id, notification);
            }
        } catch (notifErr) {
            console.error("Notification creation failed:", notifErr.message);
        }

        const location = `/api/comments/${commentId}/likes`;
        return res.status(201).location(location).json({ message: `Like added successfully`, like: newLike });
    } catch (err) {
        console.error("Comment like error:", err.message);
        return res.status(422).json({ error: err.message });
    }
});


router.delete("/", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { commentId } = req.params;
        const existingLike = await findLikeByUserAndComment(userId, commentId);
        if (!existingLike) {
            return res.status(404).json({ message: `Like not found on this comment` });
        }
        // Always use soft remove for user unlike (preserve like record for notification logic)
        await softRemoveLike(existingLike.id);
        return res.sendStatus(204);
    } catch (err) {
        return res.status(404).json({ error: err.message });
    }
});


export default router;