import express from "express";
import {
  addComment,
  retrieveCommentsByArticleId,
  retrieveCommentById,
  updateComment,
  removeComment,
  softRemoveComment
} from "../../../data/comments-dao.js";
import { requireAuth } from "../../../middleware/auth-middleware.js";
import { createNotification } from "../../../data/notifications-dao.js";
import { getUserById } from "../../../data/user-dao.js";
import { retrieveArticleById } from "../../../data/articles-dao.js";
import { publishToUser } from "../../../utils/notification-bus.js";

const router = express.Router({ mergeParams: true });

// GET all comments for an article
router.get("/", async (req, res) => {
  try {
    const { articleId } = req.params;
    const parsedArticleId = parseInt(articleId);

    console.log(`Fetching comments for article ${parsedArticleId}`);

    // call the DAO function
    const comments = await retrieveCommentsByArticleId(parsedArticleId);

    console.log(`Found ${comments.length} comments for article ${parsedArticleId}:`, comments);

    return res.status(200).json(comments);
  } catch (err) {
    console.error("Error fetching comments:", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST new comment (requires auth)
router.post("/", requireAuth, async (req, res) => {
  try {
    const { articleId } = req.params;
    const parsedArticleId = parseInt(articleId);
    const userId = req.user.id;
    const { content, parent_comment_id } = req.body;
    // add comment (schema expects author_id)
    console.log(`Creating comment for article ${parsedArticleId} by user ${userId}`);

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    // Only notify for:
    // - Top-level comment on article (parent_comment_id null): notify article author (if not self)
    // - Reply to a comment (parent_comment_id set): notify parent comment author (if not self)
    const newComment = await addComment({
      article_id: parsedArticleId,
      author_id: userId,
      content: content.trim(),
      parent_comment_id: parent_comment_id || null
    });

    console.log(`Comment created with ID ${newComment.id}`);

    // Create notification
    try {
      const user = await getUserById(userId);
      const article = await retrieveArticleById(parsedArticleId);
      if (parent_comment_id) {
        // This is a reply to a comment
        const parentComment = await retrieveCommentById(parent_comment_id);
        if (parentComment && parentComment.author_id !== userId) {
          const notification = await createNotification({
            actor_id: userId,
            recipient_id: parentComment.author_id,
            article_id: parsedArticleId,
            comment_id: parent_comment_id,
            type: "comment.reply",
            message: `${user.username} replied to your comment`,
            link: `/articles/${parsedArticleId}`
          });
          notification.actor_username = user.username;
          notification.article_title = article ? article.title : "";
          publishToUser(parentComment.author_id, notification);
        }
      } else {
        // Top-level comment on article
        if (article && article.author_id !== userId) {
          const notification = await createNotification({
            actor_id: userId,
            recipient_id: article.author_id,
            article_id: parsedArticleId,
            type: "article.comment",
            message: `${user.username} commented on your article`,
            link: `/articles/${parsedArticleId}`
          });
          notification.actor_username = user.username;
          notification.article_title = article.title;
          publishToUser(article.author_id, notification);
        }
      }
    } catch (notifErr) {
      console.error("Notification creation failed:", notifErr.message);
    }

    return res.status(201).json(newComment);
  } catch (err) {
    console.error("Error creating comment:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET single comment by ID
router.get("/:commentId", async (req, res) => {
  try {
    const { commentId } = req.params;
    const comment = await retrieveCommentById(parseInt(commentId));
    return res.status(200).json(comment);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
});

// UPDATE comment (requires auth + ownership)
router.patch("/:commentId", requireAuth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const { content } = req.body;

    const existingComment = await retrieveCommentById(parseInt(commentId));
    if (existingComment.author_id !== userId) {
      return res.status(403).json({ error: "You can only edit your own comments" });
    }

    const updated = await updateComment(parseInt(commentId), { content });
    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE comment (requires auth + ownership)
router.delete("/:commentId", requireAuth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const { hard } = req.query;


    const existingComment = await retrieveCommentById(parseInt(commentId));
    // Fetch the article to check for article author
    const article = await retrieveArticleById(existingComment.article_id);
    const isCommentAuthor = existingComment.author_id === userId;
    const isArticleAuthor = article.author_id === userId;
    const isAdmin = !!req.user.is_admin;
    if (!isCommentAuthor && !isArticleAuthor && !isAdmin) {
      return res.status(403).json({ error: "You can only delete your own comments or comments on your article" });
    }

    if (hard === "1" || hard === "true") {
      await removeComment(parseInt(commentId));
    } else {
      await softRemoveComment(parseInt(commentId));
    }

    return res.sendStatus(204);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
