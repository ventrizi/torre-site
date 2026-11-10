/* Camada de dados da Torre v2 (DESENVOLVIMENTO): o HISTÓRICO fica no servidor (PostgreSQL), não no navegador.
   Carregado DEPOIS de app.js (que permanece idêntico ao validado). Usa: SN, SNX, AG, Z65, META, REM, HOL, AGK, snk, fdy, torreBoot.

   - Planilhas: enviadas ao motor Python (Render), processadas em memória e descartadas. O navegador nunca guarda planilha.
   - Leitura: /api/v2/estado (índice), /api/v2/corte/<chave> (sob demanda), /api/v2/agenda.
   - Escrita: /api/v2/atualizar (transação única: se algo falhar, o último estado válido do servidor permanece).
   - Limpeza: SOMENTE pelo servidor, com senha de administrador + confirmação explícita + escopo (esconder ou mostrar o botão não é segurança).
   - Armazenamento local: apenas CONFIGURAÇÃO (endereço do servidor) e a chave de acesso da SESSÃO (some ao fechar a aba). Nenhum dado operacional. */
(function () {
  "use strict";
  const $$ = (i) => document.getElementById(i);
  const MAXMEM = Math.max(2, +window.TORRE_CORTES_EM_MEMORIA || 10);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const VAZIO_QA = clone(META.qa), HOL_BASE = clone(HOL);
  const trocar = (o, n) => { Object.keys(o).forEach((k) => delete o[k]); Object.assign(o, n); };
  const trocarLista = (l, n) => { l.length = 0; n.forEach((x) => l.push(x)); };
  const api = () => (($$("fsv").value || "").trim() || localStorage.getItem("torreApi") || window.TORRE_API || "").replace(/\/+$/, "");
  const token = () => ($$("ftk").value || sessionStorage.getItem("torreToken") || "").trim();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const mb = (b) => (b / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  let ESTADO = null, EM = null, SNAPS = [];

  function msg(html, tipo) { const e = $$("fs"); e.className = "note " + (tipo || ""); e.innerHTML = html; }

  /* ---------- requisições ---------- */
  class ErroApi extends Error { constructor(m, status, corpo) { super(m); this.status = status; this.corpo = corpo; } }
  async function req(caminho, opc) {
    opc = opc || {};
    if (!api()) throw new ErroApi("Informe o endereço do servidor (Render).", 0);
    if (!token()) throw new ErroApi("Informe a chave de acesso.", 401);
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), opc.timeout || 90000);   // o plano gratuito pode levar ~1 min para acordar
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

  /* ---------- memória enxuta: só alguns cortes ficam carregados; os demais vêm do servidor sob demanda ---------- */
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
    $$("fp").disabled = !!EM; $$("fx").disabled = !!EM;
    const ix = ESTADO; if (!ix) { $$("fe").textContent = "Sem conexão com o servidor."; $$("fst").textContent = ""; return; }
    const ks = ix.cortes.map((c) => c.chave).sort(), ds = ix.agenda_dias;
    $$("fe").textContent = (ks.length || ds.length)
      ? `Histórico no servidor: ${ks.length} corte(s)${ks.length ? " (" + fdy(ks[0].slice(0, 10)) + " a " + fdy(ks[ks.length - 1].slice(0, 10)) + ")" : ""}; agenda ${ds.length ? fdy(ds[0]) + " a " + fdy(ds[ds.length - 1]) : "não carregada"}.`
      : "O servidor ainda não tem dados.";
    const ar = ix.armazenamento, u = ix.ultimas_atualizacoes && ix.ultimas_atualizacoes[0], f = ix.frete;
    $$("fst").innerHTML = `Memória: ${Object.keys(SN).length} de ${SNX.size} corte(s) abertos (máx. ${MAXMEM}) · ` +
      (ar && ar.bytes != null ? `banco: ${mb(ar.bytes)} MB de ${ar.limite_mb} MB (${ar.percentual}%)${ar.alerta ? ' <b style="color:#fb923c">⚠️ perto do limite do plano gratuito</b>' : ""} · ` : "") +
      `retenção do histórico: ${ix.config.retencao_dias} dias (cortes com mais de ${ix.config.arquivar_apos_dias} dias ficam compactados e sem nome de cliente) · ` +
      (f ? `tabela de frete: ${esc(f.arquivo || "")}` : "sem tabela de frete") + (u ? ` · última atualização: ${u.ok ? "✅" : "❌ falhou"} ${esc(u.em.replace("T", " ").slice(0, 16))} UTC` : "");
    const s = $$("fsvn"); if (s) s.textContent = (api() ? "Servidor: " + api() : "Servidor: não informado.") + (ix.config && ix.config.regras_versao ? " · regras de cálculo v" + ix.config.regras_versao : "");
  }
  const dthm = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  async function carregarSnaps() {
    try {
      SNAPS = (await req("/api/v2/snapshots?limite=200")).snapshots;
      const o = $$("fem"); if (!o) return;
      o.innerHTML = '<option value="">Estado atual (último snapshot válido)</option>' + SNAPS.map((s) => `<option value="${esc(s.criado_em)}"${EM === s.criado_em ? " selected" : ""}>${esc(dthm(s.criado_em))} · ${esc(s.tipo)}${s.corte ? " · corte " + esc(s.corte.replace("|", " ")) : ""}</option>`).join("");
    } catch (e) { /* sem snapshots ainda */ }
  }

  /* ---------- alertas COMPARTILHADOS (detectado -> reconhecido -> resolvido) ---------- */
  const SRVK = new Set(), ENV = {}; let tLog = null;
  const assin = (e) => [e.l, e.t, e.det, e.ack, e.res, e.ns ? 1 : 0, e.inc ? 1 : 0].join("~");
  const ctxLatest = () => { const k = [...SNX].sort().pop(); return k ? k.slice(0, 10) + "|" + k : null; };
  const menor = (a, b) => (a && (!b || a <= b) ? a : b);
  function mesclarServidor(srv) {
    let mudou = false;
    Object.values(srv).forEach((s) => {
      SRVK.add(s.k); const l = LOG[s.k];
      if (!l) { LOG[s.k] = { k: s.k, t: s.t, l: s.l, c: s.c, inc: s.inc, ctx: s.ctx, det: s.det, ack: s.ack, res: s.res }; mudou = true; }
      else { const n = { det: menor(l.det, s.det), ack: menor(l.ack, s.ack), res: menor(l.res, s.res) }; if (n.det !== l.det || n.ack !== l.ack || n.res !== l.res) mudou = true; Object.assign(l, n); }
      ENV[s.k] = assin(LOG[s.k]);
    });
    return mudou;
  }
  async function carregarAlertas() {
    // migração única: o histórico que este navegador já tinha (validado) vai para o servidor e a cópia local deixa de ser a fonte
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
      if (e.ctx !== lat && !SRVK.has(e.k)) continue;       // consulta a um dia antigo não cria ocorrência nova no histórico compartilhado
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
    try { const r = await req("/api/v2/alertas"); if (mesclarServidor(r.alertas)) draw(); } catch (e) { /* tenta de novo no próximo ciclo */ }
  }
  setInterval(atualizarAlertasRemotos, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) atualizarAlertasRemotos(); });
  async function entrar(silencioso, em) {
    try {
      msg("⏳ Carregando o histórico do servidor… (o plano gratuito pode levar cerca de 1 minuto para acordar)");
      await recarregar(em); TOKEN_OK = token(); torreBoot(); situacao(); await carregarSnaps();
      msg(EM ? `🕓 Você está vendo o estado de <b>${esc(dthm(EM))}</b> (somente leitura): atualizar, limpar e gravar alertas ficam bloqueados. Volte para "Estado atual" para operar.` : "✅ Conectado. O histórico vem do servidor.", EM ? "" : "ok");
    } catch (e) {
      if (e.status === 401) sessionStorage.removeItem("torreToken");
      aplicarVazio(); torreBoot(); ESTADO = null; situacao();
      msg(silencioso && !token() ? "Informe o endereço do servidor e a chave de acesso para carregar o histórico." : "❌ " + esc(e.message), silencioso && !token() ? "" : "err");
    }
  }

  /* ---------- campos ---------- */
  $$("fsv").value = localStorage.getItem("torreApi") || window.TORRE_API || "";
  $$("ftk").value = sessionStorage.getItem("torreToken") || "";
  $$("fsv").addEventListener("change", () => { localStorage.setItem("torreApi", $$("fsv").value.trim()); });
  let TOKEN_OK = null;   // evita recarregar tudo de novo quando o campo dispara "change" ao perder o foco com a mesma chave já validada
  $$("ftk").addEventListener("change", () => { const v = $$("ftk").value.trim(); sessionStorage.setItem("torreToken", v); if (ESTADO && v === TOKEN_OK) return; entrar(false); });
  function inferirCorte(nome) {
    const m = nome.match(/(\d{2})-(\d{2})[_ -]?(AM|PM)/i) || nome.match(/(\d{2})(\d{2})[_ -]?(AM|PM)/i);
    if (m) { $$("fcd").value = `${new Date().getFullYear()}-${m[2]}-${m[1]}`; $$("fct").value = m[3].toUpperCase(); }
  }
  $$("fc").addEventListener("change", () => { const f = $$("fc").files[0]; if (f) inferirCorte(f.name); });

  $$("ft").addEventListener("click", async () => {
    msg("⏳ Testando a conexão…");
    try {
      const r = await fetch(api() + "/api/v2/saude"); const j = await r.json();
      msg(`${j.banco === "ok" ? "✅" : "⚠️"} Servidor ativo (${esc(j.versao)}) · banco: ${esc(j.banco)} · acesso ${j.acesso_configurado ? "configurado" : "NÃO configurado"} · administração ${j.admin_configurado ? "configurada" : "NÃO configurada"}.`, j.banco === "ok" ? "ok" : "err");
    } catch (e) { msg("❌ Sem resposta: o servidor pode estar iniciando (~1 min), o endereço pode estar errado ou o CORS bloqueou.", "err"); }
  });
  $$("fr").addEventListener("click", () => entrar(false, null));
  $$("fem").addEventListener("change", () => entrar(false, $$("fem").value || null));
  $$("ffv").addEventListener("click", async () => {
    try {
      const f = (await req("/api/v2/frete")).frete;
      if (!f) { msg("Nenhuma tabela de frete foi carregada ainda.", ""); return; }
      const sv = { alta: [], "média": [], baixa: [] }; (f.achados || []).forEach((a) => (sv[a.severidade] || sv.baixa).push(a));
      const li = (arr) => arr.slice(0, 10).map((a) => `<li>${esc(a.mensagem)}</li>`).join("");
      msg(`📋 <b>Validação da tabela de frete</b> — ${esc(f.arquivo || "")} (${esc(dthm(f.em))}): ${f.resumo.outbound_linhas} linhas no Outbound · <b>${f.resumo.tarifas_ativas_confirmadas}</b> tarifas ativas confirmadas · ${f.sem_status_nao_ativas} linhas sem status (NÃO tratadas como ativas) · ${f.resumo.capacidades_inferidas || 0} capacidade(s) inferida(s) e rotulada(s).` +
        `<ul><li><b>Atenção alta (${sv.alta.length}):</b><ul>${li(sv.alta)}</ul></li><li><b>Média (${sv["média"].length}):</b><ul>${li(sv["média"])}</ul></li><li>Baixa: ${sv.baixa.length} ponto(s)</li></ul>` +
        `<small>${esc(f.aviso)} A aba FRETE mostra só o que está registrado na ZS65; a tabela contratual não é usada nos números porque não comprova status, vigência e unidade para todas as linhas.</small>`, "");
    } catch (e) { msg("❌ " + esc(e.message), "err"); }
  });

  /* ---------- atualizar ---------- */
  $$("fp").addEventListener("click", async () => {
    const fc = $$("fc").files[0], fa = $$("fa").files[0], ff = $$("ff").files[0], btn = $$("fp");
    if (!fc && !fa && !ff) { msg("Escolha ao menos uma planilha (carteira, agendamento e/ou tabela de frete).", "err"); return; }
    if (fc && !$$("fcd").value) { msg("Informe a data do corte da carteira.", "err"); return; }
    const fd = new FormData();
    if (fc) { fd.append("carteira", fc); fd.append("corte", $$("fcd").value); fd.append("turno", $$("fct").value); }
    if (fa) fd.append("agendamento", fa);
    if (ff) fd.append("frete", ff);
    btn.disabled = true; msg("⏳ Enviando e validando… se algo falhar, o último estado válido do servidor é mantido.");
    try {
      const j = await req("/api/v2/atualizar", { method: "POST", body: fd, timeout: 180000 });
      const r = j.resumo || {}, partes = [];
      if (r.carteira) partes.push(`carteira ${fdy(r.carteira.chave.slice(0, 10))} ${r.carteira.chave.endsWith("AM") ? "manhã" : "tarde"}: ${r.carteira.remessas.toLocaleString("pt-BR")} remessas`);
      if (r.agenda) partes.push(`agendamento: ${r.agenda.dias.length} dia(s), ${r.agenda.cargas.toLocaleString("pt-BR")} cargas`);
      if (r.frete) partes.push(`tabela de frete: ${r.frete.outbound_linhas} linhas, ${r.frete.tarifas_ativas_confirmadas} tarifas ativas confirmadas, ${r.frete.achados} ponto(s) de atenção`);
      const av = [...(j.avisos || [])];
      if (r.retencao && (r.retencao.cortes || r.retencao.agenda_dias)) av.push(`Retenção: ${r.retencao.cortes} corte(s) e ${r.retencao.agenda_dias} dia(s) de agenda antigos removidos.`);
      if (j.achados_frete) { const alta = j.achados_frete.filter((a) => a.severidade === "alta"); if (alta.length) av.push("Tabela de frete — atenção alta: " + alta.map((a) => esc(a.mensagem)).join(" · ")); }
      await recarregar(); torreBoot(); situacao();
      msg("✅ Atualizado — " + partes.join(" · ") + (av.length ? "<ul>" + av.map((a) => "<li>" + (a.startsWith("<") ? a : esc(a)) + "</li>").join("") + "</ul>" : ""), "ok");
      ["fc", "fa", "ff"].forEach((i) => ($$(i).value = ""));
    } catch (e) {
      msg("❌ " + esc(e.message) + (e.status === 422 || e.status === 500 ? " <b>Nenhum dado foi alterado: o último estado válido foi preservado.</b>" : ""), "err");
    } finally { btn.disabled = false; }
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
      <div class="note">A senha é conferida no servidor. Esta ação não pode ser desfeita. A tabela de frete, o histórico de atualizações e a auditoria são preservados.</div>
      <div class="admbt"><button type="submit" id="aok" disabled>Apagar definitivamente</button><button type="button" data-x>Cancelar</button></div></form>`;
    document.body.appendChild(d);
    const q = (s) => d.querySelector(s), escopo = () => (q("#aesc").value === "corte" ? "corte:" + q("#ac").value : q("#aesc").value);
    let seqPrevia = 0;     // respostas fora de ordem NUNCA podem mostrar a prévia de outra seleção (a operação é irreversível)
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
        fim(); await recarregar(); torreBoot(); situacao();
        msg(`🗑️ Limpeza concluída (${esc(e)}): ` + Object.entries(j.apagado).filter(([, n]) => n).map(([k, n]) => `${n.toLocaleString("pt-BR")} ${k.replace(/_/g, " ")}`).join(" · "), "ok");
      } catch (er) { q("#aprev").innerHTML = `<b style="color:#fb923c">❌ ${esc(er.message)}</b>`; q("#asn").value = ""; q("#acf").value = ""; }
    };
  }
  $$("fx").addEventListener("click", () => { if (!ESTADO) { msg("Conecte-se ao servidor antes (endereço e chave de acesso).", "err"); return; } modalLimpeza(); });

  window.__upload = true;
  entrar(true);
})();
