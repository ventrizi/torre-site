// CONFIGURAÇÃO PÚBLICA (este arquivo vai para o GitHub Pages: NÃO coloque senhas, chaves nem dados aqui)
window.TORRE_MODO_SERVIDOR = true;
// Endereço do motor no Render, sem barra no final. Ex.: "https://torre-controle.onrender.com". Também dá para digitar no painel.
window.TORRE_API = "https://torre-controle-api-v2.onrender.com";
// Quantos cortes da carteira ficam abertos ao mesmo tempo no navegador (os demais são buscados no servidor ao clicar no dia).
window.TORRE_CORTES_EM_MEMORIA = window.TORRE_CORTES_EM_MEMORIA || 10;
