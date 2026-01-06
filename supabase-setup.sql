-- Supabase SQL Setup for Tap That Mosquito
-- Run this in the Supabase SQL Editor

-- ============================================
-- LEADERBOARD (Weekly Reset)
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

-- View for current week's leaderboard (top 50)
CREATE OR REPLACE VIEW current_week_leaderboard AS
SELECT 
    id, wallet_address, username, fid, score, tapped, best_combo, created_at,
    ROW_NUMBER() OVER (ORDER BY score DESC) as rank
FROM leaderboard
WHERE week_start = date_trunc('week', CURRENT_DATE)::DATE
ORDER BY score DESC
LIMIT 50;

-- ============================================
-- NOTIFICATION TOKENS
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
-- VERSUS CHALLENGES
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

-- Prevent duplicate challenges within 24 hours
CREATE UNIQUE INDEX IF NOT EXISTS idx_no_duplicate_challenges 
ON challenges(challenger_fid, opponent_fid) 
WHERE status IN ('pending', 'accepted') 
  AND created_at > NOW() - INTERVAL '24 hours';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

-- Leaderboard: public read, insert allowed
CREATE POLICY "Public read access" ON leaderboard FOR SELECT USING (true);
CREATE POLICY "Allow insert" ON leaderboard FOR INSERT WITH CHECK (true);

-- Notification tokens: service role only
CREATE POLICY "Service role only" ON notification_tokens FOR ALL USING (false);

-- Challenges: public read, insert/update allowed
CREATE POLICY "Public read challenges" ON challenges FOR SELECT USING (true);
CREATE POLICY "Allow create challenges" ON challenges FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update challenges" ON challenges FOR UPDATE USING (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get week start date
CREATE OR REPLACE FUNCTION get_week_start()
RETURNS DATE AS $$
BEGIN
    RETURN date_trunc('week', CURRENT_DATE)::DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-expire old challenges (run periodically)
CREATE OR REPLACE FUNCTION expire_old_challenges()
RETURNS void AS $$
BEGIN
    UPDATE challenges 
    SET status = 'expired' 
    WHERE status = 'pending' 
      AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
