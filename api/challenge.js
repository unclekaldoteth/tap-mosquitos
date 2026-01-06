// Versus Challenge API
// POST /create - Create challenge to username
// POST /accept - Accept pending challenge  
// POST /submit - Submit score after playing
// GET /pending - Get pending challenges for user
// GET /active - Get active challenge for user

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const APP_URL = 'https://tap-mosquito.vercel.app';

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

    const { action } = req.query;

    try {
        switch (action) {
            case 'create':
                return await createChallenge(req, res);
            case 'accept':
                return await acceptChallenge(req, res);
            case 'decline':
                return await declineChallenge(req, res);
            case 'submit':
                return await submitScore(req, res);
            case 'pending':
                return await getPendingChallenges(req, res);
            case 'active':
                return await getActiveChallenge(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Challenge API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// Create a new challenge
async function createChallenge(req, res) {
    const { challengerFid, challengerUsername, opponentUsername } = req.body;

    if (!challengerFid || !opponentUsername) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Look up opponent FID from username (using Neynar or stored data)
    const opponentFid = await lookupFidByUsername(opponentUsername);
    if (!opponentFid) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Check for existing pending challenge within 24h
    const { data: existing } = await supabase
        .from('challenges')
        .select('id')
        .eq('challenger_fid', challengerFid)
        .eq('opponent_fid', opponentFid)
        .in('status', ['pending', 'accepted'])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .single();

    if (existing) {
        return res.status(409).json({ error: 'Already challenged this user in the last 24 hours' });
    }

    // Create challenge
    const { data: challenge, error } = await supabase
        .from('challenges')
        .insert({
            challenger_fid: challengerFid,
            opponent_fid: opponentFid,
            challenger_username: challengerUsername,
            opponent_username: opponentUsername,
            status: 'pending'
        })
        .select()
        .single();

    if (error) throw error;

    // Send notification to opponent
    await sendChallengeNotification(opponentFid, challengerUsername, challenge.id);

    return res.status(200).json({ success: true, challenge });
}

// Accept a challenge
async function acceptChallenge(req, res) {
    const { challengeId, opponentFid } = req.body;

    if (!challengeId || !opponentFid) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: challenge, error } = await supabase
        .from('challenges')
        .update({ status: 'accepted' })
        .eq('id', challengeId)
        .eq('opponent_fid', opponentFid)
        .eq('status', 'pending')
        .select()
        .single();

    if (error || !challenge) {
        return res.status(404).json({ error: 'Challenge not found or already accepted' });
    }

    // Notify challenger that challenge was accepted
    await sendAcceptedNotification(challenge.challenger_fid, challenge.opponent_username);

    return res.status(200).json({ success: true, challenge });
}

// Decline a challenge
async function declineChallenge(req, res) {
    const { challengeId, opponentFid } = req.body;

    if (!challengeId || !opponentFid) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: challenge, error } = await supabase
        .from('challenges')
        .update({ status: 'declined' })
        .eq('id', challengeId)
        .eq('opponent_fid', opponentFid)
        .eq('status', 'pending')
        .select()
        .single();

    if (error || !challenge) {
        return res.status(404).json({ error: 'Challenge not found' });
    }

    return res.status(200).json({ success: true });
}

// Submit score for a challenge
async function submitScore(req, res) {
    const { challengeId, fid, score } = req.body;

    if (!challengeId || !fid || score === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get challenge
    const { data: challenge, error: fetchError } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', challengeId)
        .single();

    if (fetchError || !challenge) {
        return res.status(404).json({ error: 'Challenge not found' });
    }

    // Determine if challenger or opponent
    const isChallenger = challenge.challenger_fid === fid;
    const isOpponent = challenge.opponent_fid === fid;

    if (!isChallenger && !isOpponent) {
        return res.status(403).json({ error: 'Not a participant in this challenge' });
    }

    // Update score
    const updateField = isChallenger ? 'challenger_score' : 'opponent_score';
    const updates = { [updateField]: score };

    // Check if challenge is now complete
    const otherScore = isChallenger ? challenge.opponent_score : challenge.challenger_score;
    if (otherScore !== null) {
        // Both have played - determine winner
        const challengerFinalScore = isChallenger ? score : challenge.challenger_score;
        const opponentFinalScore = isOpponent ? score : challenge.opponent_score;

        let winnerFid = null;
        if (challengerFinalScore > opponentFinalScore) {
            winnerFid = challenge.challenger_fid;
        } else if (opponentFinalScore > challengerFinalScore) {
            winnerFid = challenge.opponent_fid;
        }
        // If tie, winner_fid stays null

        updates.status = 'completed';
        updates.winner_fid = winnerFid;
        updates.completed_at = new Date().toISOString();
    }

    const { data: updated, error: updateError } = await supabase
        .from('challenges')
        .update(updates)
        .eq('id', challengeId)
        .select()
        .single();

    if (updateError) throw updateError;

    // If completed, send result notification
    if (updated.status === 'completed') {
        await sendResultNotification(updated);
    }

    return res.status(200).json({ success: true, challenge: updated });
}

// Get pending challenges for a user
async function getPendingChallenges(req, res) {
    const { fid } = req.query;

    if (!fid) {
        return res.status(400).json({ error: 'Missing fid' });
    }

    // Expire old challenges first
    await supabase.rpc('expire_old_challenges');

    const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('opponent_fid', parseInt(fid))
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({ challenges: data || [] });
}

// Get active challenge (accepted but not completed)
async function getActiveChallenge(req, res) {
    const { fid } = req.query;

    if (!fid) {
        return res.status(400).json({ error: 'Missing fid' });
    }

    const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('status', 'accepted')
        .or(`challenger_fid.eq.${fid},opponent_fid.eq.${fid}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') throw error;

    return res.status(200).json({ challenge: data || null });
}

// Helper: Look up FID by username (mock - replace with Neynar API)
async function lookupFidByUsername(username) {
    // Clean username
    const cleanUsername = username.replace('@', '').toLowerCase();

    // Try to find in notification_tokens or use Neynar API
    const neynarApiKey = process.env.NEYNAR_API_KEY;
    if (neynarApiKey) {
        try {
            const response = await fetch(
                `https://api.neynar.com/v2/farcaster/user/search?q=${cleanUsername}&limit=1`,
                { headers: { 'api_key': neynarApiKey } }
            );
            const data = await response.json();
            if (data.result?.users?.[0]) {
                return data.result.users[0].fid;
            }
        } catch (e) {
            console.error('Neynar lookup failed:', e);
        }
    }
    return null;
}

