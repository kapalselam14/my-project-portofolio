import express from "express";
import {
    updateComment,
    retrieveCommentById,
    removeComment,
    softRemoveComment
} from "../../data/comments-dao.js";
import { requireAuth, requireSelfOrAdmin } from "../../middleware/auth-middleware.js";

const router = express.Router();

// only commentAuthor or admin can update or delete comment

router.put("/:commentId", requireAuth, requireSelfOrAdmin, async (req, res) => {
    try {
        const { commentId } = req.params;
        const comment = await retrieveCommentById(commentId);

        if (comment.author_id !== req.user.user_id && !req.user.is_admin) {
            return res.status(403).json({
                error: "You don't have permission to edit this comment"
            });
        }
        const isUpdated = await updateComment(commentId, req.body);
        if (isUpdated) {
            const updatedComment = await retrieveCommentById(commentId);
            return res.json({ message: `Comment with ID: ${commentId} updated`, comment: updatedComment });
        } return res.sendStatus(404);
    } catch (err) {
        return res.status(422).json({ error: err.message });
    }
});

router.delete("/:commentId", requireAuth, requireSelfOrAdmin, async (req, res) => {
    try {
        const { commentId } = req.params;
        const comment = await retrieveCommentById(commentId);
        
        if (comment.author_id !== req.user.user_id && !req.user.is_admin) {
            return res.status(403).json({
                error: "You don't have permission to delete this comment"
            });
        }

        if (req.query.hard === "1" || req.query.hard === "true") {
            await removeComment(req.params.commentId); // permanent delete
        } else {
            await softRemoveComment(req.params.commentId); //soft delete when user is deleted
        }
        return res.sendStatus(204);
    } catch (err) {
        return res.status(422).json({ error: err.message });
    }
});


import commentLikesRoutes from "./comments/api-comments-likes.js";
router.use("/:commentId/likes", commentLikesRoutes);

export default router;