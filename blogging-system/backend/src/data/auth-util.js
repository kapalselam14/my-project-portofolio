import bcrypt from 'bcrypt';


export async function hashPassword(plainPassword) {
    try {
        if(!plainPassword) { //if password blank
            throw new Error('Password required!');
        }
        const hash = await bcrypt.hash(plainPassword, 10); //.hash(variable, salting factorial)
        return hash;
    } catch (err) {
        console.error('Error hashing password', err.message);
        throw err;
    }
}
export async function verifyPassword(plainPassword, hash) {
    try {
        if(!plainPassword || !hash) //do chcek the passwords and hashedpassword using .compare()
            throw new Error('Password and Hashed Password needed!')
        const result = await bcrypt.compare(plainPassword, hash); //comparing 2 variables
        return result;
    } catch (err) {
        console.error('Error verifying password', err.message);
        return false;
        
    }
}