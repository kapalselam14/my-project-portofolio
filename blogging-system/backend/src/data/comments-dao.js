import yup from "yup";
import { getDatabase } from "./database.js";
import { updateDatabase } from "./util.js";


// ====CREATE====
// Add comment to article or comment
const createCommentSchema = yup
    .object({
        article_id: yup.number().required(),
        author_id: yup.number().required(),
        parent_comment_id: yup.number().nullable(), // null if comment on article, else comment on comment
        content: yup.string().max(1000).required()
    }).required();

export async function addComment(commentData) {
    const newComment = createCommentSchema.validateSync(commentData, {
        abortEarly: false,
        stripUnknown: true
    });
    const db = await getDatabase();
    const dbResult = await db.run("INSERT INTO Comment(article_id, author_id, parent_comment_id, content, is_active) VALUES(?, ?, ?, ?, 1)",
        newComment.article_id,
        newComment.author_id,
        newComment.parent_comment_id,
        newComment.content
    );
    newComment.id = dbResult.lastID;
    return newComment;
}

// ====READ====
// Get all active comments
export async function retrieveComments() {
    const db = await getDatabase();
    const comments = await db.all("SELECT * FROM Comment WHERE is_active = 1");
    return comments;
}

// Get active comments by articles id
// export async function retrieveCommentsByArticleId(articleId) {
//     const db = await getDatabase();
//     const comment = await db.all("SELECT * FROM Comment WHERE article_id = ? AND is_active = 1", parseInt(articleId));
//     if (comment.length === 0 || !comment) throw new Error(`Comment not found for article with id ${articleId}`);
//     return comments || [];
// }

export async function retrieveCommentsByArticleId(articleId, limit = null) {
    const db = await getDatabase();
    let query = `
        SELECT 
            Comment.id,
            Comment.content,
            Comment.article_id,
            Comment.parent_comment_id,
            Comment.author_id,
            Comment.created_at,
            User.username,
            User.avatar_url AS avatar_url
        FROM Comment
        LEFT JOIN User ON Comment.author_id = User.id
        WHERE Comment.article_id = ? AND Comment.is_active = 1
        ORDER BY Comment.created_at ASC
    `;
    let params = [parseInt(articleId)];
    if (limit) {
        query += ` LIMIT ?`;
        params.push(parseInt(limit));
    }
    const comments = await db.all(query, ...params);
    return comments || [];
}

// Get active comments by comment id
export async function retrieveCommentById(commentId) {
    const db = await getDatabase();
    const comment = await db.get("SELECT * FROM Comment WHERE is_active = 1 AND id = ?", parseInt(commentId));
    if (!comment) throw new Error("Active comment not found");
    return comment;
}

// ====UPDATE====
// Update comments with comment id
const updateCommentSchema = yup
    .object({
        content: yup.string().max(1000).required()
    }).required();

export async function updateComment(comment_id, updateData) {
    const validatedUpdateData = updateCommentSchema.validateSync(updateData, {
        abortEarly: false,
        stripUnknown: true
    });
    const db = await getDatabase();
    const dbResult = await updateDatabase(db, "Comment", validatedUpdateData, parseInt(comment_id));
    return dbResult.changes > 0;
}


// ====Delete====
// Hard delete comment with comment-id (when user/admin want to delete permanently)
export async function removeComment(commentId) {
    const db = await getDatabase();
    const dbResult = await db.run("DELETE FROM Comment WHERE id = ?", parseInt(commentId));
    return dbResult.changes > 0;
}

// Soft delete comment when user is deleted
export async function softRemoveComment(comment_id) {
    const db = await getDatabase();
    const dbResult = await db.run("UPDATE Comment SET is_active = 0 WHERE id = ?", parseInt(comment_id));
    return dbResult.changes > 0;
}