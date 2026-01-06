// Bulk Migration API for LocalStorage Scores
// POST - Import multiple scores at once

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
        const { entries } = req.body;

        if (!entries || !Array.isArray(entries)) {
            return res.status(400).json({ error: 'Missing entries array' });
        }

        // Transform entries for Supabase
        const records = entries.map(entry => ({
            wallet_address: entry.address || 'Anonymous',
            username: entry.username || null,
            score: entry.score,
            tapped: entry.tapped || 0,
            best_combo: entry.bestCombo || 1,
            week_start: new Date().toISOString().split('T')[0], // Current week
            created_at: entry.timestamp ? new Date(entry.timestamp).toISOString() : new Date().toISOString()
        }));

        // Bulk insert
        const { data, error } = await supabase
            .from('leaderboard')
            .insert(records)
            .select();

        if (error) throw error;

        return res.status(200).json({
            success: true,
            imported: data.length,
            message: `Successfully imported ${data.length} scores`
        });
    } catch (error) {
        console.error('Migration error:', error);
        return res.status(500).json({ error: 'Failed to migrate scores' });
    }
}
