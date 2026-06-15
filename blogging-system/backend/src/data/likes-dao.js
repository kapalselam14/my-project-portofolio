import yup from "yup";
import { getDatabase } from "./database.js";

// ====CREATE====
// Add like to article or comment
const createLikeSchema = yup
    .object({
        article_id: yup.number().nullable().transform((value, originalValue) => {
            return originalValue === null || originalValue === undefined ? null : value;
        }),
        user_id: yup.number().required(),
        comment_id: yup.number().nullable().transform((value, originalValue) => {
            return originalValue === null || originalValue === undefined ? null : value;
        }),
        is_active: yup.boolean().default(true)
    })
    .test('article-or-comment', 'Either article_id or comment_id must be provided', function(value) {
        return value.article_id !== null || value.comment_id !== null;
    })
    .required();

// ====READ====
// Get all likes by article id
export async function retrieveLikesByArticleId(article_id) {
    const db = await getDatabase();
    const articleLikes = await db.all("SELECT * FROM Like WHERE article_id = ? AND is_active = 1", article_id);
    return articleLikes;
}

// Get all likes by comment id
export async function retrieveLikesByCommentId(comment_id) {
    const db = await getDatabase();
    const commentLikes = await db.all("SELECT * FROM Like WHERE comment_id = ? AND is_active = 1", comment_id);
    return commentLikes;
}

// Find like by user id and article id (optionally include inactive likes)
export async function findLikeByUserAndArticle(user_id, article_id, activeOnly = true) {
    const db = await getDatabase();
    if (activeOnly) {
        return db.get("SELECT * FROM Like WHERE user_id = ? AND article_id = ? AND comment_id IS NULL AND is_active = 1", user_id, article_id);
    } else {
        return db.get("SELECT * FROM Like WHERE user_id = ? AND article_id = ? AND comment_id IS NULL", user_id, article_id);
    }
}

// Find like by user id and comment id (optionally include inactive likes)
export async function findLikeByUserAndComment(user_id, comment_id, activeOnly = true) {
    const db = await getDatabase();
    if (activeOnly) {
        return db.get("SELECT * FROM Like WHERE user_id = ? AND comment_id = ? AND is_active = 1", user_id, comment_id);
    } else {
        return db.get("SELECT * FROM Like WHERE user_id = ? AND comment_id = ?", user_id, comment_id);
    }
}

// Count all active likes for an article
export async function countLikesForArticle(articleId) {
    const db = await getDatabase();
    const result = await db.get("SELECT COUNT(*) as count FROM Like WHERE article_id = ? AND comment_id IS NULL AND is_active = 1", articleId);
    return result.count;
}

// Count all active likes for a comment
export async function countLikesForComment(commentId) {
    const db = await getDatabase();
    const result = await db.get(
        "SELECT COUNT(*) as count FROM Like WHERE comment_id = ? AND is_active = 1", 
        commentId
    );
    return result.count;
}


// Soft remove like (set is_active = 0)
export async function softRemoveLike(like_id) {
    const db = await getDatabase();
    const dbResult = await db.run("UPDATE Like SET is_active = 0 WHERE id = ?", parseInt(like_id));
    return dbResult.changes > 0;
}

// Add like to article or comment (handles reactivation)
export async function addLike(likeData) {
    console.log("Incoming like data:", likeData);
    const db = await getDatabase();
    // Validate input - declare newLike before try block
    let newLike;
    try {
        newLike = createLikeSchema.validateSync(likeData, {
            abortEarly: false,
            stripUnknown: true
        });
        console.log("Validated like:", newLike);
    } catch (err) {
        throw new Error("Invalid like data: " + err.errors?.join(", "));
    }

    // Check if already liked (active)
    let existingLike;
    if (newLike.comment_id) {
        existingLike = await findLikeByUserAndComment(newLike.user_id, newLike.comment_id, true);
    } else {
        existingLike = await findLikeByUserAndArticle(newLike.user_id, newLike.article_id, true);
    }
    if (existingLike) {
        return existingLike;
    }

    // Check for soft-removed like (inactive)
    let softRemovedLike;
    if (newLike.comment_id) {
        softRemovedLike = await findLikeByUserAndComment(newLike.user_id, newLike.comment_id, false);
        if (softRemovedLike && softRemovedLike.is_active === 0) {
            await db.run("UPDATE Like SET is_active = 1 WHERE id = ?", softRemovedLike.id);
            return await db.get("SELECT * FROM Like WHERE id = ?", softRemovedLike.id);
        }
    } else {
        softRemovedLike = await findLikeByUserAndArticle(newLike.user_id, newLike.article_id, false);
        if (softRemovedLike && softRemovedLike.is_active === 0) {
            await db.run("UPDATE Like SET is_active = 1 WHERE id = ?", softRemovedLike.id);
            return await db.get("SELECT * FROM Like WHERE id = ?", softRemovedLike.id);
        }
    }

    // Insert new like
    const result = await db.run(
        "INSERT INTO Like(article_id, user_id, comment_id, is_active) VALUES(?, ?, ?, 1)",
        newLike.article_id,
        newLike.user_id,
        newLike.comment_id
    );
    return await db.get("SELECT * FROM Like WHERE id = ?", result.lastID);
}