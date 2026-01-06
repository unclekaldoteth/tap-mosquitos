// Global Leaderboard API
// GET - Fetch top 10 scores globally
// POST - Submit new score

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured' });
    }

    // GET - Fetch leaderboard
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('leaderboard')
                .select('*')
                .order('score', { ascending: false })
                .limit(50);

            if (error) throw error;

            return res.status(200).json({ entries: data || [] });
        } catch (error) {
            console.error('Leaderboard fetch error:', error);
            return res.status(500).json({ error: 'Failed to fetch leaderboard' });
        }
    }

    // POST - Submit score
    if (req.method === 'POST') {
        try {
            const { walletAddress, username, score, tapped, bestCombo } = req.body;

            if (!walletAddress || score === undefined) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const { data, error } = await supabase
                .from('leaderboard')
                .insert({
                    wallet_address: walletAddress,
                    username: username || null,
                    score: score,
                    tapped: tapped || 0,
                    best_combo: bestCombo || 1,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            // Get the rank
            const { data: rankData } = await supabase
                .from('leaderboard')
                .select('id')
                .gte('score', score);

            const rank = rankData?.length || -1;

            return res.status(200).json({
                success: true,
                entry: data,
                rank: rank
            });
        } catch (error) {
            console.error('Score submission error:', error);
            return res.status(500).json({ error: 'Failed to submit score' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
