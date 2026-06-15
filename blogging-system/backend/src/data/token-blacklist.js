//=====JWT TOKEN BLACKLIST SYSTEM=====
/*Purpose: Manages blacklisted JWT tokens for secure logout functionality
When users logout, their tokens are added to this blacklist.
Blacklisted tokens cannot be used for authentication (even if not expired)
This ensures true server-side logout capability*/

//=====STORAGE=====
// 1: Create Map to store blacklisted tokens
// 2: Key: JWT token string, Value: expiry timestamp
const blackListedTokens = new Map();

//=====BLACKLIST TOKEN=====
// 1: Receive token and expiry time as parameters
// 2: Add token to blacklist Map with expiry timestamp
// 3: Token is now invalidated and cannot be used
export function blacklistToken(token, expiryTime){
    blackListedTokens.set(token, expiryTime);
}

//=====CHECK BLACKLIST=====
// 1: Receive token as parameter
// 2: Check if token exists in blacklist Map
// 3: Return true if blacklisted, false if not blacklisted
export function isTokenBlacklisted(token){
    return blackListedTokens.has(token);
}

//=====CLEANUP EXPIRED TOKENS=====
// 1: Get current timestamp in seconds
// 2: Loop through all blacklisted tokens
// 3: Remove tokens that have expired (expiry < current time)
// 4: Log remaining token count for monitoring
export function cleanupExpiredTokens(){
    const now = Math.floor(Date.now() / 1000);
    
    for(const[token, expiry] of blackListedTokens){
        if(expiry < now){
            blackListedTokens.delete(token);
        }
    }
    console.log(`Blacklist cleanup: ${blackListedTokens.size} tokens remaining`);
}

//=====AUTO-CLEANUP=====
// 1: Set interval to run cleanup every hour (3600000ms)
// 2: Automatically remove expired tokens to prevent memory leaks
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);