-- https://www.youtube.com/watch?v=x5faT66jmG4


PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS Like;
DROP TABLE IF EXISTS Comment;
DROP TABLE IF EXISTS Image;
DROP TABLE IF EXISTS Article;
DROP TABLE IF EXISTS User;
DROP TABLE IF EXISTS Notification;
DROP TABLE IF EXISTS SecurityQuestion;

CREATE TABLE SecurityQuestion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL
);

CREATE TABLE User (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL CHECK(length(username) BETWEEN 3 AND 32),
    password_hash TEXT NOT NULL CHECK(length(password_hash) <= 255),
    real_name TEXT NOT NULL CHECK(length(real_name) <= 64),
    date_of_birth DATE NOT NULL,
    description TEXT CHECK(length(description) <= 500),
    avatar_url TEXT CHECK(length(avatar_url) <= 255),
    is_admin BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    security_question_id INTEGER REFERENCES SecurityQuestion(id),
    security_answer TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Article (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER NOT NULL,
    title TEXT NOT NULL CHECK(length(title) <= 150),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    header_image_url TEXT CHECK(length(header_image_url) <= 255),
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (author_id) REFERENCES User(id) ON DELETE CASCADE
);

CREATE TABLE Image (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    FOREIGN KEY (article_id) REFERENCES Article(id) ON DELETE CASCADE
);

CREATE TABLE Comment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    parent_comment_id INTEGER,
    content TEXT NOT NULL CHECK(length(content) <= 1000),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (article_id) REFERENCES Article(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES User(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES Comment(id) ON DELETE CASCADE
);

CREATE TABLE Like (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER,
    user_id INTEGER NOT NULL,
    comment_id INTEGER,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (article_id) REFERENCES Article(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES Comment(id) ON DELETE CASCADE
);

CREATE TABLE Notification (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_id INTEGER NOT NULL,         -- Article author
    actor_id INTEGER NOT NULL,             -- User who liked the article
    article_id INTEGER,                    -- The liked article
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (recipient_id) REFERENCES User(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES User(id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES Article(id) ON DELETE CASCADE
);

-- Adding index for performance
CREATE INDEX idx_article_author ON Article(author_id);
CREATE INDEX idx_image_article ON Image(article_id);
CREATE INDEX idx_comment_article ON Comment(article_id);
CREATE INDEX idx_comment_author ON Comment(author_id);
CREATE INDEX idx_comment_parent ON Comment(parent_comment_id);
CREATE INDEX idx_like_article ON Like(article_id);
CREATE INDEX idx_like_comment ON Like(comment_id);
CREATE INDEX idx_like_user ON Like(user_id);
CREATE INDEX idx_notification_recipient ON Notification(recipient_id);
