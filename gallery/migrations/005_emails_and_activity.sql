-- Migration 005 — Email templates + scheduled emails + activity stream view.
-- Powers FASE 3 auto-emails (publish, expire, testimonial, anniversary) and
-- the FASE 1B unified workflow timeline.

-- ── email_templates ──
-- Editable per-template HTML + subject. The trigger column says when this
-- template fires automatically (manual = only when admin clicks send).
CREATE TABLE IF NOT EXISTS email_templates (
  id           TEXT PRIMARY KEY,         -- short slug: invite, expire_warn_client, testimonial, anniversary
  name         TEXT NOT NULL,            -- human label for admin UI
  trigger      TEXT NOT NULL,            -- on_publish | on_expire_warn | on_delivery_plus_7d | on_anniversary | manual
  enabled      INTEGER NOT NULL DEFAULT 1,
  delay_days   INTEGER NOT NULL DEFAULT 0, -- offset from trigger event in days
  subject      TEXT NOT NULL,
  body_html    TEXT NOT NULL,
  reply_to     TEXT,                     -- optional override
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default templates. Variables supported by the renderer:
--   {{client_name}}, {{client_email}}, {{gallery_title}}, {{gallery_url}},
--   {{studio_name}}, {{tagline}}, {{contact_email}}, {{instagram_handle}},
--   {{expire_date}}, {{days_until_expire}}, {{photo_count}}.
INSERT OR IGNORE INTO email_templates (id, name, trigger, enabled, delay_days, subject, body_html) VALUES
  ('invite',
   'Gallery delivery (on publish)',
   'on_publish', 1, 0,
   'Your gallery is ready, {{client_name}}',
   '<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1c1c1c;line-height:1.6;">'
   || '<h1 style="font-family:Georgia,serif;font-weight:400;font-size:32px;margin:0 0 12px;">Your gallery is ready</h1>'
   || '<p style="color:#555;">Hi {{client_name}},</p>'
   || '<p>Your photos from <strong>{{gallery_title}}</strong> are now ready to view.</p>'
   || '<p style="margin:32px 0;text-align:center;"><a href="{{gallery_url}}" style="background:#1c1c1c;color:#fff;text-decoration:none;padding:14px 32px;letter-spacing:0.12em;text-transform:uppercase;font-family:Helvetica,sans-serif;font-size:11px;">View your gallery</a></p>'
   || '<p style="color:#888;font-size:13px;">With love,<br>{{studio_name}}</p>'
   || '</div>'),

  ('expire_warn_client',
   'Gallery expiring soon (to client)',
   'on_expire_warn', 1, 0,
   '{{gallery_title}} expires in {{days_until_expire}} days',
   '<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1c1c1c;line-height:1.6;">'
   || '<h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 12px;">A gentle reminder</h1>'
   || '<p style="color:#555;">Hi {{client_name}},</p>'
   || '<p>Your gallery <strong>{{gallery_title}}</strong> will expire on <strong>{{expire_date}}</strong> — just {{days_until_expire}} days from today.</p>'
   || '<p>If you''d like to keep the originals, this is a great time to download them.</p>'
   || '<p style="margin:32px 0;text-align:center;"><a href="{{gallery_url}}" style="background:#1c1c1c;color:#fff;text-decoration:none;padding:14px 32px;letter-spacing:0.12em;text-transform:uppercase;font-family:Helvetica,sans-serif;font-size:11px;">Open gallery</a></p>'
   || '<p style="color:#888;font-size:13px;">{{studio_name}}</p>'
   || '</div>'),

  ('testimonial',
   'Testimonial request (7 days after delivery)',
   'on_delivery_plus_7d', 1, 7,
   'How was your experience with us?',
   '<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1c1c1c;line-height:1.6;">'
   || '<h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 12px;">Thank you, {{client_name}}</h1>'
   || '<p>It''s been a week since we delivered your gallery. We''d love to hear how it felt to see them.</p>'
   || '<p>If you have a moment, we''d truly appreciate a few words about your experience — it helps us keep doing what we love.</p>'
   || '<p style="margin:24px 0;"><a href="https://www.google.com/search?q={{studio_name}}+reviews" style="color:#a07040;">Leave a review</a> · <a href="https://instagram.com/{{instagram_handle}}" style="color:#a07040;">Tag us @{{instagram_handle}}</a></p>'
   || '<p style="color:#888;font-size:13px;">With gratitude,<br>{{studio_name}}</p>'
   || '</div>'),

  ('anniversary',
   'Anniversary throwback (1 year after delivery)',
   'on_anniversary', 1, 365,
   'A year ago today — {{gallery_title}}',
   '<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1c1c1c;line-height:1.6;">'
   || '<h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 12px;">A year already</h1>'
   || '<p>One year ago today, we captured <strong>{{gallery_title}}</strong>.</p>'
   || '<p>Your gallery is still right here whenever you want to relive the day.</p>'
   || '<p style="margin:32px 0;text-align:center;"><a href="{{gallery_url}}" style="background:#1c1c1c;color:#fff;text-decoration:none;padding:14px 32px;letter-spacing:0.12em;text-transform:uppercase;font-family:Helvetica,sans-serif;font-size:11px;">Look back</a></p>'
   || '<p style="color:#888;font-size:13px;">With love,<br>{{studio_name}}</p>'
   || '</div>');

-- ── scheduled_emails ──
-- Queue of one-shot future emails. Cron sweeps these every day.
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id  TEXT NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  gallery_id   TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name  TEXT,
  send_after   TEXT NOT NULL,             -- ISO datetime; cron picks rows where send_after <= now
  sent_at      TEXT,                      -- non-null = already sent
  error        TEXT,                      -- non-null = last attempt failed
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_pending
  ON scheduled_emails(send_after, sent_at);

-- ── delivered_at column on galleries ──
-- Stamped when a gallery is first published. Used to compute testimonial &
-- anniversary windows. We keep status='published' separate so re-publish doesn't
-- reset the clock.
ALTER TABLE galleries ADD COLUMN delivered_at TEXT DEFAULT NULL;

-- Backfill: any gallery currently published is treated as delivered at created_at.
UPDATE galleries
   SET delivered_at = COALESCE(created_at, datetime('now'))
 WHERE status = 'published' AND delivered_at IS NULL;

-- ── Helpful index for the workflow timeline (events ordered desc) ──
-- (idx_gallery_events_gallery_time already exists from migration 004.)
