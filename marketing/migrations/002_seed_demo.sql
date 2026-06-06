-- IVAE Marketing — OPTIONAL demo / starter data
-- Loads the "Regeneris Therapy" June 2026 calendar (from Vianey's Notion screenshots)
-- so the app shows real content the moment you log in.
-- Run AFTER 001_init.sql, in: Cloudflare → D1 → ivae-gallery-db → Console (paste + Run).
-- Safe to re-run: it clears this demo client's posts first, then re-inserts.
-- To remove the demo entirely later: DELETE FROM mkt_clients WHERE id='demo-regeneris';
-- ============================================================================

-- Client (regenerative medicine / stem cells, Cancún)
INSERT OR IGNORE INTO mkt_clients (id, name, slug, brand_color, instagram_handle, notes)
VALUES ('demo-regeneris', 'Regeneris Therapy', 'regeneris-therapy', '#16a34a', '@regeneristherapy',
        'Medicina regenerativa y células madre · Cancún. Calendario de junio cargado desde Notion.');

-- Fresh start for this demo client's posts (idempotent re-run)
DELETE FROM mkt_posts WHERE client_id = 'demo-regeneris';

-- Reels (tipo: reel)
INSERT INTO mkt_posts (client_id, title, content_type, grabacion, publish_date, assignee, platform, status) VALUES
('demo-regeneris', 'Un día en la vida de Misael',                  'reel', 3, '2026-06-13', 'MISAEL', 'Instagram', 'idea'),
('demo-regeneris', 'EpixLife',                                     'reel', 4, '2026-06-03', 'TODOS',  'Instagram', 'idea'),
('demo-regeneris', 'Reel trend con música',                       'reel', 4, '2026-06-12', NULL,     'Instagram', 'idea'),
('demo-regeneris', 'Reel para pauta de GLP-1',                    'reel', 5, '2026-06-01', 'MISAEL', 'Instagram', 'idea'),
('demo-regeneris', 'Reel dinámico tipo "Doctor, ¿quién eres?"',  'reel', 1, '2026-06-02', 'JAVI',   'Instagram', 'idea'),
('demo-regeneris', 'Reel del tour de la clínica',                 'reel', 5, '2026-06-22', 'NAT',    'Instagram', 'idea'),
('demo-regeneris', 'Reel del procedimiento',                      'reel', 1, '2026-06-25', 'JAVI',   'Instagram', 'idea'),
('demo-regeneris', 'Quiénes somos y qué ofrecemos',              'reel', 5, '2026-06-10', 'TODOS',  'Instagram', 'idea'),
('demo-regeneris', 'Péptidos y FDA',                              'reel', 1, '2026-06-17', 'MARIAN', 'Instagram', 'idea'),
('demo-regeneris', 'Antes y después de mi cabello con péptidos', 'reel', 5, '2026-06-09', 'NAT',    'Instagram', 'idea'),
('demo-regeneris', 'Amo mi trabajo',                              'reel', 4, '2026-06-23', 'ISA',    'Instagram', 'idea'),
('demo-regeneris', 'HAREMOS QUE PASE',                            'reel', 4, '2026-06-26', 'LU',     'Instagram', 'idea');

-- Carruseles (tipo: carrusel)
INSERT INTO mkt_posts (client_id, title, content_type, grabacion, publish_date, platform, status) VALUES
('demo-regeneris', 'articulaciones',        'carrusel', 2, '2026-06-30', 'Instagram', 'idea'),
('demo-regeneris', 'Exosomes for Your Skin','carrusel', 2, '2026-06-11', 'Instagram', 'idea'),
('demo-regeneris', 'peptidos',              'carrusel', 2, '2026-06-18', 'Instagram', 'idea'),
('demo-regeneris', 'sueros',                'carrusel', 2, '2026-06-06', 'Instagram', 'idea');

-- Featured carrusel WITH the full "Pauta 1 dolor" script (HOOK / BODY / CTA + caption + hashtags),
-- set to 'revision' + pending approval so the client portal approval flow can be tested right away.
INSERT INTO mkt_posts
  (client_id, title, content_type, grabacion, publish_date, platform, status, approval_state, client_visible,
   hook, body, cta, caption, hashtags, notes_team)
VALUES
  ('demo-regeneris', 'How stem cells help you', 'carrusel', 2, '2026-06-27', 'Instagram', 'revision', 'pending', 1,
   'They told you your knee is beyond repair, that it''s just wear and tear, and surgery is your only option.',
   'But wear and tear does not always end in the operating room. Mesenchymal stem cells help regenerate tissue and calm inflammation from within, so you can recover mobility and stop planning your day around the pain. At Regeneris Therapy, here in Cancún, we build a personalized protocol for your case. More than 3,360 patients have already gone through this process with us.',
   'Book your free virtual consultation. Link in bio.',
   'Regenerative medicine in Cancún. Stem cell therapy for joint pain and better mobility. Personalized protocol. +3,360 patients treated. Book your free virtual consultation.',
   '#stemcelltherapy #kneepain #regenerativemedicine #jointpain #cancun',
   'Pauta 1 dolor. Música tranquila, tomas dinámicas del procedimiento.');
