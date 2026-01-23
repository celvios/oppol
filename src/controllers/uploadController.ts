import { Request, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Use memory storage for Cloudinary upload
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// Helper to upload buffer to Cloudinary
const uploadToCloudinary = (buffer: Buffer, filename: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'opoll-markets',
                public_id: filename,
                resource_type: 'image'
            },
            (error: any, result: any) => {
                if (error) {
                    reject(error);
                } else if (result) {
                    resolve(result.secure_url);
                } else {
                    reject(new Error('Upload failed'));
                }
            }
        );

        const readable = Readable.from(buffer);
        readable.pipe(uploadStream);
    });
};

export const uploadImage = (req: Request, res: Response) => {
    upload.single('image')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ success: false, error: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        try {
            // Upload to Cloudinary
            const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
            const cloudinaryUrl = await uploadToCloudinary(req.file.buffer, uniqueFilename);

            // Return the full Cloudinary URL
            res.json({ success: true, url: cloudinaryUrl });
        } catch (uploadError: any) {
            console.error('Cloudinary upload error:', uploadError);
            return res.status(500).json({
                success: false,
                error: 'Failed to upload to Cloudinary: ' + uploadError.message
            });
        }
    });
};
