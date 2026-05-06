# SEO Rollback Playbook

## When to rollback
- Keyword rotation caused unexpected page changes (titles/descriptions look bad)
- Content changes broke schema or links
- A new venue page is causing redirect loops
- Weekly report opened a `seo:regression` issue you can attribute to a recent commit

## How to rollback (1 minute)

1. Find the offending commit:
   ```
   git log --oneline -20 | grep -E "rotate keywords|seo|keyword"
   ```

2. Revert it:
   ```
   git revert <SHA>
   git push origin main
   ```

3. Cloudflare auto-redeploys in 30-60s.

## Verify rollback

- Visit `ivaestudios.com` — should show pre-rotation state.
- Check Cloudflare dashboard → recent deploys → confirm new build is live.
- Run `python3 scripts/audit_links.py --fail-on-broken` locally to confirm no
  broken internal links were introduced by the revert itself.
- Trigger `SEO — Index URLs` workflow (Actions tab → Run workflow) so Google
  re-fetches the reverted pages quickly.

## Edge cases

- If multiple rotations are layered, revert the merge commit:
  ```
  git revert -m 1 <merge-sha>
  ```
- If a content commit introduced a redirect loop, also purge Cloudflare cache:
  Actions → `Cache purge — Cloudflare` → Run workflow with the affected URL.
- Search Console will catch up within 24-48h after the redeploy. Do NOT keep
  reverting if reports look bad on the same Monday — wait for one full cycle.
