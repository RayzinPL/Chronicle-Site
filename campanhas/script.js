const tabs = document.querySelectorAll(".tab");
const itens = document.querySelectorAll("[data-cat]");
const busca = document.querySelector(".page-search input");
const vazio = document.querySelector(".empty");

function filtrar() {
    const ativo = document.querySelector(".tab[aria-pressed='true']").dataset.filter;
    const termo = busca ? busca.value.trim().toLowerCase() : "";
    let visiveis = 0;
    itens.forEach(item => {
        const ok = (ativo === "todos" || item.dataset.cat === ativo) && item.textContent.toLowerCase().includes(termo);
        item.hidden = !ok;
        if (ok) visiveis++;
    });
    vazio.hidden = visiveis > 0;
}

tabs.forEach(tab => tab.addEventListener("click", () => {
    tabs.forEach(t => t.setAttribute("aria-pressed", String(t === tab)));
    filtrar();
}));
if (busca) busca.addEventListener("input", filtrar);
