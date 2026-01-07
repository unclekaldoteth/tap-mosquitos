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
    const { challengerFid, challengerUsername, opponentUsername, opponentFid } = req.body;

    if (!challengerFid || (!opponentUsername && opponentFid === undefined && opponentFid === null)) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const normalizedOpponentUsername = normalizeUsername(opponentUsername);
    const normalizedChallengerUsername = normalizeUsername(challengerUsername);
    let resolvedOpponentFid = null;

    if (opponentFid !== undefined && opponentFid !== null && opponentFid !== '') {
        const parsedFid = Number.parseInt(opponentFid, 10);
        if (!Number.isFinite(parsedFid)) {
            return res.status(400).json({ error: 'Invalid opponent FID' });
        }
        resolvedOpponentFid = parsedFid;
    } else {
        // Look up opponent FID from username (using Neynar or stored data)
        const lookup = await lookupFidByUsername(opponentUsername);
        if (!lookup.fid) {
            const status = lookup.reason === 'neynar_missing' ? 503 : 404;
            const message = lookup.reason === 'neynar_missing'
                ? 'User lookup unavailable. Please try again later.'
                : 'User not found. Use a Farcaster username (not ENS).';
            return res.status(status).json({ error: message });
        }
        resolvedOpponentFid = lookup.fid;
    }

    // Check for existing pending challenge within 24h
    const { data: existing } = await supabase
        .from('challenges')
        .select('id')
        .eq('challenger_fid', challengerFid)
        .eq('opponent_fid', resolvedOpponentFid)
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
            opponent_fid: resolvedOpponentFid,
            challenger_username: normalizedChallengerUsername,
            opponent_username: normalizedOpponentUsername,
            status: 'pending'
        })
        .select()
        .single();

    if (error) throw error;

    // Send notification to opponent
    await sendChallengeNotification(resolvedOpponentFid, normalizedChallengerUsername, challenge.id);

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
    await sendAcceptedNotification(challenge.challenger_fid, challenge.opponent_username, challenge.id);

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
    const cleanUsername = normalizeUsername(username);
    if (!cleanUsername) {
        return { fid: null, reason: 'invalid_username' };
    }

    const neynarApiKey = process.env.NEYNAR_API_KEY || process.env.VITE_NEYNAR_API_KEY;
    if (!neynarApiKey) {
        console.error('NEYNAR_API_KEY missing; cannot resolve username to FID.');
        return { fid: null, reason: 'neynar_missing' };
    }

    try {
        const response = await fetch(
            `https://api.neynar.com/v2/farcaster/user/search?q=${cleanUsername}&limit=1`,
            { headers: { 'api_key': neynarApiKey } }
        );
        const data = await response.json();
        if (data.result?.users?.[0]) {
            return { fid: data.result.users[0].fid, reason: null };
        }
    } catch (e) {
        console.error('Neynar lookup failed:', e);
    }

    return { fid: null, reason: 'not_found' };
}

function normalizeUsername(username) {
    if (typeof username !== 'string') return null;
    const trimmed = username.trim();
    if (!trimmed) return null;
    const normalized = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
    if (!normalized || normalized.toLowerCase() === 'connected') return null;
    return normalized;
}

function formatUsername(username) {
    const normalized = normalizeUsername(username);
    return normalized ? `@${normalized}` : 'Someone';
}

async function fetchNotificationTokens(fid) {
    if (!supabase || fid === null || fid === undefined) return [];
    const parsedFid = Number.parseInt(fid, 10);
    if (!Number.isFinite(parsedFid)) return [];
    const { data, error } = await supabase
        .from('notification_tokens')
        .select('token, url')
        .eq('fid', parsedFid);

    if (error) {
        console.error('Failed to load notification tokens:', error);
        return [];
    }

    return data || [];
}

async function sendNotification(tokens, payload) {
    if (!tokens || tokens.length === 0) return;

    const grouped = new Map();
    for (const item of tokens) {
        if (!item?.token || !item?.url) continue;
        if (!grouped.has(item.url)) {
            grouped.set(item.url, []);
        }
        grouped.get(item.url).push(item.token);
    }

    for (const [url, tokenList] of grouped.entries()) {
        if (!tokenList.length) continue;
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, tokens: tokenList })
            });
        } catch (e) {
            console.error('Failed to send notification:', e);
        }
    }
}

// Helper: Send challenge notification
async function sendChallengeNotification(opponentFid, challengerUsername, challengeId) {
    const tokens = await fetchNotificationTokens(opponentFid);
    if (!tokens.length) return;

    await sendNotification(tokens, {
        notificationId: `challenge-${challengeId}-${opponentFid}`,
        title: '🎮 Challenge Received!',
        body: `${formatUsername(challengerUsername)} challenged you to Tap That Mosquito!`,
        targetUrl: `${APP_URL}?challenge=${challengeId}`
    });
}

// Helper: Send accepted notification
async function sendAcceptedNotification(challengerFid, opponentUsername, challengeId) {
    const tokens = await fetchNotificationTokens(challengerFid);
    if (!tokens.length) return;

    await sendNotification(tokens, {
        notificationId: `accepted-${challengeId}-${challengerFid}`,
        title: '✅ Challenge Accepted!',
        body: `${formatUsername(opponentUsername)} accepted your challenge!`,
        targetUrl: `${APP_URL}?challenge=${challengeId}`
    });
}

// Helper: Send result notification
async function sendResultNotification(challenge) {
    const winnerFid = challenge.winner_fid;
    const loserFid = winnerFid === challenge.challenger_fid
        ? challenge.opponent_fid
        : challenge.challenger_fid;
    const challengerScore = challenge.challenger_score || 0;
    const opponentScore = challenge.opponent_score || 0;

    // Notify winner
    if (winnerFid) {
        const winnerTokens = await fetchNotificationTokens(winnerFid);
        const winnerScore = winnerFid === challenge.challenger_fid ? challengerScore : opponentScore;
        const loserScoreForWinner = winnerFid === challenge.challenger_fid ? opponentScore : challengerScore;
        await sendNotification(winnerTokens, {
            notificationId: `win-${challenge.id}-${winnerFid}`,
            title: '🏆 Victory!',
            body: `You won! ${winnerScore} - ${loserScoreForWinner}`,
            targetUrl: `${APP_URL}?challenge=${challenge.id}`
        });

        // Notify loser
        const loserTokens = await fetchNotificationTokens(loserFid);
        const loserScore = loserFid === challenge.challenger_fid ? challengerScore : opponentScore;
        const winnerScoreForLoser = loserFid === challenge.challenger_fid ? opponentScore : challengerScore;
        await sendNotification(loserTokens, {
            notificationId: `loss-${challenge.id}-${loserFid}`,
            title: '😤 Defeated!',
            body: `You lost ${loserScore} - ${winnerScoreForLoser}. Rematch?`,
            targetUrl: `${APP_URL}?challenge=${challenge.id}`
        });
    } else {
        // Tie - notify both
        for (const fid of [challenge.challenger_fid, challenge.opponent_fid]) {
            const tokens = await fetchNotificationTokens(fid);
            await sendNotification(tokens, {
                notificationId: `tie-${challenge.id}-${fid}`,
                title: '🤝 It\'s a Tie!',
                body: `Both scored ${challengerScore}! Rematch?`,
                targetUrl: `${APP_URL}?challenge=${challenge.id}`
            });
        }
    }
}
