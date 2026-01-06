// Global Leaderboard API
// GET - Fetch top 50 scores (one per user, cumulative weekly)
// POST - Add score to user's total (or create new entry)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

// Get current week start date (Monday)
function getWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split('T')[0];
}

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

    const weekStart = getWeekStart();

    // GET - Fetch leaderboard (one entry per user, current week only)
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('leaderboard')
                .select('*')
                .eq('week_start', weekStart)
                .order('score', { ascending: false })
                .limit(50);

            if (error) throw error;

            return res.status(200).json({ entries: data || [] });
        } catch (error) {
            console.error('Leaderboard fetch error:', error);
            return res.status(500).json({ error: 'Failed to fetch leaderboard' });
        }
    }

    // POST - Submit score (add to existing user's total or create new)
    if (req.method === 'POST') {
        try {
            const { walletAddress, username, score, tapped, bestCombo } = req.body;

            if (!walletAddress || score === undefined) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Check if user already has an entry this week
            const { data: existing } = await supabase
                .from('leaderboard')
                .select('*')
                .eq('wallet_address', walletAddress)
                .eq('week_start', weekStart)
                .single();

            let data;
            if (existing) {
                // UPDATE: Add score to existing total
                const newScore = existing.score + score;
                const newTapped = existing.tapped + (tapped || 0);
                const newBestCombo = Math.max(existing.best_combo, bestCombo || 1);

                const { data: updated, error } = await supabase
                    .from('leaderboard')
                    .update({
                        score: newScore,
                        tapped: newTapped,
                        best_combo: newBestCombo,
                        username: username || existing.username // Update username if provided
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (error) throw error;
                data = updated;
            } else {
                // INSERT: Create new entry for this week
                const { data: inserted, error } = await supabase
                    .from('leaderboard')
                    .insert({
                        wallet_address: walletAddress,
                        username: username || null,
                        score: score,
                        tapped: tapped || 0,
                        best_combo: bestCombo || 1,
                        week_start: weekStart,
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (error) throw error;
                data = inserted;
            }

            // Get the rank
            const { data: rankData } = await supabase
                .from('leaderboard')
                .select('id')
                .eq('week_start', weekStart)
                .gte('score', data.score);

            const rank = rankData?.length || -1;

            return res.status(200).json({
                success: true,
                entry: data,
                rank: rank,
                added: score,
                total: data.score
            });
        } catch (error) {
            console.error('Score submission error:', error);
            return res.status(500).json({ error: 'Failed to submit score' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
