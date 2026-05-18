-- UTool Construction Manager - Supabase Database Schema
-- Run this script inside your Supabase SQL Editor to prepare your remote database for synchronization.

-- =========================================================================
-- 1. UTOOL PARTNERS (Certified Brand Logos for Partner Marquee)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.buildflow_partners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    logo_url TEXT NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.buildflow_partners ENABLE ROW LEVEL SECURITY;

-- Create Public Access Policies
DROP POLICY IF EXISTS "Allow public read access on partners" ON public.buildflow_partners;
CREATE POLICY "Allow public read access on partners" ON public.buildflow_partners FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access on partners" ON public.buildflow_partners;
CREATE POLICY "Allow public insert access on partners" ON public.buildflow_partners FOR INSERT WITH CHECK (true);


-- Seed default construction certified partners
INSERT INTO public.buildflow_partners (name, logo_url) VALUES 
('Apex Steel Framing', 'https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?w=80&h=80&fit=crop'),
('Titan Concrete Industries', 'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?w=80&h=80&fit=crop'),
('Lumina Smart Wiring', 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=80&h=80&fit=crop'),
('Metropolis Lumber Group', 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=80&h=80&fit=crop')
ON CONFLICT DO NOTHING;


-- =========================================================================
-- 2. UTOOL JOBS (Contractor Sheets, Milestones, and Invoice Lists)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.buildflow_jobs (
    id TEXT PRIMARY KEY, -- Stores the User Session ID (buildflow_session.id)
    jobs JSONB DEFAULT '[]'::jsonb NOT NULL, -- JSONB Array containing all construction projects, client profiles, milestones & invoices
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.buildflow_jobs ENABLE ROW LEVEL SECURITY;

-- Create Public Access Policies (allowing full sync operations)
DROP POLICY IF EXISTS "Allow public read access on jobs" ON public.buildflow_jobs;
CREATE POLICY "Allow public read access on jobs" ON public.buildflow_jobs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access on jobs" ON public.buildflow_jobs;
CREATE POLICY "Allow public insert access on jobs" ON public.buildflow_jobs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access on jobs" ON public.buildflow_jobs;
CREATE POLICY "Allow public update access on jobs" ON public.buildflow_jobs FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete access on jobs" ON public.buildflow_jobs;
CREATE POLICY "Allow public delete access on jobs" ON public.buildflow_jobs FOR DELETE USING (true);


-- =========================================================================
-- 3. REALTIME REPLICATION CONFIGURATION
-- =========================================================================

-- Re-create publication or append tables if publication exists
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE 
    public.buildflow_partners,
    public.buildflow_jobs;
