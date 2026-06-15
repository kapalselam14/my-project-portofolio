import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import fs from "fs";
import bcrypt from "bcrypt";

/** @type Database<sqlite3.Database, sqlite3.Statement> */
let db;

/**
 * Opens the database if it's not already open, then returns it.
 *
 * @returns {Promise<Database<sqlite3.Database, sqlite3.Statement>>} the database
 */
export async function getDatabase() {
  if (!db) {
    db = await openDatabase();
  }
  return db;
}

/**
 * Opens the database identified in the DB_FILENAME env variable.
 * Then, if it didn't already exist, initializes it.
 *
 * @returns {Promise<Database<sqlite3.Database, sqlite3.Statement>>} the database
 */
async function openDatabase() {
  const dbExists = fs.existsSync(process.env.DB_FILENAME);
  const db = await open({
    filename: process.env.DB_FILENAME,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.exec("PRAGMA foreign_keys = ON");

  if (!dbExists) {
    console.log(`Database ${process.env.DB_FILENAME} doesn't exist.`);
    await initDatabase(db);
  }

  return db;
}

/**
 * Initializes the database using the init script provided in the DB_INIT_SCRIPT env variable.
 *
 * @param {Database<sqlite3.Database, sqlite3.Statement>} db the database to initialize
 */
async function initDatabase(db) {
  const initScript = process.env.DB_INIT_SCRIPT;
  console.log(`Initializing database using init script ${initScript}`);
  const sql = fs.readFileSync(initScript).toString();
  await db.exec(sql);
  console.log("Database initialized successfully!");
  const seedScript = process.env.DB_SEED_SCRIPT;
  console.log(`Initializing seed script ${seedScript}`);
  await db.exec(fs.readFileSync(seedScript).toString());
  console.log("Database seeded successfully!");

  // create default users with hashed passwords
  await createDefaultUsers(db);
}

/**
 * Creates two default users (admin and normal user) with properly hashed passwords
 * These users can be used to login and test the application
 *
 * @param {Database<sqlite3.Database, sqlite3.Statement>} db the database
 */
async function createDefaultUsers(db) {
  console.log("Creating default users with hashed passwords...");

  try {
    // Hash passwords using bcrypt (same as registration)
    const adminPasswordHash = await bcrypt.hash("Admin123!", 10);
    const testUserPasswordHash = await bcrypt.hash("Test123!", 10);
    const adminSecurityAnswer = await bcrypt.hash("admin_answer", 10);
    const testUserSecurityAnswer = await bcrypt.hash("testuser_answer", 10);

    // Insert Admin User
    const adminResult = await db.run(`
      INSERT INTO User (
        username, 
        password_hash, 
        real_name, 
        date_of_birth, 
        description, 
        avatar_url, 
        is_admin, 
        is_active, 
        security_question_id, 
        security_answer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      "admin",
      adminPasswordHash,
      "Administrator",
      "1990-01-01",
      "System administrator account.",
      "/default-avatars/arcane-magic.png",
      1, // is_admin = true
      1, // is_active = true
      1, // security_question_id
      adminSecurityAnswer
    ]);

    const adminId = adminResult.lastID;
    console.log(`Created admin user (ID: ${adminId}) - Username: admin, Password: Admin123!`);

    // Insert Normal Test User
    const testUserResult = await db.run(`
      INSERT INTO User (
        username, 
        password_hash, 
        real_name, 
        date_of_birth, 
        description, 
        avatar_url, 
        is_admin, 
        is_active, 
        security_question_id, 
        security_answer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      "testuser",
      testUserPasswordHash,
      "Test User",
      "1995-06-15",
      "Regular user account for testing.",
      "/default-avatars/deep-diver.png",
      0, // is_admin = false
      1, // is_active = true
      2, // security_question_id
      testUserSecurityAnswer
    ]);

    const testUserId = testUserResult.lastID;
    console.log(`Created test user (ID: ${testUserId}) - Username: testuser, Password: Test123!`);

    // Create sample articles for admin
    await db.run(`
      INSERT INTO Article (author_id, title, content, header_image_url, is_active)
      VALUES (?, ?, ?, ?, ?)
    `, [
      adminId,
      "Welcome to Try Catch Me!",
      "This is a demonstration article created by the admin account. You can edit or delete this article to test the functionality of the application. Feel free to add images, comments, and likes!",
      "/default-avatars/arcane-magic.png",
      1
    ]);

    const adminArticleId = (await db.get(`SELECT last_insert_rowid() as id`)).id;

    await db.run(`
      INSERT INTO Article (author_id, title, content, header_image_url, is_active)
      VALUES (?, ?, ?, ?, ?)
    `, [
      adminId,
      "Getting Started Guide",
      "This article demonstrates how to use the platform. You can create articles, add images, write comments, and interact with other users. The admin account has full access to all features including user management.",
      "/default-avatars/arcane-magic.png",
      1
    ]);

    // Create sample articles for test user
    await db.run(`
      INSERT INTO Article (author_id, title, content, header_image_url, is_active)
      VALUES (?, ?, ?, ?, ?)
    `, [
      testUserId,
      "My First Article",
      "Hello everyone! This is my first article on Try Catch Me. I'm excited to share my thoughts and connect with other users. Feel free to leave a comment below!",
      "/default-avatars/deep-diver.png",
      1
    ]);

    const testUserArticleId = (await db.get(`SELECT last_insert_rowid() as id`)).id;

    // Add a comment from test user to admin's article
    await db.run(`
      INSERT INTO Comment (article_id, author_id, content, is_active)
      VALUES (?, ?, ?, ?)
    `, [
      adminArticleId,
      testUserId,
      "Great article! Very helpful for getting started.",
      1
    ]);

    // Add a comment from admin to test user's article
    await db.run(`
      INSERT INTO Comment (article_id, author_id, content, is_active)
      VALUES (?, ?, ?, ?)
    `, [
      testUserArticleId,
      adminId,
      "Welcome to the platform! Nice first article!",
      1
    ]);

    // Add some likes
    await db.run(`
      INSERT INTO Like (article_id, user_id, is_active)
      VALUES (?, ?, ?)
    `, [adminArticleId, testUserId, 1]);

    await db.run(`
      INSERT INTO Like (article_id, user_id, is_active)
      VALUES (?, ?, ?)
    `, [testUserArticleId, adminId, 1]);

    console.log("Created sample articles and interactions for default users");
    console.log("\n" + "=".repeat(70));
    console.log("DEFAULT LOGIN CREDENTIALS:");
    console.log("=".repeat(70));
    console.log("Admin Account:");
    console.log("  Username: admin");
    console.log("  Password: Admin123!");
    console.log("");
    console.log("Test User Account:");
    console.log("  Username: testuser");
    console.log("  Password: Test123!");
    console.log("=".repeat(70) + "\n");

  } catch (error) {
    console.error("Error creating default users:", error);
    throw error;
  }
}
