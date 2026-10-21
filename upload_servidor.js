/* Camada de dados da Torre v2 */
(function () {
  "use strict";
  const $$ = (id) => document.getElementById(id);
  
  function msg(texto, tipo) {
    const el = $$("fs");
    if (el) {
      el.className = "note " + (tipo || "");
      el.textContent = texto;
    }
  }

  const api = () => (($_("fsv") ? $$("fsv").value : "") || localStorage.getItem("torreApi") || "").replace(/\/+$/, "");
  const token = () => (($_("ftk") ? $$("ftk").value : "") || sessionStorage.getItem("torreToken") || "").trim();

  async function testarConexao() {
    msg("Testando a conexão...", "");
    try {
      const res = await fetch(api() + "/api/v2/saude");
      const data = await res.json();
      msg("Servidor ativo e conectado com sucesso!", "ok");
    } catch (err) {
      msg("Erro ao falar com o servidor.", "err");
    }
  }

  const btnTestar = $$("ft");
  if (btnTestar) btnTestar.addEventListener("click", testarConexao);

  console.log("Torre v2 carregada com sucesso.");
})();
