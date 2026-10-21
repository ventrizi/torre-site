/* Camada de dados da Torre v2: o HISTÓRICO fica no servidor (PostgreSQL), não no navegador. */
(function () {
  "use strict";
  const $$ = (i) => document.getElementById(i); const on = (id, ev, fn) => { const el = $$(id); if (el) el.addEventListener(ev, fn); };
  const MAXMEM = Math.max(2, +window.TORRE_CORTES_EM_MEMORIA || 10);
  const clone = (x) => JSON.parse(JSON.stringify(x || {}));
  const VAZIO_QA = clone(window.META ? META.qa : {}), HOL_BASE = clone(window.HOL || []);
  const trocar = (o, n) => { if (!o) return; Object.keys(o).forEach((k) => delete o[k]); Object.assign(o, n); };
  const trocarLista = (l, n) => { if (!l) return; l.length = 0; (n || []).forEach((x) => l.push(x)); };
  const api = () => ((($$("fsv") && $$("fsv").value) || "").trim() || localStorage.getItem("torreApi") || window.TORRE_API || "").replace(/\/+$/, ""); const token = () => ((($$("ftk") && $$("ftk").value) \vert{}\vert{} sessionStorage.getItem("torreToken") \vert{}\vert{} "")).trim(); const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); const mb = (b) => (b / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 }); let ESTADO = null, EM = null, SNAPS = [];    function msg(html, tipo) { const e = $$("fs");
    if (!e) return;
    e.className = "note " + (tipo || "");
    e.innerHTML = html;
  }

  /* ---------- requisições ---------- */
  class ErroApi extends Error { constructor(m, status, corpo) { super(m); this.status = status; this.corpo = corpo; } }
  async function req(caminho, opc) {
    opc = opc || {};
    if (!api()) throw new ErroApi("Informe o endereço do servidor (Render).", 0);
    if (!token()) throw new ErroApi("Informe a chave de acesso.", 401);
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), opc.timeout || 90000);
    try {
      const r = await fetch(api() + caminho, { method: opc.method || "GET", body: opc.body, signal: ctl.signal, headers: { "X-Torre-Token": token(), ...(opc.headers || {}) } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new ErroApi(j.erro || j.error || "Erro HTTP " + r.status, r.status, j);
      return j;
    } catch (e) {
      if (e instanceof ErroApi) throw e;
      throw new ErroApi(e.name === "AbortError" ? "O servidor demorou demais para responder (pode estar acordando; tente novamente em 1 minuto)." : "Não consegui falar com o servidor (endereço errado, servidor iniciando ou bloqueio de CORS).", 0);
    } finally { clearTimeout(tm); }
  }

  /* ---------- memória enxuta ---------- */
  const USO = {};
  function evict(keep) {
    const ks = Object.keys(SN); if (ks.length <= MAXMEM) return;
    const prot = new Set((keep || []).filter(Boolean)); if (snk) prot.add(snk);
    ks.filter((k) => !prot.has(k)).sort((a, b) => (USO[a] || 0) - (USO[b] || 0)).slice(0, ks.length - MAXMEM).forEach((k) => delete SN[k]);
  }
  window.torreCarregar = async (need, keep) => {
    for (const k of need) { if (SN[k] || !SNX.has(k)) continue; SN[k] = await req("/api/v2/corte/" + encodeURIComponent(k)); USO[k] = Date.now(); }
    (keep || []).forEach((k) => { if (k) USO[k] = Date.now(); });
    evict(keep);
  };

  /* ---------- carregar o estado do servidor ---------- */
  function aplicarVazio() {
    trocar(SN, {}); SNX.clear(); trocar(AG, {}); trocar(REM, {}); trocarLista(Z65, []); trocarLista(HOL, clone(HOL_BASE));
    META.qa = clone(VAZIO_QA); META.val = {}; META.fr1 = {}; META.fr2 = {};
  }
  async function recarregar(em) {
    EM = em || null; window.TORRE_HISTORICO = !!EM;
    const q = EM ? "?em=" + encodeURIComponent(EM) : "";
    const ix = await req("/api/v2/estado" + q); ESTADO = ix;
    const a = ix.cortes.length || ix.agenda_dias.length ? await req("/api/v2/agenda" + q) : { AG: {}, Z65: [], REM: {} };
    if (!EM) await carregarAlertas();
    aplicarVazio();
    ix.cortes.forEach((c) => SNX.add(c.chave));
    META.val = ix.meta.val || {}; META.fr1 = ix.meta.fr1 || {}; META.fr2 = ix.meta.fr2 || {}; META.qa = ix.qa || clone(VAZIO_QA);
    if (ix.hol && ix.hol.length) trocarLista(HOL, ix.hol);
    trocar(AG, a.AG || {}); trocarLista(Z65, a.Z65 || []); trocar(REM, a.REM || {});
    const rec = [...SNX].sort().slice(-MAXMEM); await window.torreCarregar(rec, rec.slice(-2));
  }
  function situacao() {
    if ($$("fp")) $$("fp").disabled = !!EM;
    if ($$("fx")) $$("fx").disabled = !!EM;
    const ix = ESTADO;
    if (!ix) {
      if ($$("fe")) $$("fe").textContent = "Sem conexão com o servidor.";
      if ($$("fst")) $$("fst").textContent = "";
      return;
    }
    const ks = ix.cortes.map((c) => c.chave).sort(), ds = ix.agenda_dias;
    if ($$("fe")) { $$("fe").textContent = (ks.length || ds.length)
        ? `Histórico no servidor: ${ks.length} corte(s)${ks.length ? " (" + fdy(ks[0].slice(0, 10)) + " a " + fdy(ks[ks.length - 1].slice(0, 10)) + ")" : ""}; agenda ${ds.length ? fdy(ds[0]) + " a " + fdy(ds[ds.length - 1]) : "não carregada"}.`
        : "O servidor ainda não tem dados.";
    }
    const ar = ix.armazenamento, u = ix.ultimas_atualizacoes && ix.ultimas_atualizacoes[0];
    if ($$("fst")) { $$("fst").innerHTML = `Memória: ${Object.keys(SN).length} de ${SNX.size} corte(s) abertos (máx. ${MAXMEM}) · ` +
        (ar && ar.bytes != null ? `banco: ${mb(ar.bytes)} MB de ${ar.limite_mb} MB (${ar.percentual}%)${ar.alerta ? ' <b style="color:#fb923c">⚠️ perto do limite do plano gratuito</b>' : ""} · ` : "") +
        `retenção do histórico: ${ix.config.retencao_dias} dias (cortes com mais de ${ix.config.arquivar_apos_dias} dias ficam compactados e sem nome de cliente)` +
        (u ? ` · última atualização: ${u.ok ? "✅" : "❌ falhou"} ${esc(u.em.replace("T", " ").slice(0, 16))} UTC` : "");
    }
    const s = $$("fsvn"); if (s) s.textContent = (api() ? "Servidor: " + api() : "Servidor: não informado.") + (ix.config && ix.config.regras_versao ? " · regras de cálculo v" + ix.config.regras_versao : ""); } const dthm = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); async function carregarSnaps() { try { SNAPS = (await req("/api/v2/snapshots?limite=200")).snapshots; const o = $$("fem"); if (!o) return;
      o.innerHTML = '<option value="">Estado atual (último snapshot válido)</option>' + SNAPS.map((s) => `<option value="${esc(s.criado_em)}"${EM === s.criado_em ? " selected" : ""}>${esc(dthm(s.criado_em))} · ${esc(s.tipo)}${s.corte ? " · corte " + esc(s.corte.replace("|", " ")) : ""}</option>`).join("");
    } catch (e) { /* sem snapshots ainda */ }
  }

  /* ---------- alertas COMPARTILHADOS ---------- */
  const SRVK = new Set(), ENV = {}; let tLog = null;
  const assin = (e) => [e.l, e.t, e.det, e.ack, e.res, e.ns ? 1 : 0, e.inc ? 1 : 0].join("~");
  const ctxLatest = () => { const k = [...SNX].sort().pop(); return k ? k.slice(0, 10) + "|" + k : null; };
  const menor = (a, b) => (a && (!b || a <= b) ? a : b);
  function mesclarServidor(srv) {
    let mudou = false;
    Object.values(srv || {}).forEach((s) => {
      SRVK.add(s.k); const l = LOG[s.k];
      if (!l) { LOG[s.k] = { k: s.k, t: s.t, l: s.l, c: s.c, inc: s.inc, ctx: s.ctx, det: s.det, ack: s.ack, res: s.res }; mudou = true; }
      else { const n = { det: menor(l.det, s.det), ack: menor(l.ack, s.ack), res: menor(l.res, s.res) }; if (n.det !== l.det || n.ack !== l.ack || n.res !== l.res) mudou = true; Object.assign(l, n); }
      ENV[s.k] = assin(LOG[s.k]);
    });
    return mudou;
  }
  async function carregarAlertas() {
    const locais = Object.values(LOG).filter((e) => e && e.k);
    if (locais.length && !sessionStorage.getItem("torreLogMigrado")) {
      await req("/api/v2/alertas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entradas: locais.map((e) => ({ k: e.k, t: e.t, l: e.l, c: e.c, inc: e.inc, ctx: e.ctx, det: e.det, ack: e.ack, res: e.res })) }) }).catch(() => {});
      sessionStorage.setItem("torreLogMigrado", "1");
    }
    try { localStorage.removeItem("torreAlertLog_v1"); } catch (e) { /* ignora */ }
    const r = await req("/api/v2/alertas"); LOG = {}; mesclarServidor(r.alertas);
  }
  async function enviarLog() {
    if (window.TORRE_HISTORICO) return;
    const lat = ctxLatest(), ent = [];
    for (const e of Object.values(LOG)) {
      if (e.ctx !== lat && !SRVK.has(e.k)) continue;
      const s = assin(e); if (ENV[e.k] === s) continue;
      ent.push({ k: e.k, t: e.t, l: e.l, c: e.c, inc: e.inc, ctx: e.ctx, det: e.det, ack: e.ack, res: e.res, ausente: !!e.ns && !e.res }); ENV[e.k] = s;
    }
    if (!ent.length) return;
    try { await req("/api/v2/alertas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entradas: ent }) }); ent.forEach((x) => SRVK.add(x.k)); }
    catch (e) { ent.forEach((x) => delete ENV[x.k]); }
  }
  window.torreLogSalvar = () => { if (window.TORRE_HISTORICO) return; clearTimeout(tLog); tLog = setTimeout(enviarLog, 700); };
  async function atualizarAlertasRemotos() {
    if (!ESTADO || EM || document.hidden) return;
    try { const r = await req("/api/v2/alertas"); if (mesclarServidor(r.alertas)) draw(); } catch (e) { /* ignora */ }
  }
  setInterval(atualizarAlertasRemotos, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) atualizarAlertasRemotos(); });

  let TOKEN_OK = null;
  async function entrar(silencioso, em) {
    try {
      msg("⏳ Carregando o histórico do servidor… (o plano gratuito pode levar cerca de 1 minuto para acordar)");
      await recarregar(em); TOKEN_OK = token(); if (window.torreBoot) torreBoot(); situacao(); await carregarSnaps();
      msg(EM ? `🕓 Você está vendo o estado de <b>${esc(dthm(EM))}</b> (somente leitura): atualizar, limpar e gravar alertas ficam bloqueados. Volte para "Estado atual" para operar.` : "✅ Conectado. O histórico vem do servidor.", EM ? "" : "ok");
    } catch (e) {
      if (e.status === 401) sessionStorage.removeItem("torreToken");
      aplicarVazio(); if (window.torreBoot) torreBoot(); ESTADO = null; situacao();
      msg(silencioso && !token() ? "Informe o endereço do servidor e a chave de acesso para carregar o histórico." : "❌ " + esc(e.message), silencioso && !token() ? "" : "err");
    }
  }

  /* ---------- campos e botões (protegidos com on()) ---------- */
  if ($$("fsv")) $$("fsv").value = localStorage.getItem("torreApi") || window.TORRE_API || "";
  if ($$("ftk")) $$("ftk").value = sessionStorage.getItem("torreToken") || "";
  on("fsv", "change", () => { localStorage.setItem("torreApi", $$("fsv").value.trim()); }); on("ftk", "change", () => { const v = $$("ftk").value.trim(); sessionStorage.setItem("torreToken", v); if (ESTADO && v === TOKEN_OK) return; entrar(false); });

  function inferirCorte(nome) {
    const m = nome.match(/(\d{2})-(\d{2})[_ -]?(AM|PM)/i) || nome.match(/(\d{2})(\d{2})[_ -]?(AM|PM)/i);
    if (m) {
      if ($$("fcd")) $$("fcd").value = `${new Date().getFullYear()}-${m[2]}-${m[1]}`;
      if ($$("fct")) $$("fct").value = m[3].toUpperCase(); } } on("fc", "change", () => { const f = $$("fc").files[0]; if (f) inferirCorte(f.name); });

  on("ft", "click", async () => {
    msg("⏳ Testando a conexão…");
    try {
      const r = await fetch(api() + "/api/v2/saude"); const j = await r.json();
      msg(`${j.banco === "ok" ? "✅" : "⚠️"} Servidor ativo (${esc(j.versao)}) · banco: ${esc(j.banco)} · acesso ${j.acesso_configurado ? "configurado" : "NÃO configurado"} · administração ${j.admin_configurado ? "configurada" : "NÃO configurada"}.`, j.banco === "ok" ? "ok" : "err");
    } catch (e) { msg("❌ Sem resposta: o servidor pode estar iniciando (~1 min), o endereço pode estar errado ou o CORS bloqueou.", "err"); }
  });

  on("fr", "click", () => entrar(false, null));
  on("fem", "change", () => entrar(false, $$("fem").value \vert{}\vert{} null));    /* ---------- atualizar ---------- */ on("fp", "click", async () => { const fc = $$("fc") && $$("fc").files[0], fa = $$("fa") && $$("fa").files[0], btn = $$("fp");
    if (!fc && !fa) { msg("Escolha ao menos uma planilha (carteira ou agendamento).", "err"); return; }
    if (fc && !($$("fcd") && $$("fcd").value)) { msg("Informe a data do corte da carteira.", "err"); return; }
    const fd = new FormData();
    if (fc) { fd.append("carteira", fc); fd.append("corte", $$("fcd").value); fd.append("turno", $$("fct").value); }
    if (fa) fd.append("agendamento", fa);
    if (btn) btn.disabled = true;
    msg("⏳ Enviando e validando… se algo falhar, o último estado válido do servidor é mantido.");
    try {
      const j = await req("/api/v2/atualizar", { method: "POST", body: fd, timeout: 180000 });
      const r = j.resumo || {}, partes = [];
      if (r.carteira) partes.push(`carteira ${fdy(r.carteira.chave.slice(0, 10))} ${r.carteira.chave.endsWith("AM") ? "manhã" : "tarde"}: ${r.carteira.remessas.toLocaleString("pt-BR")} remessas`);
      if (r.agenda) partes.push(`agendamento: ${r.agenda.dias.length} dia(s), ${r.agenda.cargas.toLocaleString("pt-BR")} cargas`);
      const av = [...(j.avisos || [])];
      if (r.retencao && (r.retencao.cortes || r.retencao.agenda_dias)) av.push(`Retenção: ${r.retencao.cortes} corte(s) e ${r.retencao.agenda_dias} dia(s) de agenda antigos removidos.`);
      await recarregar(); if (window.torreBoot) torreBoot(); situacao();
      msg("✅ Atualizado — " + partes.join(" · ") + (av.length ? "<ul>" + av.map((a) => "<li>" + (a.startsWith("<") ? a : esc(a)) + "</li>").join("") + "</ul>" : ""), "ok");
      ["fc", "fa"].forEach((i) => { if ($$(i))$$(i).value = ""; });
    } catch (e) {
      msg("❌ " + esc(e.message) + (e.status === 422 || e.status === 500 ? " <b>Nenhum dado foi alterado: o último estado válido foi preservado.</b>" : ""), "err");
    } finally { if (btn) btn.disabled = false; }
  });

  /* ---------- administração: limpeza validada NO SERVIDOR ---------- */
  function modalLimpeza() {
    const cortes = [...SNX].sort().reverse();
    const d = document.createElement("div"); d.className = "admmask";
    d.innerHTML = `<form class="admbox" style="max-width:92vw;width:420px"><h4>Limpeza administrativa</h4>
      <label>O que apagar<select id="aesc"><option value="corte">Um corte da carteira</option><option value="cortes">Todos os cortes da carteira</option><option value="agenda">Toda a agenda (etiquetas, faturamento, qualidade)</option><option value="tudo">TUDO (carteira, agenda e feriados)</option></select></label>
      <label id="acw">Corte<select id="ac">${cortes.map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
      <div class="note" id="aprev">Calculando o que seria apagado…</div>
      <label>Senha de administrador<input type="password" id="asn" autocomplete="off"></label>
      <label>Para confirmar, digite exatamente: <b id="afr"></b><input id="acf" autocomplete="off"></label>
      <div class="note">A senha é conferida no servidor. Esta ação não pode ser desfeita. O histórico de atualizações e a auditoria são preservados.</div>
      <div class="admbt"><button type="submit" id="aok" disabled>Apagar definitivamente</button><button type="button" data-x>Cancelar</button></div></form>`;
    document.body.appendChild(d);
    const q = (s) => d.querySelector(s), escopo = () => (q("#aesc").value === "corte" ? "corte:" + q("#ac").value : q("#aesc").value);
    let seqPrevia = 0;
    const atualizar = async () => {
      q("#acw").style.display = q("#aesc").value === "corte" ? "" : "none";
      const e = escopo(), meu = ++seqPrevia; q("#afr").textContent = "APAGAR " + e; q("#acf").value = ""; q("#aok").disabled = true; q("#aprev").textContent = "Calculando o que seria apagado em " + e + "…";
      if (q("#aesc").value === "corte" && !cortes.length) { q("#aprev").textContent = "Não há cortes para apagar."; return; }
      try {
        const p = await req("/api/v2/admin/previa?escopo=" + encodeURIComponent(e)); if (meu !== seqPrevia) return;
        const s = p.seria_apagado; q("#aprev").innerHTML = `Escopo <b>${esc(e)}</b> — seria apagado: ` + (Object.entries(s).filter(([, n]) => n).map(([k, n]) => `<b>${n.toLocaleString("pt-BR")}</b> ${k.replace(/_/g, " ")}`).join(" · ") || "nada");
      } catch (er) { if (meu === seqPrevia) q("#aprev").textContent = "Não consegui calcular a prévia: " + er.message; }
    };
    q("#aesc").onchange = atualizar; q("#ac").onchange = atualizar; atualizar();
    q("#acf").oninput = () => { q("#aok").disabled = q("#acf").value !== "APAGAR " + escopo(); };
    const fim = () => d.remove(); q("[data-x]").onclick = fim; d.onclick = (e) => { if (e.target === d) fim(); };
    q("form").onsubmit = async (ev) => {
      ev.preventDefault(); q("#aok").disabled = true; const e = escopo();
      try {
        const j = await req("/api/v2/admin/limpar", { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Senha": q("#asn").value }, body: JSON.stringify({ escopo: e, confirmacao: q("#acf").value }) });
        fim(); await recarregar(); if (window.torreBoot) torreBoot(); situacao();
        msg(`🗑️ Limpeza concluída (${esc(e)}): ` + Object.entries(j.apagado).filter(([, n]) => n).map(([k, n]) => `${n.toLocaleString("pt-BR")} ${k.replace(/_/g, " ")}`).join(" · "), "ok");
      } catch (er) { q("#aprev").innerHTML = `<b style="color:#fb923c">❌ ${esc(er.message)}</b>`; q("#asn").value = ""; q("#acf").value = ""; }
    };
  }
  on("fx", "click", () => { if (!ESTADO) { msg("Conecte-se ao servidor antes (endereço e chave de acesso).", "err"); return; } modalLimpeza(); });

  window.__upload = true;
  entrar(true);
})();
