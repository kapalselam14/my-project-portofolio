import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

/**
 * Verifies the given JWT token and gets the username from it. Throws an error if the JWT is invalid or expired, or there's
 * no username in the token.
 *
 * Feel free to use this function or modify it in your own programs (credit the author!).
 *
 * @param {string} token the token to verify
 *
 * @author Andrew Meads
 */

const JWT_KEY = process.env.JWT_KEY || "TRYC4TCHM3";

export function getUsernameFromJWT(token) {
  // Decode token; will throw an error if the token is invalid or expired.
  const decoded = jwt.verify(token, process.env.JWT_KEY);
  if (!decoded.username) throw `JWT is valid but did not contain a username.`;
  return decoded.username;
}

/**
 * Creates a new JWT for the user with the given username, with the given expiry time (defaults to 24 hours).
 *
 * Ideally, the expiry time should match the expiry time of the HTTP-only cookie it will be stored in, but doesn't
 * matter too much if not (they will both be checked separately).
 *
 * Feel free to use this function or modify it in your own programs (credit the author!).
 *
 * @param {string} username the username
 * @param {string} expiresIn when this token expires (defaults to 24 hours)
 *
 * @author Andrew Meads
 */
export function createUserJWT(user, expiresIn = "7d") {
    // user should be an object with id and username
    return jwt.sign(
        {
            user_id: user.id,
            username: user.username
        },
        JWT_KEY,
        { expiresIn }
    );
}
