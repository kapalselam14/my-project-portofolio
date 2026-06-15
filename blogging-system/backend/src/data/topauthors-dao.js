import { getDatabase } from './database.js';

export async function getTopAuthorsByLikes(limit = 3) {
    const db = await getDatabase();
    const result = await db.all(`
        SELECT 
            User.id,
            User.username,
            User.avatar_url,
            COUNT(DISTINCT Article.id) as article_count,
            COUNT(Like.id) as total_likes
        FROM User
        INNER JOIN Article ON Article.author_id = User.id AND Article.is_active = 1
        LEFT JOIN Like ON Like.article_id = Article.id AND Like.is_active = 1 AND Like.comment_id IS NULL
        WHERE User.is_active = 1
        GROUP BY User.id, User.username, User.avatar_url
        ORDER BY total_likes DESC, article_count DESC
        LIMIT ?
    `, limit);
    return result;
}