-- GEO initial schema: brands, topics, questions, source answers, rankings, snapshots, settings

-- Brands in the benchmark
CREATE TABLE public.brands (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    website_url text,
    is_mine boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.brands TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read brands"
    ON public.brands
    FOR SELECT
    TO anon
    USING (true);

-- Topics / domains
CREATE TABLE public.topics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    domain_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.topics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topics TO authenticated;
GRANT ALL ON public.topics TO service_role;

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read topics"
    ON public.topics
    FOR SELECT
    TO anon
    USING (true);

-- Questions tracked by the system
CREATE TABLE public.questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    text text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read questions"
    ON public.questions
    FOR SELECT
    TO anon
    USING (true);

-- Raw answers collected from each AI source for a question
CREATE TABLE public.source_answers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    source text NOT NULL,
    summary text,
    raw_response text,
    collected_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (question_id, source)
);

GRANT SELECT ON public.source_answers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_answers TO authenticated;
GRANT ALL ON public.source_answers TO service_role;

ALTER TABLE public.source_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read source_answers"
    ON public.source_answers
    FOR SELECT
    TO anon
    USING (true);

-- Brand ranking inside a source answer
CREATE TABLE public.answer_rankings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_answer_id uuid NOT NULL REFERENCES public.source_answers(id) ON DELETE CASCADE,
    brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    position int,
    mentioned boolean NOT NULL DEFAULT false,
    has_link boolean NOT NULL DEFAULT false,
    UNIQUE (source_answer_id, brand_id)
);

GRANT SELECT ON public.answer_rankings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.answer_rankings TO authenticated;
GRANT ALL ON public.answer_rankings TO service_role;

ALTER TABLE public.answer_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read answer_rankings"
    ON public.answer_rankings
    FOR SELECT
    TO anon
    USING (true);

-- Daily snapshots of computed metrics
CREATE TABLE public.snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
    domain_id text NOT NULL DEFAULT 'all',
    metric_name text NOT NULL,
    metric_value numeric NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (snapshot_date, domain_id, metric_name)
);

GRANT SELECT ON public.snapshots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.snapshots TO authenticated;
GRANT ALL ON public.snapshots TO service_role;

ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read snapshots"
    ON public.snapshots
    FOR SELECT
    TO anon
    USING (true);

-- Collection run log
CREATE TABLE public.collection_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    status text NOT NULL DEFAULT 'running',
    logs jsonb NOT NULL DEFAULT '[]'::jsonb,
    questions_processed int NOT NULL DEFAULT 0,
    total_questions int NOT NULL DEFAULT 0
);

GRANT SELECT ON public.collection_runs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_runs TO authenticated;
GRANT ALL ON public.collection_runs TO service_role;

ALTER TABLE public.collection_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read collection_runs"
    ON public.collection_runs
    FOR SELECT
    TO anon
    USING (true);

-- App settings (brand name, active sources, etc.)
CREATE TABLE public.settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read settings"
    ON public.settings
    FOR SELECT
    TO anon
    USING (true);

-- Seed default settings
INSERT INTO public.settings (key, value) VALUES
    ('brand_name', 'פספורטכארד'),
    ('site_url', 'https://mysite.co.il'),
    ('source_gemini', 'true'),
    ('source_chatgpt', 'true'),
    ('source_claude', 'false'),
    ('source_perplexity', 'false'),
    ('source_google_ai_overview', 'false')
ON CONFLICT (key) DO NOTHING;

-- Seed brands
INSERT INTO public.brands (name, website_url, is_mine) VALUES
    ('מגדל ביטוח', 'https://www.migdal.co.il', false),
    ('פספורטכארד', 'https://www.passportcard.co.il', true),
    ('תשעה מיליון', 'https://www.9million.co.il', false),
    ('הראל ביטוח', 'https://www.harel-group.co.il', false),
    ('הפניקס', 'https://www.phoenix.co.il', false),
    ('ליברה', 'https://www.libra.co.il', false),
    ('ביטוח ישיר', 'https://www.direct-ins.co.il', false),
    ('AIG', 'https://www.aig.co.il', false)
ON CONFLICT DO NOTHING;

-- Seed topics
INSERT INTO public.topics (name, domain_id) VALUES
    ('ביטוח נסיעות לחו״ל', 'travel'),
    ('מחירי ביטוח נסיעות', 'pricing'),
    ('שירות ותביעות', 'service'),
    ('בריאות ומצב רפואי קיים', 'health')
ON CONFLICT DO NOTHING;
