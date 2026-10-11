-- Clal Insurance catalog: my brand, real competitors with name variants, domains, topics and test questions.
-- Replaces the PassportCard demo seed from the initial migration.

ALTER TABLE public.brands
    ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';

-- Remove the demo seed (cascades to questions, answers and rankings)
DELETE FROM public.brands;
DELETE FROM public.topics;

-- Brands. "aliases" are the ways AI answers write the brand name; matching is case-insensitive.
INSERT INTO public.brands (name, website_url, is_mine, aliases) VALUES
    ('כלל ביטוח', 'https://www.clalbit.co.il', true,
        ARRAY['כלל ביטוח', 'כלל חברה לביטוח', 'כלל ביטוח ופיננסים', 'כלל החזקות', 'כלל פנסיה וגמל', 'כלל', 'Clal Insurance', 'Clal']),
    ('הראל', 'https://www.harel-group.co.il', false,
        ARRAY['הראל ביטוח', 'הראל השקעות', 'הראל חברה לביטוח', 'הראל', 'Harel']),
    ('מגדל', 'https://www.migdal.co.il', false,
        ARRAY['מגדל ביטוח', 'מגדל חברה לביטוח', 'מגדל מקפת', 'מגדל', 'Migdal']),
    ('הפניקס', 'https://www.fnx.co.il', false,
        ARRAY['הפניקס', 'פניקס', 'The Phoenix', 'Phoenix']),
    ('מנורה מבטחים', 'https://www.menoramivt.co.il', false,
        ARRAY['מנורה מבטחים', 'מנורה', 'Menora Mivtachim', 'Menora']),
    ('איילון', 'https://www.ayalon-ins.co.il', false,
        ARRAY['איילון ביטוח', 'איילון חברה לביטוח', 'Ayalon Insurance', 'Ayalon']),
    ('הכשרה ביטוח', 'https://www.hcsra.co.il', false,
        ARRAY['הכשרה ביטוח', 'הכשרה חברה לביטוח', 'Hachshara']),
    ('ביטוח ישיר', 'https://www.555.co.il', false,
        ARRAY['ביטוח ישיר', 'IDI', 'Direct Insurance']),
    ('AIG', 'https://www.aig.co.il', false,
        ARRAY['AIG', 'איי איי ג''י', 'איי.איי.ג''י']),
    ('ליברה', 'https://www.libra.co.il', false,
        ARRAY['ליברה', 'Libra']),
    ('ווישור', 'https://www.wesure.co.il', false,
        ARRAY['ווישור', 'WeSure']),
    ('פספורטכארד', 'https://www.passportcard.co.il', false,
        ARRAY['פספורטכארד', 'פספורט כארד', 'PassportCard']),
    ('אלטשולר שחם', 'https://www.as-invest.co.il', false,
        ARRAY['אלטשולר שחם', 'אלטשולר', 'Altshuler Shaham']),
    ('מיטב', 'https://www.meitav.co.il', false,
        ARRAY['מיטב דש', 'מיטב בית השקעות', 'מיטב גמל', 'Meitav']);

-- Topics and questions, one block per domain (domain ids match src/lib/catalog.ts)
WITH t AS (
    INSERT INTO public.topics (name, domain_id) VALUES
        ('בחירת ביטוח רכב', 'car'),
        ('ביטוח דירה ומבנה', 'home'),
        ('ביטוח בריאות וסיעודי', 'health'),
        ('ביטוח חיים וריסק', 'life'),
        ('ביטוח נסיעות לחו״ל', 'travel'),
        ('פנסיה, גמל והשתלמות', 'pension'),
        ('שירות ותביעות', 'service')
    RETURNING id, domain_id
)
INSERT INTO public.questions (topic_id, text)
SELECT t.id, q.text
FROM t
JOIN (VALUES
    ('car', 'איזו חברת ביטוח רכב הכי מומלצת בישראל?'),
    ('car', 'מה ההבדל בין ביטוח מקיף לביטוח צד ג׳?'),
    ('car', 'איך להוזיל את ביטוח הרכב?'),
    ('home', 'מה חברות הביטוח הטובות ביותר לביטוח דירה בישראל?'),
    ('home', 'איזה ביטוח דירה כדאי לשוכרים?'),
    ('home', 'מה ההבדל בין ביטוח מבנה לביטוח תכולה?'),
    ('health', 'איזו חברה נותנת את ביטוח הבריאות הפרטי הכי טוב בישראל?'),
    ('health', 'האם כדאי ביטוח בריאות פרטי בנוסף לשב״ן?'),
    ('health', 'מה זה ביטוח סיעודי ואיפה כדאי לעשות אותו?'),
    ('life', 'איפה כדאי לעשות ביטוח חיים ריסק?'),
    ('life', 'כמה עולה ביטוח חיים למשכנתא ואיפה הכי זול?'),
    ('life', 'איך משווים בין ביטוחי חיים של חברות שונות?'),
    ('travel', 'מה ביטוח הנסיעות הכי טוב לחו״ל?'),
    ('travel', 'האם ביטוח נסיעות של כרטיס אשראי מספיק?'),
    ('travel', 'ביטוח נסיעות עם מצב רפואי קיים – איפה כדאי לעשות?'),
    ('pension', 'איזו קרן פנסיה הכי טובה בישראל?'),
    ('pension', 'איפה כדאי לפתוח קרן השתלמות?'),
    ('pension', 'מה ההבדל בין קופת גמל להשקעה לפוליסת חיסכון?'),
    ('service', 'איזו חברת ביטוח הכי טובה בשירות ובתשלום תביעות?'),
    ('service', 'איך מגישים תביעה לחברת ביטוח?'),
    ('service', 'מה עושים כשחברת הביטוח דוחה תביעה?')
) AS q(domain_id, text) ON q.domain_id = t.domain_id;

-- Settings: my brand, and source switches keyed by the collector's source ids
DELETE FROM public.settings
WHERE key IN ('source_google_ai_overview', 'source_perplexity');

INSERT INTO public.settings (key, value) VALUES
    ('brand_name', 'כלל ביטוח'),
    ('site_url', 'https://www.clalbit.co.il'),
    ('source_chatgpt', 'true'),
    ('source_gemini', 'true'),
    ('source_claude', 'true'),
    ('source_google', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
