import yup from "yup";
import { getDatabase } from "./database.js";
import { updateDatabase } from "./util.js";

// ARTICLE-related
// ====CREATE====
// Create articles
const createArticleSchema = yup
    .object({
        author_id: yup.number().required(),
        title: yup.string().required(),
        content: yup.string().required(),
        header_image_url: yup.string().nullable()
    }).required();

export async function createArticle(articleData) {
    const newArticle = createArticleSchema.validateSync(articleData, {
        abortEarly: false,
        stripUnknown: true
    });
    const db = await getDatabase();
    const dbResult = await db.run("INSERT INTO Article(author_id, title, content, header_image_url, is_active) VALUES(?, ?, ?, ?, 1)",
        newArticle.author_id,
        newArticle.title,
        newArticle.content,
        newArticle.header_image_url
    );
    newArticle.id = dbResult.lastID;
    return newArticle;
}


// ====READ====
// Get all articles - supports search logic too
export async function retrieveArticles({ search = "", sortBy = "date", sortOrder = "desc", authorId = null } = {}) {
    const db = await getDatabase();
    
    // Base query with INNER JOIN to User table for username sorting
    // INNER JOIN ensures we only get articles with valid authors
    let sql = `
        SELECT Article.*, User.username, User.avatar_url AS avatar_url
        FROM Article 
        INNER JOIN User ON Article.author_id = User.id 
        WHERE Article.is_active = 1 AND User.is_active = 1
    `;
    
    let params = [];
    if (authorId) {
        sql += " AND author_id = ?";
        params.push(authorId);
    }

    if (search) {
        sql += " AND (LOWER(Article.title) LIKE ? OR LOWER(Article.content) LIKE ?)";
        params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
    }
    
    // Add sorting based on sortBy parameter
    if (sortBy === "title") {
        sql += ` ORDER BY Article.title ${sortOrder.toUpperCase()}`;
    } else if (sortBy === "username") {
        sql += ` ORDER BY User.username ${sortOrder.toUpperCase()}`;
    } else {
        // Default: sort by date (using created_at for when article was posted)
        sql += ` ORDER BY Article.created_at ${sortOrder.toUpperCase()}`;
    }
    
    return db.all(sql, ...params);
}

// Get active article by ID
export async function retrieveArticleById(id) {
    const db = await getDatabase();
    const article = await db.get("SELECT * FROM Article WHERE id = ? AND is_active = 1", parseInt(id));
    if (!article) {
        throw new Error(`Article with id ${id} does not exist!`);
    }
    return article;
}

// Count all articles for author id
export async function countArticlesForAuthorId(authorId) {
    const db = await getDatabase();
    const result = await db.get("SELECT COUNT(*) as count FROM Article WHERE author_id = ? AND is_active = 1", parseInt(authorId));
    return result.count;
}

// Get all active articles liked by the user
export async function getArticlesLikedByUser(userId) {
    const db = await getDatabase();
    return db.all("SELECT Article.* FROM Article JOIN Like ON Like.article_id = Article.id WHERE Like.user_id = ? AND Like.is_active = 1 AND Article.is_active = 1 ORDER BY Article.updated_at DESC", userId);
}

// =====UPDATE====
// Update article
const updateArticleSchema = yup
    .object({
        title: yup.string().required(),
        content: yup.string().required(),
        header_image_url: yup.string().nullable()
    }).required();

export async function updateArticle(article_id, updateData) {
    const validatedUpdateData = updateArticleSchema.validateSync(updateData, {
        abortEarly: false,
        stripUnknown: true
    });
    const db = await getDatabase();
    const dbResult = await updateDatabase(db, "Article", validatedUpdateData, parseInt(article_id));
    return dbResult.changes > 0;
}


// =====DELETE====
// Hard delete articles with article id (when user/admin want to delete permanently)
export async function deleteArticle(article_id) {
    const db = await getDatabase();
    // Soft delete
    const dbResult = await db.run("UPDATE Article SET is_active = 0 WHERE id = ?", parseInt(article_id));
    return dbResult.changes > 0;
}

// Soft delete article when user is deleted
export async function softDeleteArticle(article_id) {
    const db = await getDatabase();
    const dbResult = await db.run("UPDATE Article SET is_active = 0 WHERE id = ?", parseInt(article_id));
    return dbResult.changes > 0;
}


// IMAGE-related
// Create images for article
const createImageSchema = yup
    .object({
        article_id: yup.number().required(),
        url: yup.string().nullable(),
    }).required();

export async function createImages(ImageData) {
    const newImage = createImageSchema.validateSync(ImageData, {
        abortEarly: false,
        stripUnknown: true
    });
    const db = await getDatabase();
    const dbResult = await db.run(
        "INSERT INTO Image(article_id, url) VALUES(?, ?)",
        newImage.article_id,
        newImage.url
    );
    newImage.id = dbResult.lastID;
    return newImage;
}

// Retrieve images by article id
export async function retrieveImagesByArticleId(article_id) {
    const db = await getDatabase();
    return db.all("SELECT * FROM Image WHERE article_id = ?", article_id);
}


// Remove Images from the article with image id
export async function removeImage(image_id) {
    const db = await getDatabase();
    const dbResult = await db.run("DELETE FROM Image WHERE id = ?", parseInt(image_id));
    return dbResult.changes > 0;
}