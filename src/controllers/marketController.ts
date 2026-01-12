import { Request, Response } from 'express';
import pool from '../config/database';

// Helper to query mock DB
const query = (text: string, params: any[]) => pool.query(text, params);

// --- MARKETS ---

export const createMarketMetadata = async (req: Request, res: Response) => {
    try {
        const { marketId, question, description, imageUrl, categoryId } = req.body;

        if (!marketId || !question) {
            return res.status(400).json({ success: false, message: 'Missing marketId or question' });
        }

        // Insert into mock DB
        // Parameters: [marketId, question, description, image_url, category_id]
        await query(
            'insert into market_metadata (market_id, question, description, image_url, category_id) values ($1, $2, $3, $4, $5)',
            [marketId, question, description || '', imageUrl || '', categoryId || '']
        );

        res.json({ success: true, message: 'Market metadata created' });
    } catch (error) {
        console.error('Create Metadata Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getAllMarketMetadata = async (req: Request, res: Response) => {
    try {
        const result = await query('select * from market_metadata');
        res.json({ success: true, markets: result.rows });
    } catch (error) {
        console.error('Get All Metadata Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getMarketMetadata = async (req: Request, res: Response) => {
    try {
        const { marketId } = req.params;
        const result = await query('select * from market_metadata where market_id = $1', [marketId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }

        res.json({ success: true, market: result.rows[0] });
    } catch (error) {
        console.error('Get Metadata Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// --- CATEGORIES ---

export const createCategory = async (req: Request, res: Response) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

        const result = await query('insert into categories (name) values ($1)', [name]);
        res.json({ success: true, category: result.rows[0] });
    } catch (error) {
        console.error('Create Category Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getCategories = async (req: Request, res: Response) => {
    try {
        const result = await query('select * from categories');
        res.json({ success: true, categories: result.rows });
    } catch (error) {
        console.error('Get Categories Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
