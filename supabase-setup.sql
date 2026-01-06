-- Supabase SQL Setup for Tap That Mosquito
-- Run this in the Supabase SQL Editor

-- Leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    username TEXT,
    score INTEGER NOT NULL,
    tapped INTEGER DEFAULT 0,
    best_combo INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast score sorting
CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);

-- Notification tokens table
CREATE TABLE IF NOT EXISTS notification_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fid INTEGER UNIQUE NOT NULL,
    token TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for FID lookup
CREATE INDEX IF NOT EXISTS idx_notification_fid ON notification_tokens(fid);

-- Enable Row Level Security (RLS)
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_tokens ENABLE ROW LEVEL SECURITY;

-- Allow public read access to leaderboard
CREATE POLICY "Public read access" ON leaderboard
    FOR SELECT USING (true);

-- Allow insert with anon key (rate limited by API)
CREATE POLICY "Allow insert" ON leaderboard
    FOR INSERT WITH CHECK (true);

-- Notification tokens: only service role can access
CREATE POLICY "Service role only" ON notification_tokens
    FOR ALL USING (false);
