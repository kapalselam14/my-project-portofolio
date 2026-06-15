import { hashPassword, verifyPassword } from "./auth-util.js";
import { updateDatabase } from "./util.js";
import { getDatabase } from "./database.js";


// get user profile by id
// Returns user regardless of is_active status (includes deleted users)
// API layer should check is_active to determine if user is deleted
export async function getUserById(id) {
    const db = await getDatabase();
    const result = await db.get("SELECT id, username, real_name, date_of_birth, description, avatar_url, is_admin, is_active FROM User WHERE id = ?", id);
    if (!result) {
        throw new Error(`User with id ${id} does not exists!`);
    }
    return result;
}

// get userByUserName (haven't used yet)
export async function getUserByUsername(username) {
    const db = await getDatabase();
    const result = await db.get("SELECT id, username, real_name, date_of_birth, description, avatar_url, is_admin, is_active FROM User WHERE username =?", username.toLowerCase());
    return result;
}

// get count user in case for pagination or manage backend statistics in Java administration
export async function getUserCount() {
    const db = await getDatabase();
    const result = await db.get("SELECT COUNT(*) as count FROM User");
    return result.count;
}


// - `GET /api/users` — list users (admin only)
// Flexible query for all users or specific conditions, supporting various field filtering, and can work with soft deletion (is_active) feature
// e.g. getAllUsers({}) or getAllUsers({is_active: true}) or getAllUsers({ username: 'john', is_admin: true })
export async function getAllUsers(search) {
    const db = await getDatabase();
    let query = `SELECT id, username, real_name, date_of_birth, description, avatar_url, is_admin, is_active,
                (SELECT COUNT(*) FROM Article WHERE author_id = User.id) AS article_count FROM User`;
    const params = [];

    if (search && search.is_active !== undefined) {
        query += ` WHERE is_active = ?`;
        params.push(Number(search.is_active));
    }

    let result = await db.all(query, ...params);

    if (search) {
        let { username, real_name, date_of_birth, description, avatar_url, is_admin } = search;

        if (username) {
            result = result.filter((a) => a.username.toLowerCase().includes(username.toLowerCase()));
        }
        if (real_name) {
            result = result.filter((a) => a.real_name?.toLowerCase().includes(real_name.toLowerCase()));
        }
        if (date_of_birth) {
            result = result.filter((a) => a.date_of_birth == date_of_birth);
        }
        if (description) {
            result = result.filter((a) => a.description?.toLowerCase().includes(description.toLowerCase()));
        }
        if (avatar_url) {
            const hasAvatar = avatar_url == 'true' || avatar_url == true;
            result = result.filter((a) => hasAvatar ? a.avatar_url !== null : a.avatar_url === null);
        }
        if (is_admin) {
            const isAdminValue = is_admin === 'true' || is_admin === true;
            result = result.filter((a) => a.is_admin === isAdminValue);
        }
    }
    return result;
}

//=========CREATE==============
// - `POST /api/users` — register
// TODO: Create createUser() function
//       - Get db
//       - Check if username already exists 
//       - Hash password using hashPassword()
//       - INSERT new user into User table
//       - Return new user (without password)
export async function createUser(
    username, 
    plainPassword, 
    real_name,
    date_of_birth, 
    security_question_id, 
    security_answer, 
    description, 
    avatar_url) 
    
    {
    const db = await getDatabase();
    const usernameLower = username.toLowerCase();
    const existUser = await db.get("SELECT id FROM User WHERE LOWER(username) =?", usernameLower);
    if (existUser) {
        throw new Error("Username already exist!");
    }
    const hashedPassword = await hashPassword(plainPassword); //use hashPassword function
    const hashedAnswer = await hashPassword(security_answer); // hash security answer
    await db.run("INSERT INTO User (username, password_hash, real_name, date_of_birth, description, avatar_url, security_question_id, security_answer ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        usernameLower,
        hashedPassword,
        real_name,
        typeof date_of_birth === 'string' ? date_of_birth : new Date(date_of_birth).toISOString().split('T')[0],
        description,
        avatar_url,
        security_question_id,
        hashedAnswer
    );

    const newUser = await getUserByUsername(usernameLower);
    return newUser;
}

//=========UPDATE==============

// - `PUT /api/users/:id` — update profile
// TODO: Create updateUser(id, updateData) function
//       - Get db
//       - If updating password, hash it first
//       - UPDATE user in User table
//       - Return updated user (without password)
export async function updateUser(id, updateData) {
    const db = await getDatabase();
    const user = await getUserById(id);
    // Don't allow updating deleted users
    if (!user.is_active) {
        throw new Error("Cannot update deleted user");
    }
    if (updateData.id) {
        delete updateData.id;
    }
    if (updateData.username) {
        const existingUser = await db.get("SELECT id FROM User WHERE username = ? AND id !=?", updateData.username, id);
        if (existingUser) {
            throw new Error("Username already taken!"); //throw error if username already taken
        }
    }
    if (updateData.password) { //forgot password
        updateData.password_hash = await hashPassword(updateData.password);
        delete updateData.password; //need to delete plain password after hashing
    }
    await updateDatabase(db, "User", updateData, id);
    const updatedUser = await getUserById(id); //using getUserById function
    return updatedUser;
}

// user want to change password
export async function changePassword(id, oldPassword, newPassword) {
    const db = await getDatabase();
    const user = await db.get("SELECT id, password_hash FROM User WHERE id = ?", id);
    if (!user) {
        throw new Error("User does not exist");
    }

    const isValid = await verifyPassword(oldPassword, user.password_hash);
    if (!isValid) {
        throw new Error("Wrong Password!");
    }
    const hashedPassword = await hashPassword(newPassword);
    await db.run("UPDATE User SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", hashedPassword, id);
    return { message: "Password changed successfully" };

}

