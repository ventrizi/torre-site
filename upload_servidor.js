/* Torre de Controle - Upload Servidor */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  
  console.log("Torre: upload_servidor.js carregado com sucesso.");

  const btnTestar = $("ft");
  if (btnTestar) {
    btnTestar.addEventListener("click", async () => {
      const srv = $("fsv") ? $("fsv").value : "";
      alert("Endereço do servidor configurado: " + srv);
    });
  }
})();
