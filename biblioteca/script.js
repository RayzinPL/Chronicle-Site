const CAMPANHAS = [
    ["todas", "Todas as campanhas"],
    ["eldoria", "Ecos de Eldoria"],
    ["andromeda", "Órbita de Andrômeda"],
    ["ultimo-sinal", "O último sinal"]
];
const CHAVE = "chronicle_biblioteca_filtros";

const filtros = document.querySelector(".tabs");
const adicionarFiltro = document.querySelector(".add-filter");
const formularioFiltro = document.querySelector(".add-filter-form");
const campoNome = formularioFiltro.elements["filter-name"];
const barra = document.querySelector(".campaign-bar");
const seletor = barra.querySelector("select");
const campanhaPorFiltro = {};
const itens = document.querySelectorAll("[data-cat]");
const busca = document.querySelector(".page-search input");
const vazio = document.querySelector(".empty");

function filtrar() {
    const filtro = filtros.querySelector(".tab[aria-pressed='true']").dataset.filter;
    const campanha = filtro === "todos" ? "todas" : seletor.value;
    const termo = busca ? busca.value.trim().toLowerCase() : "";
    let visiveis = 0;

    itens.forEach(item => {
        const ok = (filtro === "todos" || item.dataset.cat === filtro)
            && (campanha === "todas" || item.dataset.campaign === campanha)
            && item.textContent.toLowerCase().includes(termo);
        item.hidden = !ok;
        if (ok) visiveis++;
    });
    vazio.hidden = visiveis > 0;
}

function ativar(filtro) {
    filtros.querySelectorAll(".tab[data-filter]").forEach(aba => {
        aba.setAttribute("aria-pressed", String(aba.dataset.filter === filtro));
    });
    filtros.querySelectorAll(".filter-option").forEach(opcao => {
        opcao.classList.toggle("ativo", opcao.querySelector(".tab").getAttribute("aria-pressed") === "true");
    });
    barra.hidden = filtro === "todos";
    seletor.value = campanhaPorFiltro[filtro] || "todas";
    filtrar();
}

function criarOpcao(filtro, nome) {
    const opcao = document.createElement("div");
    opcao.className = "filter-option";
    opcao.dataset.custom = "true";

    const aba = document.createElement("button");
    aba.className = "tab";
    aba.type = "button";
    aba.dataset.filter = filtro;
    aba.setAttribute("aria-pressed", "false");
    aba.textContent = nome;

    const remover = document.createElement("button");
    remover.className = "filter-remove";
    remover.type = "button";
    remover.textContent = "×";
    remover.setAttribute("aria-label", `Remover filtro ${nome}`);
    remover.title = "Remover filtro";

    opcao.append(aba, remover);
    filtros.insertBefore(opcao, adicionarFiltro);
}

function salvar() {
    const lista = [...filtros.querySelectorAll(".filter-option[data-custom]")].map(op => {
        const aba = op.querySelector(".tab");
        return { filtro: aba.dataset.filter, nome: aba.textContent };
    });
    localStorage.setItem(CHAVE, JSON.stringify(lista));
}

function gerarFiltro(nome) {
    return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

CAMPANHAS.forEach(([valor, texto]) => seletor.add(new Option(texto, valor)));

// Filtros criados anteriormente
try {
    (JSON.parse(localStorage.getItem(CHAVE)) || []).forEach(({ filtro, nome }) => criarOpcao(filtro, nome));
} catch { /* sem filtros salvos */ }

filtros.addEventListener("click", evento => {
    const botao = evento.target.closest("button");
    if (!botao) return;

    if (botao === adicionarFiltro) {
        formularioFiltro.hidden = !formularioFiltro.hidden;
        adicionarFiltro.setAttribute("aria-expanded", String(!formularioFiltro.hidden));
        if (!formularioFiltro.hidden) campoNome.focus();
    } else if (botao.classList.contains("filter-remove")) {
        const opcao = botao.closest(".filter-option");
        const eraAtivo = opcao.querySelector(".tab").getAttribute("aria-pressed") === "true";
        delete campanhaPorFiltro[opcao.querySelector(".tab").dataset.filter];
        opcao.remove();
        salvar();
        ativar(eraAtivo ? "todos" : filtros.querySelector(".tab[aria-pressed='true']").dataset.filter);
    } else if (botao.dataset.filter) {
        ativar(botao.dataset.filter);
    }
});

seletor.addEventListener("change", () => {
    const ativo = filtros.querySelector(".tab[aria-pressed='true']").dataset.filter;
    campanhaPorFiltro[ativo] = seletor.value;
    filtrar();
});

formularioFiltro.addEventListener("submit", evento => {
    evento.preventDefault();
    const nome = campoNome.value.trim();
    const filtro = gerarFiltro(nome);
    if (!filtro) return;

    if (filtros.querySelector(`.tab[data-filter="${filtro}"]`)) {
        campoNome.setCustomValidity("Esse filtro já existe.");
        campoNome.reportValidity();
        return;
    }

    criarOpcao(filtro, nome);
    salvar();
    formularioFiltro.reset();
    formularioFiltro.hidden = true;
    adicionarFiltro.setAttribute("aria-expanded", "false");
    ativar(filtro);
});

campoNome.addEventListener("input", () => campoNome.setCustomValidity(""));
formularioFiltro.addEventListener("keydown", evento => {
    if (evento.key === "Escape") {
        formularioFiltro.hidden = true;
        adicionarFiltro.setAttribute("aria-expanded", "false");
        adicionarFiltro.focus();
    }
});

if (busca) busca.addEventListener("input", filtrar);
