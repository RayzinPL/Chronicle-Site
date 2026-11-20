(function () {
"use strict";
const KEY = "chronicle_fichas", $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const A = (nome, sigla, valor) => ({ id: uid(), nome, sigla, valor });
const R = (nome, atual, max) => ({ id: uid(), nome, atual, max });
const P = (nome, attr, bonus) => ({ id: uid(), nome, attr, bonus });
const B = titulo => ({ id: uid(), titulo, texto: "" });
const rg = (modo, qtd, lados, alvo, mod, base, div) => ({ modo, qtd, lados, alvo, mod, base, div });
const PRESETS = {
  dnd: ["D&D 5e", () => { const a = [A("Força","FOR",10),A("Destreza","DES",10),A("Constituição","CON",10),A("Inteligência","INT",10),A("Sabedoria","SAB",10),A("Carisma","CAR",10)];
    return { regras: rg("soma",1,20,0,"formula",10,2), atributos: a, recursos: [R("Pontos de vida",10,10),R("Classe de armadura",10,10)], pericias: [P("Atletismo",a[0].id,0),P("Furtividade",a[1].id,0),P("Percepção",a[4].id,0)], blocos: [B("Equipamento"),B("Magias e habilidades")] }; }],
  coc: ["Call of Cthulhu", () => ({ regras: rg("abaixo",1,100,0,"nenhum",0,1), atributos: ["Força","Constituição","Tamanho","Destreza","Aparência","Inteligência","Poder","Educação"].map(n => A(n, n.slice(0,3).toUpperCase(), 50)), recursos: [R("Pontos de vida",10,10),R("Sanidade",50,99),R("Pontos de magia",10,10)], pericias: [P("Ocultismo","",5),P("Biblioteca","",20),P("Furtividade","",20)], blocos: [B("Histórico")] })],
  cyber: ["Cyberpunk RED", () => { const a = ["Inteligência","Reflexos","Destreza","Tecnologia","Vontade","Sorte","Movimento","Corpo","Empatia"].map(n => A(n, n.slice(0,3).toUpperCase(), 5));
    return { regras: rg("soma",1,10,0,"valor",0,1), atributos: a, recursos: [R("Pontos de vida",40,40),R("Humanidade",50,50)], pericias: [P("Atirar",a[1].id,0),P("Percepção",a[0].id,0),P("Brigar",a[2].id,0)], blocos: [B("Cyberware"),B("Equipamento")] }; }],
  wod: ["Mundo das Trevas (reserva d10)", () => { const a = ["Força","Destreza","Vigor","Carisma","Raciocínio"].map(n => A(n, n.slice(0,3).toUpperCase(), 2));
    return { regras: rg("pool",1,10,6,"nenhum",0,1), atributos: a, recursos: [R("Vitalidade",7,7),R("Força de vontade",5,5),R("Pontos de sangue",10,10)], pericias: [P("Briga",a[0].id,1),P("Furtividade",a[1].id,1),P("Empatia",a[3].id,0)], blocos: [B("Disciplinas e méritos")] }; }],
  fallout: ["Fallout RPG (2d20)", () => { const a = ["Força","Percepção","Resistência","Carisma","Inteligência","Agilidade","Sorte"].map(n => A(n, n.slice(0,3).toUpperCase(), 5));
    return { regras: rg("abaixo",2,20,0,"nenhum",0,1), atributos: a, recursos: [R("Pontos de vida",10,10),R("Pontos de ação",2,2)], pericias: [P("Armas pequenas",a[5].id,1),P("Medicina",a[4].id,0)], blocos: [B("Perks e itens")] }; }],
  pbta: ["Genérico 2d6", () => ({ regras: rg("soma",2,6,0,"valor",0,1), atributos: ["Corpo","Mente","Charme","Instinto"].map(n => A(n, n.slice(0,3).toUpperCase(), 0)), recursos: [R("Vida",6,6)], pericias: [], blocos: [B("Movimentos")] })],
  vazio: ["Em branco (monte do zero)", () => ({ regras: rg("soma",1,20,0,"valor",0,1), atributos: [], recursos: [], pericias: [], blocos: [] })]
};
const nova = (k, nome) => { const [sistema, fn] = PRESETS[k]; return Object.assign({ id: uid(), nome: nome || "Novo personagem", sistema }, fn()); };
let db; try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
if (!db || !Array.isArray(db.fichas) || !db.fichas.length) { const f = nova("dnd", "Personagem de exemplo"); db = { fichas: [f], atual: f.id }; }
let mestre = false, log = [];
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
const cur = () => db.fichas.find(f => f.id === db.atual) || db.fichas[0];
const atr = (f, id) => f.atributos.find(a => a.id === id);
const num = v => Number(v) || 0;
const mod = (f, a) => { if (!a) return 0; const r = f.regras; return r.mod === "valor" ? num(a.valor) : r.mod === "formula" ? Math.floor((num(a.valor) - num(r.base)) / (num(r.div) || 1)) : 0; };
const sg = n => (n >= 0 ? "+" : "−") + Math.abs(n);
const d = l => 1 + Math.floor(Math.random() * Math.max(1, l));
function rolar(f, rotulo, a, bonus, soAttr) {
  const r = f.regras, q = Math.min(30, Math.max(1, num(r.qtd))), L = num(r.lados) || 20, res = [];
  const base = a ? num(a.valor) : 0;
  if (r.modo === "soma") { for (let i = 0; i < q; i++) res.push(d(L)); const m = mod(f, a) + bonus, t = res.reduce((x, y) => x + y, 0) + m; return [rotulo, String(t), `${q}d${L} [${res.join(", ")}] ${sg(m)}`]; }
  if (r.modo === "abaixo") { const lim = base + bonus; for (let i = 0; i < q; i++) res.push(d(L)); const s = res.filter(x => x <= lim).length; return [rotulo, q === 1 ? (s ? "Sucesso" : "Falha") : `${s} sucesso(s)`, `${q}d${L} [${res.join(", ")}] contra ≤ ${lim}`]; }
  const n = Math.min(30, Math.max(0, base + bonus)); for (let i = 0; i < n; i++) res.push(d(L)); const s = res.filter(x => x >= num(r.alvo)).length;
  return [rotulo, `${s} sucesso(s)`, `${n}d${L} [${res.join(", ")}] sucesso em ≥ ${r.alvo}`];
}
const inp = (p, v, o = {}) => `<input class="f-in ${o.c || ""}" data-p="${p}" ${o.r ? "data-r" : ""} type="${o.t || "text"}" value="${esc(v)}" ${o.ph ? `placeholder="${o.ph}"` : ""} aria-label="${esc(o.l || o.ph || p)}">`;
const rm = (k, i, l) => mestre ? `<button class="f-x" type="button" data-rm="${k}:${i}" aria-label="Remover ${esc(l)}">×</button>` : "";
const add = (k, t) => mestre ? `<button class="btn btn-outline f-mini" type="button" data-add="${k}">+ ${t}</button>` : "";
function render() {
  const f = cur(), r = f.regras, $s = $("#sel-ficha");
  $s.innerHTML = db.fichas.map(x => `<option value="${x.id}" ${x.id === f.id ? "selected" : ""}>${esc(x.nome)} · ${esc(x.sistema)}</option>`).join("");
  document.querySelectorAll(".tab[data-modo]").forEach(t => t.setAttribute("aria-pressed", String((t.dataset.modo === "mestre") === mestre)));
  const opts = (v, l) => l.map(([k, t]) => `<option value="${k}" ${k === v ? "selected" : ""}>${t}</option>`).join("");
  const regras = !mestre ? "" : `<div class="f-sec"><h3>Sistema de dados</h3><div class="f-regras">
    <label>Mecânica<select class="f-in" data-p="regras.modo" data-r>${opts(r.modo, [["soma", "Somar dados + modificador"], ["abaixo", "Tirar igual ou abaixo"], ["pool", "Reserva de dados (sucessos)"]])}</select></label>
    <label>Quantidade<input class="f-in num" type="number" min="1" max="30" data-p="regras.qtd" value="${r.qtd}"></label>
    <label>Lados<input class="f-in num" type="number" min="2" data-p="regras.lados" value="${r.lados}"></label>
    ${r.modo === "pool" ? `<label>Sucesso em ≥<input class="f-in num" type="number" data-p="regras.alvo" value="${r.alvo}"></label>` : ""}
    ${r.modo === "soma" ? `<label>Modificador<select class="f-in" data-p="regras.mod" data-r>${opts(r.mod, [["nenhum", "Nenhum"], ["valor", "Igual ao atributo"], ["formula", "Fórmula: (valor − base) ÷ divisor"]])}</select></label>` : ""}
    ${r.modo === "soma" && r.mod === "formula" ? `<label>Base<input class="f-in num" type="number" data-p="regras.base" value="${r.base}"></label><label>Divisor<input class="f-in num" type="number" data-p="regras.div" value="${r.div}"></label>` : ""}
    </div></div>`;
  const showMod = r.modo === "soma" && r.mod !== "nenhum";
  const attrs = f.atributos.map((a, i) => `<div class="f-attr">${mestre ? inp(`atributos.${i}.nome`, a.nome, { r: 1, l: "Nome do atributo" }) + inp(`atributos.${i}.sigla`, a.sigla, { l: "Sigla", c: "num" }) : `<b>${esc(a.nome)}</b>`}
    ${inp(`atributos.${i}.valor`, a.valor, { t: "number", c: "num", l: a.nome })}${showMod ? `<span class="f-mod" data-mod="${a.id}">${sg(mod(f, a))}</span>` : ""}
    <button class="btn btn-primary f-mini" type="button" data-roll="a:${a.id}">Rolar</button>${rm("atributos", i, a.nome)}</div>`).join("");
  const recs = f.recursos.map((x, i) => `<div class="f-linha">${mestre ? inp(`recursos.${i}.nome`, x.nome, { l: "Nome" }) : `<strong style="flex:1 1 140px">${esc(x.nome)}</strong>`}${inp(`recursos.${i}.atual`, x.atual, { t: "number", c: "num", l: "Atual" })}/${inp(`recursos.${i}.max`, x.max, { t: "number", c: "num", l: "Máximo" })}${rm("recursos", i, x.nome)}</div>`).join("");
  const pers = f.pericias.map((x, i) => `<div class="f-linha">${mestre ? inp(`pericias.${i}.nome`, x.nome, { l: "Nome" }) : `<strong style="flex:1 1 140px">${esc(x.nome)}</strong>`}
    ${mestre ? `<select class="f-in" data-p="pericias.${i}.attr" aria-label="Atributo ligado"><option value="">Sem atributo</option>${f.atributos.map(a => `<option value="${a.id}" ${a.id === x.attr ? "selected" : ""}>${esc(a.nome)}</option>`).join("")}</select>` : `<span class="muted">${esc(atr(f, x.attr)?.sigla || "—")}</span>`}
    ${inp(`pericias.${i}.bonus`, x.bonus, { t: "number", c: "num", l: "Bônus ou valor" })}<button class="btn btn-primary f-mini" type="button" data-roll="p:${x.id}">Rolar</button>${rm("pericias", i, x.nome)}</div>`).join("");
  const blocos = f.blocos.map((x, i) => `<div class="f-sec"><div class="f-linha">${mestre ? inp(`blocos.${i}.titulo`, x.titulo, { l: "Título" }) : `<h3 style="margin:0">${esc(x.titulo)}</h3>`}${rm("blocos", i, x.titulo)}</div><textarea class="f-txt" data-p="blocos.${i}.texto" aria-label="${esc(x.titulo)}">${esc(x.texto)}</textarea></div>`).join("");
  $("#ficha").innerHTML = `${inp("nome", f.nome, { c: "nome", l: "Nome do personagem" })}
    <div class="f-linha">${mestre ? inp("sistema", f.sistema, { l: "Sistema de RPG", ph: "Sistema de RPG" }) : `<span class="muted">Sistema: ${esc(f.sistema)}</span>`}</div>
    ${regras}<div class="f-sec"><h3>Atributos</h3><div class="f-attrs">${attrs}</div><p></p>${add("atributos", "Atributo")}</div>
    <div class="f-sec"><h3>Recursos</h3>${recs}${add("recursos", "Recurso")}</div>
    <div class="f-sec"><h3>Perícias</h3>${pers}${add("pericias", "Perícia")}</div>${blocos}<div>${add("blocos", "Bloco de texto")}</div>`;
  $("#f-log").innerHTML = log.map(l => `<li><strong>${esc(l[1])}</strong>${esc(l[0])}<br><span class="muted">${esc(l[2])}</span></li>`).join("") || `<li class="muted">Clique em Rolar para ver os resultados aqui.</li>`;
}
function setPath(o, p, v) { const k = p.split("."); while (k.length > 1) o = o[k.shift()]; o[k[0]] = v; }
const root = $("#ficha");
root.addEventListener("input", e => { const p = e.target.dataset.p; if (!p) return; const num = e.target.type === "number"; setPath(cur(), p, num ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value); save();
  const f = cur(); document.querySelectorAll("[data-mod]").forEach(el => { el.textContent = sg(mod(f, atr(f, el.dataset.mod))); }); });
root.addEventListener("change", e => { if (e.target.dataset.p && (e.target.hasAttribute("data-r") || e.target.tagName === "SELECT")) { setPath(cur(), e.target.dataset.p, e.target.value); save(); render(); } });
root.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return; const f = cur();
  if (b.dataset.roll) { const [t, id] = b.dataset.roll.split(":"); let res;
    if (t === "a") { const a = atr(f, id); res = rolar(f, a.nome, a, 0); } else { const p = f.pericias.find(x => x.id === id); res = rolar(f, p.nome, atr(f, p.attr), num(p.bonus)); }
    log.unshift(res); log = log.slice(0, 20); render(); return; }
  if (b.dataset.rm) { const [k, i] = b.dataset.rm.split(":"); f[k].splice(Number(i), 1); }
  if (b.dataset.add) { const k = b.dataset.add; f[k].push(k === "atributos" ? A("Novo atributo", "NOV", 10) : k === "recursos" ? R("Novo recurso", 0, 10) : k === "pericias" ? P("Nova perícia", "", 0) : B("Novo bloco")); }
  save(); render();
});
$("#sel-ficha").addEventListener("change", e => { db.atual = e.target.value; save(); render(); });
document.querySelectorAll(".tab[data-modo]").forEach(t => t.addEventListener("click", () => { mestre = t.dataset.modo === "mestre"; render(); }));
$("#preset").innerHTML = Object.entries(PRESETS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join("");
$("#btn-nova").addEventListener("click", () => { const f = nova($("#preset").value); db.fichas.push(f); db.atual = f.id; mestre = true; save(); render(); });
$("#btn-dup").addEventListener("click", () => { const f = JSON.parse(JSON.stringify(cur())); f.id = uid(); f.nome += " (cópia)"; db.fichas.push(f); db.atual = f.id; save(); render(); });
$("#btn-del").addEventListener("click", () => { if (!confirm(`Excluir a ficha "${cur().nome}"?`)) return; db.fichas = db.fichas.filter(x => x.id !== db.atual); if (!db.fichas.length) db.fichas.push(nova("dnd", "Novo personagem")); db.atual = db.fichas[0].id; save(); render(); });
$("#btn-exp").addEventListener("click", () => { const f = cur(), a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(f, null, 2)], { type: "application/json" })); a.download = `ficha-${f.nome.toLowerCase().replace(/\W+/g, "-")}.json`; a.click(); URL.revokeObjectURL(a.href); });
$("#btn-imp").addEventListener("click", () => $("#arq").click());
$("#arq").addEventListener("change", async e => { const file = e.target.files[0]; if (!file) return; try { const f = JSON.parse(await file.text()); if (!f.regras || !Array.isArray(f.atributos)) throw 0; f.id = uid(); f.recursos = f.recursos || []; f.pericias = f.pericias || []; f.blocos = f.blocos || []; db.fichas.push(f); db.atual = f.id; save(); render(); } catch { alert("Arquivo inválido: use um JSON exportado pelo Chronicle."); } e.target.value = ""; });
render();
})();
