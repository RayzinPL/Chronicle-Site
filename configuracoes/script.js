const form = document.getElementById("form-config");
const aviso = document.querySelector(".saved");
const CHAVE = "chronicle_config";

function aplicar(config) {
    document.documentElement.classList.toggle("sem-movimento", Boolean(config.movimento));
}

function carregar() {
    let config = {};
    try { config = JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch { config = {}; }
    for (const campo of form.elements) {
        if (!campo.name || !(campo.name in config)) continue;
        if (campo.type === "checkbox") campo.checked = config[campo.name];
        else campo.value = config[campo.name];
    }
    aplicar(config);
}

form.addEventListener("submit", evento => {
    evento.preventDefault();
    const config = {};
    for (const campo of form.elements) {
        if (!campo.name) continue;
        config[campo.name] = campo.type === "checkbox" ? campo.checked : campo.value;
    }
    localStorage.setItem(CHAVE, JSON.stringify(config));
    aplicar(config);
    aviso.textContent = "Alterações salvas.";
    setTimeout(() => { aviso.textContent = ""; }, 2500);
});

carregar();