// Helper: Send challenge notification
async function sendChallengeNotification(opponentFid, challengerUsername, challengeId) {
    const { data: tokens } = await supabase
        .from('notification_tokens')
        .select('token, url')
        .eq('fid', opponentFid)
        .single();

    if (!tokens) return;

    try {
        await fetch(tokens.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                notificationId: `challenge-${challengeId}`,
                title: '🎮 Challenge Received!',
                body: `@${challengerUsername} challenged you to Tap That Mosquito!`,
                targetUrl: `${APP_URL}?challenge=${challengeId}`,
                tokens: [tokens.token]
            })
        });
    } catch (e) {
        console.error('Failed to send challenge notification:', e);
    }
}

// Helper: Send accepted notification
async function sendAcceptedNotification(challengerFid, opponentUsername) {
    const { data: tokens } = await supabase
        .from('notification_tokens')
        .select('token, url')
        .eq('fid', challengerFid)
        .single();

    if (!tokens) return;

    try {
        await fetch(tokens.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                notificationId: `accepted-${Date.now()}`,
                title: '✅ Challenge Accepted!',
                body: `@${opponentUsername} accepted your challenge!`,
                targetUrl: APP_URL,
                tokens: [tokens.token]
            })
        });
    } catch (e) {
        console.error('Failed to send accepted notification:', e);
    }
}

// Helper: Send result notification
async function sendResultNotification(challenge) {
    const winnerFid = challenge.winner_fid;
    const loserFid = winnerFid === challenge.challenger_fid
        ? challenge.opponent_fid
        : challenge.challenger_fid;

    // Notify winner
    if (winnerFid) {
        const { data: winnerTokens } = await supabase
            .from('notification_tokens')
            .select('token, url')
            .eq('fid', winnerFid)
            .single();

        if (winnerTokens) {
            await fetch(winnerTokens.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    notificationId: `win-${challenge.id}`,
                    title: '🏆 Victory!',
                    body: `You won! ${challenge.challenger_score} - ${challenge.opponent_score}`,
                    targetUrl: APP_URL,
                    tokens: [winnerTokens.token]
                })
            });
        }

        // Notify loser
        const { data: loserTokens } = await supabase
            .from('notification_tokens')
            .select('token, url')
            .eq('fid', loserFid)
            .single();

        if (loserTokens) {
            await fetch(loserTokens.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    notificationId: `loss-${challenge.id}`,
                    title: '😤 Defeated!',
                    body: `You lost ${challenge.challenger_score} - ${challenge.opponent_score}. Rematch?`,
                    targetUrl: APP_URL,
                    tokens: [loserTokens.token]
                })
            });
        }
    } else {
        // Tie - notify both
        for (const fid of [challenge.challenger_fid, challenge.opponent_fid]) {
            const { data: tokens } = await supabase
                .from('notification_tokens')
                .select('token, url')
                .eq('fid', fid)
                .single();

            if (tokens) {
                await fetch(tokens.url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        notificationId: `tie-${challenge.id}`,
                        title: '🤝 It\'s a Tie!',
                        body: `Both scored ${challenge.challenger_score}! Rematch?`,
                        targetUrl: APP_URL,
                        tokens: [tokens.token]
                    })
                });
            }
        }
    }
}
