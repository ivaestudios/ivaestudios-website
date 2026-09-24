#!/usr/bin/env python3
"""Add a comparison table to the "X vs Y" posts that rank 8 to 10 with no clicks.

Measured 2026-09-24 in Search Console: the Secrets vs Dreams post collects about
500 impressions across query variants at position 9 to 10 and ZERO clicks, the
largest striking-distance cluster on the site. For "X vs Y" queries Google
favours a scannable comparison table and often lifts it into a featured snippet.
Every cell below is taken from the article's own text: nothing new is claimed.
The table styling reuses the .cmp-table rules injected once per page.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

CSS = (".cmp-table-wrap{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}"
       ".cmp-table caption{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}"
       ".cmp-table{width:100%;border-collapse:collapse;margin:32px 0;font-size:13px;background:var(--cream);border:1px solid var(--border-l)}"
       ".cmp-table thead{background:#f3eee3}"
       ".cmp-table th{font-family:'Syne',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:var(--ink);padding:14px 12px;text-align:left;border-bottom:1px solid var(--border-l)}"
       ".cmp-table td{padding:14px 12px;line-height:1.55;color:var(--muted-l);border-bottom:1px solid var(--border-l);vertical-align:top}"
       ".cmp-table tbody tr:last-child td{border-bottom:none}"
       ".cmp-table .row-label{font-family:'Cormorant Garamond',serif;font-size:17px;color:var(--ink);font-style:italic}"
       "@media(max-width:767px){.cmp-table,.cmp-table thead,.cmp-table tbody,.cmp-table tr,.cmp-table td{display:block;width:100%;border:none}"
       ".cmp-table thead{display:none}"
       ".cmp-table tr{margin-bottom:14px;padding:18px 16px;background:var(--cream);border:1px solid var(--border-l)}"
       ".cmp-table td{padding:6px 0;text-align:left;font-size:14px}"
       ".cmp-table .row-label{font-size:19px;border-bottom:1px solid var(--border-l);padding-bottom:10px;margin-bottom:8px}"
       ".cmp-table td[data-col]::before{content:attr(data-col) ' · ';font-family:'Syne',sans-serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted-l)}}")


def tabla(cap, cols, filas):
    th = "".join("<th>%s</th>" % c for c in cols)
    tr = ""
    for f in filas:
        celdas = '<td class="row-label">%s</td>' % f[0]
        celdas += "".join('<td data-col="%s">%s</td>' % (cols[i + 1], v) for i, v in enumerate(f[1:]))
        tr += "<tr>%s</tr>" % celdas
    return ('<div class="cmp-table-wrap"><table class="cmp-table"><caption class="sr-only">%s</caption>'
            "<thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>") % (cap, th, tr)


def inserta(path, ancla_h2, html):
    t = open(path, encoding="utf-8").read()
    if 'class="cmp-table"' in t:
        return "ya tiene tabla"
    if ".cmp-table{" not in t:
        j = t.rfind("</style>")
        if j < 0:
            return "sin <style>"
        t = t[:j] + CSS + t[j:]
    m = re.search(r'<h2 id="%s"' % ancla_h2, t)
    if not m:
        return "no encuentro el h2 " + ancla_h2
    t = t[:m.start()] + html + t[m.start():]
    open(path, "w", encoding="utf-8").write(t)
    return None