//========DELETE=========

// - `DELETE /api/users/:id` — delete user and related data
// TODO: Create deleteUser(id) function
//       - Get db
//       - DELETE user from User table
//       - Return success/deleted user info
export async function hardDeleteUserAndRelated(id) { // actually delete user from database
    const db = await getDatabase();
    await getUserById(id); //using getuserbyid function, it can throw error if not exists

    await db.run("DELETE FROM Comment WHERE id = ?", id); //delete comments made by user

    const articles = await db.all("SELECT id FROM Article WHERE author_id = ?", id);
    for (const article of articles) {
        await db.run("DELETE FROM Comment WHERE article_id = ?", article.id); //comments on user's articles
        await db.run("DELETE FROM Image WHERE article_id = ?", article.id); //images on user's articles
        await db.run("DELETE FROM Like WHERE article_id = ?", article.id); //likes on user's articles
        await db.run("DELETE FROM Article WHERE id = ?", article.id); //articles by user
    }
    await db.run("DELETE FROM User WHERE id = ?", id); //delete user
    return { message: "User deleted successfully" }; //return success message
}

// admin only: delete multiple users
export async function deleteBulkUsers(ids) {
    const db = await getDatabase();
    const deleteIds = ids.map(() => '?').join(', '); //creating placeholder for desired user ids (?, ?, ?, ?)
    await db.run(`DELETE FROM User WHERE id IN (${deleteIds})`, ...ids);
    return { message: `${ids.length} users deleted!` } //deleted users counted

}

// Soft delete user (set is_active = false)
// check if user exists first, then update is_active to false (0)
// if user not exists, throw error
export async function softDeleteUser(id) {
    const db = await getDatabase();
    const user = await getUserById(id);
    // Check if already deleted
    if (!user.is_active) {
        throw new Error("User is already deleted");
    }
    await db.run("UPDATE User SET is_active = 0 WHERE id = ?", id);
    await db.run("UPDATE Article SET is_active = 0 WHERE author_id = ?", id);
    await db.run("UPDATE Comment SET is_active = 0 WHERE author_id = ?", id);
    return { message: "User deleted" };
}

//=======LOGIN========
// - `POST /api/login` — login, returns token
// TODO: Create loginUser(username, password) function
// 1. Get database
// 2. Find user by username (IMPORTANT: need to SELECT password_hash!)
// 3. If user not found, throw error
// 4. Verify password using verifyPassword(password, user.password_hash)
// 5. If password incorrect, throw error
// 6. Return user (WITHOUT password_hash!)

export async function loginUser(username, password) {
    const db = await getDatabase();
    const user = await db.get(
        "SELECT id, username, real_name, date_of_birth, description, avatar_url, is_admin, password_hash, is_active FROM User WHERE username = ?", username.toLowerCase()
    );
    console.log(user);
    //get the username with their password_hash
    if (!user) {
        throw new Error("Invalid username or password!")
    }
    if (user.is_active !== 1) {
        throw new Error("User account is inactive. Please contact support.");
    }
    //check if the user active
    const isValid = await verifyPassword(password, user.password_hash); //declaring variable for verifiying user's password
    if (!isValid) {
        throw new Error("Invalid username or password!");
    }
    delete user.password_hash;
    return user;
}

//=====GET USER SECURITY QUESTION=====
// Purpose: Get the security question for a user (for password reset flow)
// Steps:
// 1. Query database for user by username
// 2. Join with SecurityQuestion table to get question text
// 3. Return user id, username, security_question_id, and question text
// 4. Do NOT return the security answer (that would be insecure!)
export async function getUserSecurityQuestion(username) {
    const db = await getDatabase();
    const result = await db.get(
        `SELECT u.id, u.username, u.security_question_id, sq.question 
         FROM User u 
         JOIN SecurityQuestion sq ON u.security_question_id = sq.id 
         WHERE u.username = ? AND u.is_active = 1`,
        username
    );
    
    if (!result) {
        throw new Error("User not found");
    }
    
    return result;
}

//=====VERIFY SECURITY ANSWER=====
// Purpose: Verify if the provided security answer matches the stored hashed answer
// Steps:
// 1. Query database for user by username
// 2. Get the hashed security answer
// 3. Verify the provided answer against the hashed answer
// 4. Return true if match, throw error if not
export async function verifySecurityAnswer(username, answer) {
    const db = await getDatabase();
    const user = await db.get(
        "SELECT security_answer FROM User WHERE username = ? AND is_active = 1",
        username
    );
    
    if (!user) {
        throw new Error("User not found");
    }
    
    const isValid = await verifyPassword(answer, user.security_answer);
    
    if (!isValid) {
        throw new Error("Incorrect security answer");
    }
    
    return true;
}

//=====RESET USER PASSWORD=====
// Purpose: Update user's password (for forgot password flow)
// Steps:
// 1. Hash the new password
// 2. Update the password_hash in database
// 3. Return success
export async function resetUserPassword(username, newPassword) {
    const db = await getDatabase();
    
    // First check if user exists
    const user = await db.get(
        "SELECT id FROM User WHERE username = ? AND is_active = 1",
        username
    );
    
    if (!user) {
        throw new Error("User not found");
    }
    
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update password
    await db.run(
        "UPDATE User SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?",
        hashedPassword,
        username
    );
    
    return { message: "Password reset successful" };
}










