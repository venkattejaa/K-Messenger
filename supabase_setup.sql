-- K-Messenger Supabase Database Setup Script
-- Paste and run this script in your Supabase Dashboard -> SQL Editor

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  passcode TEXT NOT NULL DEFAULT '1234',
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT DEFAULT 'Available for chat ✨',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender_id BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
  text_content TEXT,
  media_url TEXT,
  reactions JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create OTPs Table
CREATE TABLE IF NOT EXISTS public.otps (
  email TEXT PRIMARY KEY,
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- 4. Enable Supabase Realtime on Messages Table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 5. Insert Initial Default Users (user1 & user2 / venkattejaa)
INSERT INTO public.users (username, passcode, display_name, bio)
VALUES 
  ('venkattejaa', '1234', 'Venkat Teja', 'Hey there! Ready for encrypted calls ✨'),
  ('user2', '1234', 'Bob Smith', 'Available for real-time messaging 🚀')
ON CONFLICT (username) DO NOTHING;

-- 6. Disable RLS for simple direct table access, or add full permissive policies
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.otps DISABLE ROW LEVEL SECURITY;

-- 7. Storage Bucket Setup (Create public storage bucket 'chat_media')
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat_media', 'chat_media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Allow public read and write access for chat media uploads
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'chat_media');
CREATE POLICY "Public Upload Access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat_media');
