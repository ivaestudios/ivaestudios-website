const { webkit } = require("playwright-core");
const PGS = process.argv.slice(2);
(async () => {
  const b = await webkit.launch({ executablePath: "/Users/ivae/Library/Caches/ms-playwright/webkit-2336/pw_run.sh" });
  for (const u of PGS) {
    const pg = await b.newPage({ viewport:{width:402,height:874}, deviceScaleFactor:1, isMobile:true, hasTouch:true });
    const errs = [];
    pg.on("pageerror", e => errs.push("JS: " + e.message.slice(0,90)));
    pg.on("response", r => { if (r.status() >= 400 && !/pinterest|cloudflareinsights|gstatic/.test(r.url())) errs.push(r.status()+" "+r.url().split("/").pop().slice(0,50)); });
    let resp = null;
    try { resp = await pg.goto(u, { waitUntil:"domcontentloaded", timeout:60000 }); } catch(e) {}
    if (!resp || !resp.ok()) { console.log("NO CARGA  " + u); await pg.close(); continue; }
    await pg.waitForTimeout(1500);

    // recorrer midiendo el PICO de opacidad de cada nodo de texto
    const hallazgos = await pg.evaluate(async () => {
      const R = e => e.getBoundingClientRect();
      const acum = e => { let o=1,n=e; while(n && n!==document.body){ o *= parseFloat(getComputedStyle(n).opacity)||1; n=n.parentElement; } return o; };
      const hojas = [...document.querySelectorAll("main *, .ivm *, article *, footer *")].filter(e => {
        const t = (e.textContent||"").trim();
        if (t.length < 4) return false;
        if ([...e.children].some(c => (c.textContent||"").trim().length > 3)) return false;
        const cs = getComputedStyle(e);
        if (cs.display==="none" || cs.visibility==="hidden") return false;
        if (e.closest("[aria-hidden='true'], .visually-hidden, .sr-only, [hidden], details:not([open])")) return false;
        const r = R(e);
        if (r.left < -500) return false;              // fuera de pantalla a propósito
        return true;
      });
      const pico = hojas.map(()=>0);
      const h = document.body.scrollHeight;
      for (let y=0; y<h; y+=140) { window.scrollTo(0,y); await new Promise(s=>setTimeout(s,26));
        hojas.forEach((e,i)=>{ const o=acum(e); if(o>pico[i]) pico[i]=o; }); }
      window.scrollTo(0,0); await new Promise(s=>setTimeout(s,300));

      const invisibles = hojas.map((e,i)=>({e,p:pico[i]})).filter(x=>x.p<0.06)
        .map(x=>({ t:(x.e.textContent||"").trim().slice(0,38), c:(x.e.className+"").split(" ")[0] }));

      // texto recortado por contenedor de alto fijo
      // Un contenedor con overflow:hidden y un hijo ABSOLUTO más alto (una
      // foto de fondo escalada, un velo) NO recorta texto: es justo para lo
      // que existe. Solo cuenta si hay TEXTO cuya caja se sale de la del padre.
      const recortados = [...document.querySelectorAll("main *, .ivm *, article *")].filter(e=>{
        const cs=getComputedStyle(e);
        if(!/hidden|clip/.test(cs.overflowY)) return false;
        if(cs.display==="none") return false;
        if(e.scrollHeight <= e.clientHeight + 8 || e.clientHeight === 0) return false;
        const pr = e.getBoundingClientRect();
        return [...e.querySelectorAll("*")].some(h=>{
          const t=(h.textContent||"").trim();
          if(t.length<4) return false;
          if([...h.children].some(c=>(c.textContent||"").trim().length>3)) return false;
          if(getComputedStyle(h).position==="absolute") return false;
          const hr=h.getBoundingClientRect();
          // caja de tamaño CERO = el elemento (o un ancestro) va en display:none.
          // Sus coordenadas son 0,0 y eso se leía como "fuera del contenedor":
          // así se coló el cabezal del cine, que en móvil está oculto a propósito.
          if(hr.width===0 && hr.height===0) return false;
          return hr.bottom > pr.bottom + 2 || hr.top < pr.top - 2;
        });
      }).map(e=>({ c:(e.className+"").split(" ")[0]||e.tagName, falta:e.scrollHeight-e.clientHeight,
                   t:(e.textContent||"").trim().slice(0,34) }));

      // áreas tocables chicas (fuera de párrafos, que ahí es normal)
      const chicos = [...document.querySelectorAll("a,button,summary")].filter(e=>{
        const r=R(e), cs=getComputedStyle(e);
        return r.width>0 && r.height>0 && r.height<40 && cs.visibility!=="hidden"
               // dentro de una frase = exento (WCAG 2.5.8) y agrandarlo rompe el renglón
               && !e.closest("p,li,td,.post-body,article p,.post-meta-bar,.faq-ans,.faq-a,.author-title,dd,blockquote,figcaption");
      }).map(e=>({ t:(e.textContent||"").trim().slice(0,22), h:Math.round(R(e).height), c:(e.className+"").split(" ")[0] }));

      // imágenes rotas
      const rotas = [...document.images].filter(i=>i.complete && i.naturalWidth===0 && i.src)
        .map(i=>i.src.split("/").pop().slice(0,40));

      // encimamientos entre hermanos en flujo
      const enc=[];
      document.querySelectorAll("section, footer").forEach(s=>{
        const hijos=[...s.children].filter(c=>{const cs=getComputedStyle(c);
          return cs.position!=="absolute" && cs.position!=="fixed" && cs.display!=="none" && R(c).height>0;});
        for(let i=0;i<hijos.length-1;i++){ const a=R(hijos[i]), b2=R(hijos[i+1]);
          if(a.bottom-b2.top>3) enc.push({s:(s.className+"").split(" ")[0], px:Math.round(a.bottom-b2.top)}); }
      });

      return { alto:h, desborde:Math.round(document.documentElement.scrollWidth-document.documentElement.clientWidth),
               invisibles, recortados, chicos, rotas, enc };
    });

    const problemas = [];
    if (hallazgos.desborde > 2) problemas.push(`desborde ${hallazgos.desborde}px`);
    if (hallazgos.invisibles.length) problemas.push(`${hallazgos.invisibles.length} INVISIBLES`);
    if (hallazgos.recortados.length) problemas.push(`${hallazgos.recortados.length} recortados`);
    if (hallazgos.chicos.length) problemas.push(`${hallazgos.chicos.length} toque<40`);
    if (hallazgos.rotas.length) problemas.push(`${hallazgos.rotas.length} img rotas`);
    if (hallazgos.enc.length) problemas.push(`${hallazgos.enc.length} encima`);
    if (errs.length) problemas.push(`${errs.length} err`);

    const corto = u.replace("https://ivaestudios.com","") || "/";
    console.log((problemas.length ? "⚠ " : "✅ ") + corto.padEnd(48) + (problemas.join(", ") || "limpio"));
    if (hallazgos.invisibles.length) console.log("     INVISIBLE:", JSON.stringify(hallazgos.invisibles.slice(0,4)));
    if (hallazgos.recortados.length) console.log("     RECORTADO:", JSON.stringify(hallazgos.recortados.slice(0,4)));
    if (hallazgos.chicos.length) console.log("     TOQUE:", JSON.stringify(hallazgos.chicos.slice(0,4)));
    if (hallazgos.rotas.length) console.log("     IMG:", JSON.stringify(hallazgos.rotas.slice(0,3)));
    if (hallazgos.enc.length) console.log("     ENCIMA:", JSON.stringify(hallazgos.enc.slice(0,3)));
    if (errs.length) console.log("     ERR:", JSON.stringify([...new Set(errs)].slice(0,3)));
    await pg.close();
  }
  await b.close();
})().catch(e => { console.error("FALLO:", e.message); process.exit(1); });
