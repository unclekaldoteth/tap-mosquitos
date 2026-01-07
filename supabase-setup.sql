-- Supabase SQL Setup for Tap That Mosquito
-- Run this in the Supabase SQL Editor
-- Run each section separately if you encounter errors

-- ============================================
-- LEADERBOARD TABLE (Weekly Reset)
-- ============================================

CREATE TABLE IF NOT EXISTS leaderboard (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    username TEXT,
    fid INTEGER,
    score INTEGER NOT NULL,
    tapped INTEGER DEFAULT 0,
    best_combo INTEGER DEFAULT 1,
    week_start DATE DEFAULT date_trunc('week', CURRENT_DATE)::DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast score sorting within current week
CREATE INDEX IF NOT EXISTS idx_leaderboard_week_score ON leaderboard(week_start, score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_wallet ON leaderboard(wallet_address);

-- ============================================
-- NOTIFICATION TOKENS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS notification_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fid INTEGER UNIQUE NOT NULL,
    token TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_fid ON notification_tokens(fid);

-- ============================================
-- VERSUS CHALLENGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS challenges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    challenger_fid INTEGER NOT NULL,
    opponent_fid INTEGER NOT NULL,
    challenger_username TEXT,
    opponent_username TEXT,
    challenger_score INTEGER,
    opponent_score INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'expired', 'declined')),
    winner_fid INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for challenge lookups
CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON challenges(challenger_fid, status);
CREATE INDEX IF NOT EXISTS idx_challenges_opponent ON challenges(opponent_fid, status);
CREATE INDEX IF NOT EXISTS idx_challenges_expires ON challenges(expires_at) WHERE status = 'pending';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Public read access" ON leaderboard;
DROP POLICY IF EXISTS "Allow insert" ON leaderboard;
DROP POLICY IF EXISTS "Service role only" ON notification_tokens;
DROP POLICY IF EXISTS "Public read challenges" ON challenges;
DROP POLICY IF EXISTS "Allow create challenges" ON challenges;
DROP POLICY IF EXISTS "Allow update challenges" ON challenges;

-- Leaderboard: public read, insert allowed
CREATE POLICY "Public read access" ON leaderboard FOR SELECT USING (true);
CREATE POLICY "Allow insert" ON leaderboard FOR INSERT WITH CHECK (true);

-- Notification tokens: only accessible via service role (not anon)
CREATE POLICY "Service role only" ON notification_tokens FOR ALL 
    USING (auth.role() = 'service_role');

-- Challenges: public read, insert/update allowed
CREATE POLICY "Public read challenges" ON challenges FOR SELECT USING (true);
CREATE POLICY "Allow create challenges" ON challenges FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update challenges" ON challenges FOR UPDATE USING (true);

-- ============================================
-- HELPER FUNCTION: Expire old challenges
-- ============================================

CREATE OR REPLACE FUNCTION expire_old_challenges()
RETURNS void AS $$
BEGIN
    UPDATE challenges 
    SET status = 'expired' 
    WHERE status = 'pending' 
      AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
