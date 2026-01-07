// Store notification tokens from addFrame
// POST - Save notification token for a user

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured' });
    }

    try {
        const { token, url, fid } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Missing token' });
        }

        // Store or update the notification token
        const { error } = await supabase
            .from('notification_tokens')
            .upsert({
                token: token,
                url: url || 'https://tap-mosquito.vercel.app',
                fid: fid || null,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'token'
            });

        if (error) {
            console.error('Failed to store token:', error);
            return res.status(500).json({ error: 'Failed to store token' });
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
