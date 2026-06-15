import multer from "multer";
import { v4 as uuid } from "uuid";
import fs from "fs";
import path from "path";

const upload = multer({
    dest: "temp", limits:{
    fileSize: 5 * 1024 * 1024
    }
});

export function avatarProcess(req){
    if(!req.file){
        throw new Error('No file uploaded');
    }
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if(!allowedTypes.includes(req.file.mimetype)){
        fs.unlinkSync(req.file.path);
        throw new Error('Only JPEG and PNG images are allowed');
    }

    const originalname = req.file.originalname;
    const fileExtension = originalname.substring(originalname.lastIndexOf("."));

    const newFileName = uuid() + fileExtension;
    fs.renameSync(req.file.path, `public/users-avatars/${newFileName}`);
    return `/users-avatars/${newFileName}`;
}

export const uploadAvatar = upload.single('avatar');