import { getDatabase } from "./database.js";

/**
 * Get statistics for a specific user
 * @param {number} userId - The user ID
 * @returns {Promise<{total_posts: number, total_likes: number}>}
 */

export async function getUserStats(userId){
    const db = await getDatabase();

    //total posts
    const postsResult = await db.get(
        `SELECT COUNT(*) as total_posts
        FROM Article
        WHERE author_id = ? AND is_active = 1
        `,
        userId
    );

    //total likes
    const likesResult = await db.get(
        `SELECT COUNT(Like.id) as total_likes
         FROM Article
         LEFT JOIN Like ON Like.article_id = Article.id 
                        AND Like.is_active = 1 
                        AND Like.comment_id IS NULL
         WHERE Article.author_id = ? AND Article.is_active = 1`,
        userId
    );
    return{
        total_posts: postsResult?.total_posts || 0,
        total_likes: likesResult?.total_likes || 0
    };
}

export async function getTopArticlesByUser(userId, limit = 5){
    const db = await getDatabase();
    const result = await db.all(
        `SELECT 
            Article.id,
            Article.title,
            COUNT(Like.id) as like_count
         FROM Article
         LEFT JOIN Like ON Like.article_id = Article.id 
                        AND Like.is_active = 1 
                        AND Like.comment_id IS NULL
         WHERE Article.author_id = ? AND Article.is_active = 1
         GROUP BY Article.id, Article.title
         ORDER BY like_count DESC, Article.created_at DESC
         LIMIT ?`,
         userId,
         limit
    );

    return result || [];
}