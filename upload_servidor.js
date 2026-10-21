/* Camada de dados da Torre v2 */
(function () {
  "use strict";
  const $$ = (i) => document.getElementById(i); const on = (id, ev, fn) => { const el = $$(id); if (el) el.addEventListener(ev, fn); };
  const MAXMEM = Math.max(2, +window.TORRE_CORTES_EM_MEMORIA || 10);
  const clone = (x) => JSON.parse(JSON.stringify(x || {}));
  const VAZIO_QA = clone(window.META ? META.qa : {}), HOL_BASE = clone(window.HOL || []);
  const trocar = (o, n) => { if (!o) return; Object.keys(o).forEach((k) => delete o[k]); Object.assign(o, n); };
  const trocarLista = (l, n) => { if (!l) return; l.length = 0; (n || []).forEach((x) => l.push(x)); };
  
  const api = () => ((($$("fsv") && $$("fsv").value) || "").trim() || localStorage.getItem("torreApi") || window.TORRE_API || "").replace(/\/+$/, ""); const token = () => ((($$("ftk") && $$("ftk").value) \vert{}\vert{} sessionStorage.getItem("torreToken") \vert{}\vert{} "")).trim(); const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); const mb = (b) => (b / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 });  let ESTADO = null, EM = null, SNAPS = [];    function msg(html, tipo) { const e = $$("fs");
    if (!e) return;
    e.className = "note " + (tipo || "");
    e.innerHTML = html;
  }

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
      throw new ErroApi(e.name === "AbortError" ? "O servidor demorou demais para responder." : "Não consegui falar com o servidor.", 0);
    } finally { clearTimeout(tm); }
  }

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
    if ($$("fe")) { $$("fe").textContent = (ks.length || ds.length) ? `Histórico no servidor: ${ks.length} corte(s); agenda ${ds.length}` : "O servidor ainda não tem dados.";
    }
    const ar = ix.armazenamento, u = ix.ultimas_atualizacoes && ix.ultimas_atualizacoes[0];
    if ($$("fst")) { $$("fst").innerHTML = `Memória: ${Object.keys(SN).length} de ${SNX.size} corte(s) · ` +
        (ar && ar.bytes != null ? `banco: ${mb(ar.bytes)} MB (${ar.percentual}%) · ` : "") +
        (u ? `última atualização: ${u.ok ? "✅" : "❌"} ${esc(u.em.replace("T", " ").slice(0, 16))} UTC` : "");
    }
    const s = $$("fsvn"); if (s) s.textContent = (api() ? "Servidor: " + api() : "Servidor: não informado."); }  const dthm = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); async function carregarSnaps() { try { SNAPS = (await req("/api/v2/snapshots?limite=200")).snapshots; const o = $$("fem"); if (!o) return;
      o.innerHTML = '<option value="">Estado atual</option>' + SNAPS.map((s) => `<option value="${esc(s.criado_em)}"${EM === s.criado_em ? " selected" : ""}>${esc(dthm(s.criado_em))}</option>`).join("");
    } catch (e) {}
  }

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
    try { localStorage.removeItem("torreAlertLog_v1"); } catch (e) {}
    const r = await req("/api/v2/alertas"); LOG = {}; mesclarServidor(r.alertas);
  }

  let TOKEN_OK = null;
  async function entrar(silencioso, em) {
    try {
      msg("⏳ Carregando o histórico do servidor…");
      await recarregar(em); TOKEN_OK = token(); if (window.torreBoot) torreBoot(); situacao(); await carregarSnaps();
      msg(EM ? "🕓 Modo leitura." : "✅ Conectado.", EM ? "" : "ok");
    } catch (e) {
      if (e.status === 401) sessionStorage.removeItem("torreToken");
      aplicarVazio(); if (window.torreBoot) torreBoot(); ESTADO = null; situacao();
      msg(silencioso && !token() ? "Informe o endereço e a chave de acesso." : "❌ " + esc(e.message), silencioso && !token() ? "" : "err");
    }
  }

  if ($$("fsv")) $$("fsv").value = localStorage.getItem("torreApi") || window.TORRE_API || "";
  if ($$("ftk")) $$("ftk").value = sessionStorage.getItem("torreToken") || "";
  on("fsv", "change", () => { localStorage.setItem("torreApi", $$("fsv").value.trim()); }); on("ftk", "change", () => { const v = $$("ftk").value.trim(); sessionStorage.setItem("torreToken", v); if (ESTADO && v === TOKEN_OK) return; entrar(false); });

  function inferirCorte(nome) {
    const m = nome.match(/(\d{2})-(\d{2})[_ -]?(AM|PM)/i);
    if (m) {
      if ($$("fcd")) $$("fcd").value = `${new Date().getFullYear()}-${m[2]}-${m[1]}`;
      if ($$("fct")) $$("fct").value = m[3].toUpperCase(); } } on("fc", "change", () => { const f = $$("fc").files[0]; if (f) inferirCorte(f.name); });

  on("ft", "click", async () => {
    msg("⏳ Testando a conexão…");
    try {
      const r = await fetch(api() + "/api/v2/saude"); const j = await r.json();
      msg(`✅ Servidor ativo (${esc(j.versao)}) · banco: ${esc(j.banco)}.`, "ok");
    } catch (e) { msg("❌ Sem resposta do servidor.", "err"); }
  });

  on("fr", "click", () => entrar(false, null));
  on("fem", "change", () => entrar(false, $$("fem").value \vert{}\vert{} null));    on("fp", "click", async () => { const fc = $$("fc") && $$("fc").files[0], fa = $$("fa") && $$("fa").files[0], btn = $$("fp");
    if (!fc && !fa) { msg("Escolha ao menos uma planilha (carteira ou agendamento).", "err"); return; }
    if (fc && !($$("fcd") && $$("fcd").value)) { msg("Informe a data do corte.", "err"); return; }
    const fd = new FormData();
    if (fc) { fd.append("carteira", fc); fd.append("corte", $$("fcd").value); fd.append("turno", $$("fct").value); }
    if (fa) fd.append("agendamento", fa);
    if (btn) btn.disabled = true;
    msg("⏳ Enviando e validando…");
    try {
      await req("/api/v2/atualizar", { method: "POST", body: fd, timeout: 180000 });
      await recarregar(); if (window.torreBoot) torreBoot(); situacao();
      msg("✅ Atualizado com sucesso!", "ok");
      ["fc", "fa"].forEach((i) => { if ($$(i))$$(i).value = ""; });
    } catch (e) {
      msg("❌ " + esc(e.message), "err");
    } finally { if (btn) btn.disabled = false; }
  });

  window.__upload = true;
  entrar(true);
})();
