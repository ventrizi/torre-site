/* GESTÃO DE FRETES — aba do Dashboard (NÃO existe no Modo TV) + cartões financeiros no Outbound.
   Módulo isolado: lê /api/v2/gestao/* (token da Torre) e reutiliza os helpers/estilos existentes (sec, kc, RS, fdy, st, draw, .cd/.tb/.k8/.bd2).
   Nenhuma tarifa é calculada aqui: tudo vem do backend (tabela privada). Se este arquivo faltar, o restante da Torre continua igual. */
(function () {
  "use strict";
  const GF = { d: null, ad: null, zw: null, zwErr: null, zwSel: null, zwF: "", d0: 0, load: 0, err: null, sel: null, f: { q: "", tra: "", mod: "", vei: "", mun: "", st: "", fat: "", conc: "", reg: "" } };
  const E = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const api = () => (((document.getElementById("fsv") || {}).value || "").trim() || localStorage.getItem("torreApi") || window.TORRE_API || "").replace(/\/+$/, "");
  const tok = () => (((document.getElementById("ftk") || {}).value || sessionStorage.getItem("torreToken") || "").trim());
  const n2 = (v) => (v == null ? "—" : RS(v)), t1 = (kg) => (kg == null ? "—" : (kg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " t");
  const pc = (v) => (v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%");
  const NC = "DADOS NÃO CONFIRMADOS";
  const COR = (s) => /IDENTIFICADA — SEM/.test(s) ? "#b45309" : /^TARIFA IDENTIFICADA|DEFINITIVOS|CONCILIADO$/.test(s) ? "#0d9488" : /DIVERG|NÃO CADASTRADA|NÃO IDENTIFICADA|SEM CORRESP|PENDENTE DE AGEND/.test(s) ? "#dc2626" : /SAC/.test(s) ? "#6366f1" : /AGUARD|JANELA|FATURADO \(FORA|ENCERRADO|INSUFICIENTES/.test(s) ? "#475569" : "#b45309";
  const bd = (s) => `<span class="bd2" style="background:${COR(s)}">${E(s)}</span>`;

  async function get(p) {
    if (!api() || !tok()) throw new Error("Informe o endereço do servidor e a chave de acesso (painel de atualização) para carregar a Gestão de Fretes.");
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 90000);
    try {
      const r = await fetch(api() + p, { headers: { "X-Torre-Token": tok() }, signal: ctl.signal });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j.erro || j.error || "Erro HTTP " + r.status) + (j.detalhe ? " — " + j.detalhe : ""));
      return j;
    } finally { clearTimeout(tm); }
  }
  async function carregar(forcar) {
    if (GF.load === 1 || (GF.load === 2 && !forcar)) return;
    GF.load = 1; GF.err = null;
    GF.zw = null; GF.zwErr = null;
    const pzw = get("/api/v2/gestao/operacao-sem-agenda").then((x) => { GF.zw = x.operacao; }).catch((e) => { GF.zwErr = e.message; });   /* falha aqui não derruba o restante */
    try { const [a, b] = await Promise.all([get("/api/v2/gestao/frete"), get("/api/v2/gestao/aderencia")]); await pzw; GF.d = a; GF.ad = b; GF.load = 2; }
    catch (e) { GF.err = e.name === "AbortError" ? "O servidor demorou a responder (pode estar acordando). Tente novamente." : e.message; GF.load = 3; }
    if (typeof draw === "function") draw();
  }

  /* linhas no escopo ATUAL da Torre: respeita calendário e filtros existentes (st().P) */
  function escopo() {
    if (!GF.d) return [];
    const P = new Set(st().P.map((g) => String(g[5])));
    return GF.d.linhas.filter((l) => P.has(l.transporte));
  }
  const num = (xs) => xs.reduce((a, x) => a + x, 0);
  function resumir(L) {
    const B = L.filter((l) => l.modalidade !== "SAC"), pv = B.filter((l) => l.previsto.custo != null), rl = B.filter((l) => l.realizado.frete_total != null);
    const sp = pv.filter((l) => l.previsto.subsidio != null), sr = rl.filter((l) => l.realizado.subsidio != null), cmp = rl.filter((l) => l.comparacao && l.previsto.custo != null);
    const pk = num(rl.filter((l) => l.peso_faturado_kg > 0).map((l) => l.peso_faturado_kg)), oc = B.filter((l) => l.modalidade === "DIRETO" && l.ocupacao_pct != null);
    const ok = B.filter((l) => /^TARIFA IDENTIFICADA/.test(l.status_tarifa)), ps = B.filter((l) => /DADOS PARCIAIS|NÃO CADASTRADA|DIVERG|MULTIDESTINO|^FORA/.test(l.status_tarifa));
    return { n: L.length, sac: L.length - B.length, ag: B.filter((l) => l.status_faturamento.startsWith("AGUARD")).length, fat: rl.length, fatPend: B.filter((l) => l.status_faturamento.startsWith("DADOS PEND")).length,
      pvN: pv.length, pvC: num(pv.map((l) => l.previsto.custo)), pvFC: num(pv.filter((l) => l.previsto.frete_cliente_confirmado).map((l) => l.previsto.frete_cliente)), pvFCn: pv.filter((l) => l.previsto.frete_cliente_confirmado).length,
      pvS: num(sp.map((l) => l.previsto.subsidio)), pvSn: sp.length,
      rlN: rl.length, rlC: num(rl.map((l) => l.realizado.frete_total)), rlFC: num(sr.map((l) => l.realizado.frete_cliente)), rlS: num(sr.map((l) => l.realizado.subsidio)), rlSal: num(sr.map((l) => l.realizado.saldo)), rlSn: sr.length,
      rlT: pk > 0 ? num(rl.filter((l) => l.peso_faturado_kg > 0).map((l) => l.realizado.frete_total)) / (pk / 1000) : null,
      cmpN: cmp.length, cmpP: num(cmp.map((l) => l.previsto.custo)), cmpR: num(cmp.map((l) => l.realizado.frete_total)),
      oc: oc.length ? num(oc.map((l) => l.ocupacao_pct)) / oc.length : null, ocN: oc.length, tidN: ok.length, base: B.length, pendN: ps.length };
  }
  const G = (a, b) => `linear-gradient(135deg,${a},${b})`;
  function cartoes(R) {
    const adT = R.base ? R.tidN / R.base * 100 : null, pdT = R.base ? R.pendN / R.base * 100 : null;
    return [
      kc([["CUSTO PREVISTO", n2(R.pvC), R.pvN + " transp. com tarifa", G("#0f766e", "#115e59"), "💲"], ["FRETE CLIENTE (PREVISTO)", R.pvFCn ? n2(R.pvFC) : NC, R.pvFCn + " com frete confirmado", G("#0d9488", "#134e4a"), "📥"],
        ["SUBSÍDIO ESTIMADO", R.pvSn ? n2(R.pvS) : NC, R.pvSn + " transp. com frete confirmado", G("#b45309", "#78350f"), "⚖️"], ["AGUARDANDO FATURAMENTO", R.ag, "pré-faturamento", G("#475569", "#1e293b"), "⏳"]]),
      kc([["CUSTO REALIZADO (ZS65)", n2(R.rlC), R.rlN + " faturados · Frete Total", G("#0f766e", "#115e59"), "🧾"], ["FRETE CLIENTE (REALIZADO)", n2(R.rlFC), R.rlSn + " transportes", G("#0d9488", "#134e4a"), "📥"],
        ["SALDO REALIZADO", n2(R.rlSal), "frete cliente − custo", G(R.rlSal < 0 ? "#b91c1c" : "#15803d", "#1e293b"), "📊"], ["SUBSÍDIO REALIZADO", n2(R.rlS), "máx(0, custo − frete cliente)", G("#b45309", "#78350f"), "⚖️"],
        ["CUSTO MÉDIO R$/t", R.rlT == null ? "—" : n2(R.rlT), "Frete Total ÷ peso faturado", G("#115e59", "#0f172a"), "🏋️"]]),
      kc([["PREVISTO × REALIZADO", R.cmpN ? n2(R.cmpR - R.cmpP) : "—", R.cmpN ? R.cmpN + " transp. comparáveis · previsto " + n2(R.cmpP) + " · realizado " + n2(R.cmpR) : "sem transportes comparáveis", G("#334155", "#0f172a"), "↔️"],
        ["ADERÊNCIA TARIFÁRIA", pc(adT), R.tidN + " de " + R.base + " com tarifa identificada", G("#0d9488", "#134e4a"), "✅"], ["PENDENTES / DIVERGENTES", pc(pdT), R.pendN + " transportes", G("#b91c1c", "#7f1d1d"), "⚠️"],
        ["OCUPAÇÃO MÉDIA · DIRETOS", pc(R.oc), R.ocN + " veículos (capacidade da tabela)", G("#115e59", "#0f172a"), "🚚"]])].join("");
  }
  function aderenciaHtml() {
    const A = GF.ad && GF.ad.aderencia; if (!A) return "";
    const pend = A.lista_pendentes.slice(0, 40);
    return sec("🔗 ADERÊNCIA ZS63 × AGENDAMENTO") + kc([["CRIADOS NA ZS63", A.total_zs63, "transportes · ref. " + fdy(A.ref_data), G("#0f766e", "#115e59"), "🗂️"], ["NO AGENDAMENTO", A.no_agendamento, pc(A.conciliados_pct) + " da base (" + A.base_aderencia + ")", G("#0d9488", "#134e4a"), "✅"],
      ["PENDENTES", A.pendentes, pc(A.pendentes_pct) + " · +" + A.em_janela_normal + " em janela normal", G("#b45309", "#78350f"), "⏳"], ["FATURADOS FORA DA JANELA", A.faturados_fora_da_janela, "não contam como pendência", G("#475569", "#1e293b"), "🧾"],
      ["AGENDA SEM ZS63", A.agenda_sem_zs63, A.divergencias + " divergência(s) · " + A.agenda_sem_zs63_esperado + " esperado(s) (Z012)", G("#b91c1c", "#7f1d1d"), "❓"],
      ["CRIAÇÃO → EXPEDIÇÃO", A.lag_medio_criacao_ate_expedicao_dias == null ? "—" : A.lag_medio_criacao_ate_expedicao_dias.toLocaleString("pt-BR") + " d", "tempo até identificação: " + (A.tempo_medio_ate_identificacao_dias == null ? "sem histórico" : A.tempo_medio_ate_identificacao_dias + " d"), G("#115e59", "#0f172a"), "⏱️"]]) +
      `<div class="cd"><h4>Transportes criados e ainda sem agendamento (${A.pendentes + A.em_janela_normal})</h4><div class="tb"><table><thead><tr><th style="text-align:left">Transporte</th><th>Transportadora</th><th>Criado</th><th>Remessas</th><th>Clientes</th><th>Idade</th><th>Situação</th></tr></thead><tbody>${pend.map((p) => `<tr><td style="text-align:left">${E(p.transporte)}</td><td>${E(p.transportadora)}</td><td>${fdy(p.criado)}</td><td>${p.remessas}</td><td>${p.clientes}</td><td>${p.idade_dias} d</td><td>${bd(p.situacao)}</td></tr>`).join("") || '<tr><td colspan="7">Nenhum.</td></tr>'}</tbody></table></div><small>Horário de extração ≠ falha: transporte criado no dia da extração fica em janela normal.</small></div>` + serieHtml();
  }
  function serieHtml() {
    const S = (GF.ad && GF.ad.serie) || []; if (!S.length) return "";
    return `<div class="cd"><h4>Evolução da aderência (uma linha por carga processada)</h4><div class="tb"><table><thead><tr><th style="text-align:left">Carga</th><th>Ref.</th><th>Conciliado</th><th>Pendentes</th><th>Em janela</th><th>Fat. fora da janela</th><th>Agenda sem ZS63</th><th>Divergências</th></tr></thead><tbody>${S.slice(-20).reverse().map((x) => `<tr><td style="text-align:left">${E(String(x.em).slice(0, 16).replace("T", " "))}</td><td>${x.ref_data ? fdy(x.ref_data) : "—"}</td><td>${pc(x.conciliados_pct)}</td><td>${x.pendentes} (${pc(x.pendentes_pct)})</td><td>${x.em_janela_normal}</td><td>${x.faturados_fora_da_janela}</td><td>${x.agenda_sem_zs63}</td><td>${x.divergencias}</td></tr>`).join("")}</tbody></table></div></div>`;
  }
  function zwHtml() {
    let h = sec("📦 CARGAS NA OPERAÇÃO SEM AGENDAMENTO");
    h += `<div class="note">Cruzamento <b>ZW14 × Agendamento</b> pelo número do transporte (cada linha da ZW14 é uma etiqueta; transportes consolidados sem duplicar). Indicador <b>independente</b> da aderência ZS63: ausência de agendamento e ausência de ZS63 são ocorrências diferentes. Atividade no dia da extração é tratada como <b>provisória</b>, não como irregularidade.</div>`;
    if (GF.zwErr) return h + `<div class="al" style="border-color:#dc2626">❌ ${E(GF.zwErr)}</div>`;
    const Z = GF.zw; if (!Z) return h + `<div class="note">Sem dados.</div>`;
    const C = Z.por_classe, SEM = "SEM CORRESPONDÊNCIA NO AGENDAMENTO", DIV = "PARCIALMENTE DIVERGENTE", INS = "DADOS INSUFICIENTES", OKC = "ENCONTRADO NORMALMENTE", sit = Z.sem_correspondencia_por_situacao || {};
    const g = (k) => sit[k] || { transportes: 0, etiquetas: 0, peso_kg: 0 }, P = Z.sem_correspondencia_pendentes;
    h += kc([["TRANSPORTES NA ZW14", Z.transportes_zw14, Z.etiquetas_zw14 + " etiquetas · ref. " + (Z.ref_data ? fdy(Z.ref_data) : "—"), G("#0f766e", "#115e59"), "📦"], ["ENCONTRADOS NORMALMENTE", C[OKC].transportes, C[OKC].etiquetas + " etiquetas", G("#0d9488", "#134e4a"), "✅"],
      ["SEM AGENDAMENTO · PENDENTES", P.transportes, P.etiquetas + " etiquetas · " + t1(P.peso_kg), G("#b91c1c", "#7f1d1d"), "🚫"], ["EM JANELA NORMAL (provisório)", g("EM JANELA NORMAL").transportes, g("EM JANELA NORMAL").etiquetas + " etiquetas", G("#b45309", "#78350f"), "⏳"],
      ["FATURADO FORA DA JANELA", g("FATURADO (FORA DA JANELA)").transportes, "não é pendência", G("#475569", "#1e293b"), "🧾"], ["PARCIALMENTE DIVERGENTES", C[DIV].transportes, C[DIV].etiquetas + " etiquetas", G("#b45309", "#78350f"), "⚠️"],
      ["DADOS INSUFICIENTES", C[INS].transportes, (C[INS].etiquetas_sem_transporte || 0) + " etiq. sem transporte", G("#475569", "#1e293b"), "❔"], ["ZW14 SEM ZS63", Z.zw14_sem_zs63, "indicador independente", G("#115e59", "#0f172a"), "🔗"],
      ["AGENDA SEM ZW14", Z.agenda_sem_zw14, "ainda sem etiqueta", G("#334155", "#0f172a"), "🏷️"]]);
    const L = Z.lista.filter((i) => !GF.zwF || i.classe === GF.zwF);
    const sel = `<label>Classe <select data-gfzwf="1"><option value="">Todas as ocorrências</option>${[SEM, DIV, INS].map((c) => `<option ${GF.zwF === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>`;
    if (!Z.lista.length) return h + `<div class="cd"><div class="note">✅ Nenhuma carga na operação (ZW14) sem agendamento, divergente ou com dados insuficientes nesta carga. ${Z.transportes_zw14} transportes conferidos.</div></div>`;
    h += `<div class="cd"><div class="cfg">${sel}</div><h4>Ocorrências (${L.length}) · clique para detalhar</h4><div class="tb"><table><thead><tr>${["Transporte", "Transportadora", "Classe", "Situação", "Etiquetas", "Peso", "Onda", "Status operacional", "Data ref.", "Idade", "ZS63", "Faturado"].map((x, i) => `<th style="${i < 2 ? "text-align:left" : ""}">${x}</th>`).join("")}</tr></thead><tbody>${L.slice(0, 300).map((i) => `<tr class="cl ${GF.zwSel === i.transporte ? "r2" : ""}" data-gfzw="${E(i.transporte)}"><td style="text-align:left">${E(i.transporte)}</td><td style="text-align:left">${E(i.transportadora || "—")}</td><td>${bd(i.classe)}</td><td>${bd(i.situacao || "—")}${i.provisoria ? " <small>(provisória)</small>" : ""}</td><td>${i.etiquetas == null ? "—" : i.etiquetas}</td><td>${t1(i.peso_kg)}</td><td>${E(i.onda || "—")}</td><td>${E(i.status_operacional || "—")}</td><td>${i.data_referencia ? fdy(i.data_referencia) : "—"}</td><td>${i.idade_dias == null ? "—" : i.idade_dias + " d"}</td><td>${i.em_zs63 ? "sim" : "não"}</td><td>${i.faturado ? "sim" : "não"}</td></tr>`).join("")}</tbody></table></div></div>`;
    const x = Z.lista.find((i) => i.transporte === GF.zwSel);
    if (x) h += `<div class="cd" style="border:1px solid #14b8a6"><h4>Transporte ${E(x.transporte)} — ${E(x.transportadora || "transportadora não informada nas fontes")} <button data-gfzwclose style="float:right">fechar ✕</button></h4><div style="margin-bottom:8px">${bd(x.classe)} ${bd(x.situacao || "—")}</div><div class="g2"><div class="cd">${kv([["Etiquetas / OTs / Remessas", [x.etiquetas, x.ots, x.remessas].join(" / ")], ["Peso (ZW14)", t1(x.peso_kg)], ["Onda", E(x.onda || "—")], ["Status operacional", E(x.status_operacional || "—")], ["Docas", E((x.docas || []).join(", ") || "—")]])}</div><div class="cd">${kv([["Criação (ZW14)", x.criacao ? fdy(x.criacao) : "—"], ["Última separação", x.separacao ? fdy(x.separacao) : "—"], ["Última conferência", x.conferencia ? fdy(x.conferencia) : "—"], ["Data de referência", x.data_referencia ? fdy(x.data_referencia) : "—"], ["No Agendamento / na ZS63 / faturado", [x.no_agendamento ? "sim" : "não", x.em_zs63 ? "sim" : "não", x.faturado ? "sim" : "não"].join(" / ")]])}</div></div>${x.divergencias.length ? `<div class="al" style="border-color:#F2994A">Divergências: ${x.divergencias.map(E).join(" · ")}</div>` : ""}${x.observacoes.length ? `<div class="note">Observações (esperadas): ${x.observacoes.map(E).join(" · ")}</div>` : ""}<small>Estados das etiquetas: ${E(JSON.stringify(x.estados))} · (4 doca · 3 conferida · 2 separada · 1 atribuída · 0 criada · −1 atribuição eliminada)</small></div>`;
    return h;
  }
  const opts = (L, k, f) => [...new Set(L.map(f || ((l) => l[k])).filter(Boolean))].sort();
  function filtrar(L) {
    const F = GF.f, q = F.q.trim().toLowerCase();
    return L.filter((l) => (!F.tra || l.transportadora === F.tra) && (!F.vei || l.veiculo === F.vei) && (!F.mun || l.municipios.includes(F.mun)) && (!F.mod || l.modalidade === F.mod) && (!F.st || l.status_tarifa === F.st) && (!F.fat || l.status_faturamento === F.fat) && (!F.conc || l.status_conciliacao === F.conc) && (!F.reg || String(l.regiao || l.regiao_original || "") === F.reg) &&
      (!q || [l.transporte, l.transportadora, l.municipios.join(" "), (l.destinos || []).map((d) => d.cliente + " " + d.remessa + " " + d.cep).join(" ")].join(" ").toLowerCase().includes(q)));
  }
  function filtros(L) {
    const S = (id, rot, os) => `<label>${rot}<select data-gf="${id}"><option value="">Todos</option>${os.map((o) => `<option ${GF.f[id] === o ? "selected" : ""}>${E(o)}</option>`).join("")}</select></label>`;
    return `<div class="cd"><div class="cfg"><label>Transporte / cliente / município / remessa<input class="qi" data-gf="q" value="${E(GF.f.q)}" placeholder="🔎 pesquisar..."></label>${S("tra", "Transportadora", opts(L, "transportadora"))}${S("mod", "Modalidade", opts(L, "modalidade"))}${S("vei", "Veículo", opts(L, "veiculo"))}${S("mun", "Município", opts(L, "", (l) => l.municipios).length ? [...new Set(L.flatMap((l) => l.municipios))].sort() : [])}${S("reg", "Região", opts(L, "", (l) => String(l.regiao || l.regiao_original || "")))}${S("st", "Status tarifário", opts(L, "status_tarifa"))}${S("fat", "Faturamento", opts(L, "status_faturamento"))}${S("conc", "Conciliação", opts(L, "status_conciliacao"))}</div></div>`;
  }
  const custoMostrado = (l) => (l.realizado.frete_total != null ? l.realizado.frete_total : l.previsto.custo);
  function tabela(L) {
    const lin = L.slice(0, 300);
    return `<div class="cd"><h4>Transportes (${L.length}) · clique para detalhar</h4><div class="tb"><table><thead><tr>${["Data", "Transportadora", "Transporte", "Região", "Veículo", "Modal.", "Entregas", "Peso", "Custo (prev./real.)", "Frete cliente", "Subsídio", "Faturamento", "Tarifa"].map((h, i) => `<th style="${i < 3 ? "text-align:left" : ""}">${h}</th>`).join("")}</tr></thead><tbody>${lin.map((l) => {
      const real = l.realizado.frete_total != null, fc = real ? l.realizado.frete_cliente : l.previsto.frete_cliente, su = real ? l.realizado.subsidio : l.previsto.subsidio;
      return `<tr class="cl ${GF.sel === l.transporte ? "r2" : ""}" data-gfrow="${E(l.transporte)}"><td style="text-align:left">${fdy(l.data)}</td><td style="text-align:left">${E(l.transportadora)}</td><td style="text-align:left">${E(l.transporte)}</td><td>${E(Array.isArray(l.regiao) ? "VÁRIAS" : l.regiao || l.regiao_original || "—")}</td><td>${E(l.veiculo || "—")}</td><td>${E(l.modalidade)}</td><td>${l.entregas == null ? "—" : l.entregas}</td><td>${t1(real ? l.peso_faturado_kg : l.peso_operacional_kg)}</td><td>${custoMostrado(l) == null ? "—" : n2(custoMostrado(l)) + (real ? " (real.)" : " (prev.)")}</td><td>${fc == null ? (l.modalidade === "SAC" ? "—" : NC) : n2(fc)}</td><td>${su == null ? "—" : n2(su)}</td><td>${bd(l.status_faturamento)}</td><td>${bd(l.status_tarifa)}</td></tr>`;
    }).join("") || '<tr><td colspan="13">Nenhum transporte no escopo atual (calendário/filtros).</td></tr>'}</tbody></table></div>${L.length > 300 ? `<small>mostrando 300 de ${L.length} — refine os filtros</small>` : ""}</div>`;
  }
  const kv = (rows) => `<table style="width:100%">${rows.map((r) => `<tr><td style="text-align:left;opacity:.75">${r[0]}</td><td style="text-align:right"><b>${r[1]}</b></td></tr>`).join("")}</table>`;
  function detalhe(L) {
    const l = L.find((x) => x.transporte === GF.sel); if (!l) return "";
    const p = l.previsto, r = l.realizado, t = l.tarifa, real = r.frete_total != null;
    const cap = l.capacidade_contratual_kg ? t1(l.capacidade_contratual_kg) + (l.capacidade_operacional_kg && l.capacidade_operacional_kg !== l.capacidade_contratual_kg ? " (operacional da Torre: " + t1(l.capacidade_operacional_kg) + ")" : "") : "— (sem capacidade contratual)";
    const c = l.cross;
    return `<div class="cd" style="border:1px solid #14b8a6"><h4>Transporte ${E(l.transporte)} — ${E(l.transportadora)} <button data-gfclose style="float:right">fechar ✕</button></h4><div style="margin-bottom:8px">${bd(l.status_faturamento)} ${bd(l.status_tarifa)} ${bd(l.status_conciliacao)}</div>
    <div class="g2"><div class="cd"><h4>Identificação</h4>${kv([["Data", fdy(l.data)], ["Transportadora", E(l.transportadora)], ["Modalidade", E(l.modalidade)], ["Veículo", E(l.veiculo_txt || l.veiculo || "—")], ["Região", E(Array.isArray(l.regiao) ? l.regiao.join(", ") : l.regiao || "—") + (l.regiao_original ? " <small>(ZS65: " + E(l.regiao_original) + ")</small>" : "")], ["Tipo de transporte", E(l.tipo_transporte || "—")], ["Identidade (nome)", "ZS63: " + E((l.identidade || {}).nome_zs63 || "—") + " · Agenda: " + E((l.identidade || {}).nome_agenda || "—") + ((l.identidade || {}).nome_zs65 ? " · ZS65: " + E(l.identidade.nome_zs65) : "")]])}</div>
    <div class="cd"><h4>Operação</h4>${kv([["Pedidos / Remessas / Clientes", [l.pedidos == null ? "—" : l.pedidos, l.remessas, l.clientes_n].join(" / ")], ["Entregas", l.entregas == null ? "—" : l.entregas], ["Peso operacional (ZS34)", t1(l.peso_operacional_kg)], ["Peso faturado (ZS65)", t1(l.peso_faturado_kg)], ["Valor da mercadoria", r.valor_mercadoria != null ? n2(r.valor_mercadoria) + " (ZS65)" : ((l.destinos || []).some((d) => d.valor_mercadoria_zs63 != null) ? n2((l.destinos || []).reduce((a, d) => a + (d.valor_mercadoria_zs63 || 0), 0)) + " (ZS63, bruto)" : "—")], ["Capacidade contratual", cap], ["Ocupação", pc(l.ocupacao_pct)], ["Carretas (Cross)", c ? c.carretas + " · conjunto " + t1(c.kg) + " · " + pc(c.ocupacao_pct) + " · faixa " + c.faixa : "—"]])}</div></div>
    <div class="g2"><div class="cd"><h4>Previsto (pré-faturamento)</h4>${kv([["Tarifa aplicada", t.id ? n2(t.valor) + " " + E(t.unidade) + " · " + E(t.destino) : "— " + E(t.motivo || "")], ...(t.evidencia_auxiliar && t.evidencia_auxiliar.length ? [["Evidência auxiliar (NÃO confirma vigência)", t.evidencia_auxiliar.map((e) => E(e.destino) + " " + n2(e.valor) + " · visto " + e.uso_observado + "× no faturamento").join("<br>")]] : []), ["Custo previsto", n2(p.custo)], ["Custo previsto por t", n2(p.custo_por_t)], ["Frete cliente (Carteira AG)", p.frete_cliente == null ? NC : n2(p.frete_cliente) + (p.frete_cliente_confirmado ? "" : " (PARCIAL " + pc(p.frete_cliente_cobertura) + " das remessas)")], ["Valor líquido (Carteira AB)", p.valor_liquido == null ? NC : n2(p.valor_liquido)], ["Saldo", p.saldo == null ? NC : n2(p.saldo)], ["Subsídio", p.subsidio == null ? NC : n2(p.subsidio)], ["Tabela de frete", E(p.tabela_versao || "—") + (p.congelado ? " · previsão congelada" : p.reconstruido ? " · previsão reconstruída" : "")]])}</div>
    <div class="cd"><h4>Realizado (ZS65)</h4>${real ? kv([["Frete Transportadora", n2(r.frete_transportadora)], ["Pedágio", n2(r.pedagio)], ["Adicionais", n2(r.adicionais)], ["Frete Total (custo realizado)", n2(r.frete_total)], ["R$/t realizado", n2(r.custo_por_t)], ["R$/t sem adicionais", n2(r.custo_por_t_sem_adicionais)], ["Frete cliente", n2(r.frete_cliente)], ["Saldo", n2(r.saldo)], ["Subsídio", n2(r.subsidio)], ["Previsto × realizado", l.comparacao ? n2(l.comparacao.reais) + " (" + pc(l.comparacao.pct) + ")" : "—"], ["Divergência vs tabela", l.divergencia_tarifa_pct == null ? "—" : pc(l.divergencia_tarifa_pct)]]) : `<div class="note">${l.status_faturamento.startsWith("DADOS PEND") ? "Transporte na ZS65 com Frete Total zerado: <b>não é tratado como frete gratuito</b> — dados pendentes de validação." : "Ainda não faturado."}</div>`}</div></div>
    <div class="cd"><h4>Destinos / remessas (ZS63 · cada remessa uma única vez)</h4><div class="tb"><table><thead><tr><th style="text-align:left">Cliente</th><th>Remessa</th><th>Pedido</th><th>Endereço</th><th>Município</th><th>CEP</th><th>Peso</th><th>Frete cliente</th><th>Km</th></tr></thead><tbody>${(l.destinos || []).map((d) => `<tr><td style="text-align:left">${E(d.cliente)}</td><td>${E(d.remessa)}</td><td>${E(d.pedido)}</td><td>${E(d.endereco)}${d.bairro ? " · " + E(d.bairro) : ""}</td><td>${E(d.municipio)}</td><td>${E(d.cep)}</td><td>${t1(d.peso_kg)}</td><td>${d.carteira ? n2(d.frete_cliente) : NC}</td><td>${d.distancia_km == null ? "—" : d.distancia_km}</td></tr>`).join("") || '<tr><td colspan="9">Sem remessas da ZS63 para este transporte.</td></tr>'}</tbody></table></div></div>
    ${l.flags.length ? `<div class="note">Alertas: ${l.flags.map(E).join(" · ")}</div>` : ""}<small>Origem — ${Object.entries(l.origem).filter((x) => x[1]).map((x) => E(x[0].replace(/_/g, " ")) + ": " + E(x[1])).join(" · ")}</small></div>`;
  }

  window.gf = function () {
    if (GF.load === 0) carregar();
    let h = sec("💰 GESTÃO DE FRETES · PREVISTO × REALIZADO") + `<div class="note">Previsto (tabela de frete + ZS34 + Carteira) e realizado (ZS65) ficam <b>separados</b> e nunca são somados. Frete cliente não confirmado aparece como “${NC}”, sem saldo nem subsídio. SAC fica fora dos totais. ${GF.d && GF.d.tabela ? "Tabela de frete v" + E(GF.d.tabela.versao) + " (" + E(GF.d.tabela.sha) + ")." : ""} <button data-gfreload>↻ atualizar</button></div>`;
    if (GF.load === 1 || GF.load === 0) return h + `<div class="note">⏳ Carregando do servidor… (o plano gratuito pode levar cerca de 1 minuto para acordar)</div>`;
    if (GF.load === 3) return h + `<div class="al" style="border-color:#dc2626">❌ ${E(GF.err)}</div>`;
    if (!GF.d.zs63_carregada) h += `<div class="al" style="border-color:#F2994A">A guia ZS63 ainda não foi carregada (envie o AGENDAMENTO com a ZS63): destinos, conciliação e frete do cliente ficam como DADOS PARCIAIS.</div>`;
    const base = escopo(), L = filtrar(base);
    return h + cartoes(resumir(L)) + aderenciaHtml() + zwHtml() + sec("🚛 TRANSPORTES") + filtros(base) + detalhe(L) + tabela(L);
  };
  /* indicadores financeiros na aba OUTBOUND do Dashboard (usa o mesmo escopo/filtros da Torre) */
  window.gfOb = function () {
    if (GF.load === 0) carregar();
    if (GF.load !== 2) return `<div class="note">💰 Indicadores financeiros do Outbound: ${GF.load === 3 ? "indisponíveis — " + E(GF.err) : "carregando…"}</div>`;
    const R = resumir(escopo());
    return sec("💰 OUTBOUND · CUSTO, FRETE E SUBSÍDIO") + cartoes(R) + `<div class="note">Detalhe por transporte na aba <b>Gestão de Fretes</b>.</div>`;
  };
  document.addEventListener("click", (ev) => {
    const z = ev.target.closest("[data-gfzw],[data-gfzwclose]");
    if (z) { GF.zwSel = z.hasAttribute("data-gfzwclose") ? null : z.getAttribute("data-gfzw"); draw(); return; }
    const t = ev.target.closest("[data-gfrow],[data-gfclose],[data-gfreload]"); if (!t) return;
    if (t.hasAttribute("data-gfreload")) { carregar(true); return; }
    GF.sel = t.hasAttribute("data-gfclose") ? null : t.getAttribute("data-gfrow"); draw();
  });
  const alterou = (ev) => { const t = ev.target.closest("[data-gf]"); if (!t) return; GF.f[t.getAttribute("data-gf")] = t.value; GF.sel = null; const pos = t.selectionStart; draw(); const n = document.querySelector('[data-gf="' + t.getAttribute("data-gf") + '"]'); if (n && t.tagName === "INPUT") { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignora */ } } };
  document.addEventListener("change", (ev) => { const f = ev.target.closest && ev.target.closest("[data-gfzwf]"); if (f) { GF.zwF = f.value; GF.zwSel = null; draw(); return; } alterou(ev); });
  document.addEventListener("input", (ev) => { if (ev.target.getAttribute && ev.target.getAttribute("data-gf") === "q") { clearTimeout(window.__gfq); window.__gfq = setTimeout(() => alterou(ev), 350); } });
  const tb0 = window.torreBoot; if (typeof tb0 === "function") window.torreBoot = function () { GF.load = 0; return tb0.apply(this, arguments); };   /* após nova carga de planilhas, recarrega na próxima renderização */
  window.gfRecarregar = () => carregar(true);        /* chamado após cada atualização bem-sucedida de planilhas */
})();
