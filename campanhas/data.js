/* ==========================================================================
   Chronicle · Camada de dados das campanhas
   --------------------------------------------------------------------------
   - Não conhece o DOM: nada de document, modais ou cards aqui.
   - A interface (script.js) só conversa com `ChronicleData.campaigns`.
   - Todas as operações retornam Promises, como farão as chamadas a uma API.
     Assim, trocar o LocalStorage por fetch() não exige mexer na interface.

   Para integrar o backend Python depois:
     1. Complete/ajuste `createApiAdapter` (endpoints e formato das respostas).
     2. Troque a última linha do arquivo para `ChronicleData.use(createApiAdapter("/api"))`.
   ========================================================================== */
(function (global) {
    "use strict";

    const STORAGE_KEY = "chronicle_campaigns";
    const SCHEMA_VERSION = 2;

    const ROLES = ["mestre", "jogador"];
    const STATUSES = ["ativa", "pausada", "encerrada"]; // RN04 do documento de requisitos

    /* ---------- Erros ---------- */

    class DataError extends Error {
        constructor(message, code) {
            super(message);
            this.name = "DataError";
            this.code = code || "DATA_ERROR";
        }
    }

    /* ---------- Utilitários ---------- */

    function generateId() {
        if (global.crypto && typeof global.crypto.randomUUID === "function") {
            return global.crypto.randomUUID();
        }
        // Fallback para contextos sem randomUUID (ex.: http fora de localhost)
        return "camp-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    }

    function clean(text) {
        return typeof text === "string" ? text.trim() : "";
    }

    /* Valida e normaliza os dados recebidos. O backend fará o mesmo (nunca confie só no front). */
    function normalize(input, { partial } = { partial: false }) {
        const out = {};
        const has = key => Object.prototype.hasOwnProperty.call(input, key);

        if (!partial || has("name")) {
            out.name = clean(input.name);
            if (!out.name) throw new DataError("O nome da campanha é obrigatório.", "INVALID_NAME");
        }
        if (!partial || has("system")) {
            out.system = clean(input.system);
            if (!out.system) throw new DataError("O sistema de RPG é obrigatório.", "INVALID_SYSTEM");
        }
        if (!partial || has("role")) {
            // Só o mestre cria campanhas: sem papel informado, o papel é "mestre".
            out.role = ROLES.includes(input.role) ? input.role : "mestre";
        }
        if (!partial || has("status")) {
            const status = input.status || "ativa";
            if (!STATUSES.includes(status)) throw new DataError("Status inválido.", "INVALID_STATUS");
            out.status = status;
        }
        if (!partial || has("description")) out.description = clean(input.description);
        if (has("players")) out.players = Math.max(0, parseInt(input.players, 10) || 0);
        if (has("nextSession")) out.nextSession = clean(input.nextSession) || null;
        if (has("cover")) out.cover = clean(input.cover) || null;   // imagem do card (data URL 16:9)
        if (has("banner")) out.banner = clean(input.banner) || null; // imagem da tela inicial (data URL 5:2)
        if (has("sessions")) out.sessions = normalizeSessions(input.sessions);
        return out;
    }

    /* ---------- Cronograma: [{ id, startsAt (ISO), title }] ---------- */

    function normalizeSessions(list) {
        if (!Array.isArray(list)) return [];
        return list
            .map(item => ({
                id: clean(item && item.id) || generateId(),
                startsAt: clean(item && item.startsAt),
                title: clean(item && item.title).slice(0, 80)
            }))
            .filter(item => !Number.isNaN(new Date(item.startsAt).getTime()))
            .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    }

    // Por padrão NÃO existe nenhuma campanha cadastrada.
    const LEGACY_SEED = /^seed-/; // campanhas de exemplo de versões antigas são descartadas

    /* ==========================================================================
       Adaptador 1 · LocalStorage (armazenamento TEMPORÁRIO, só para simular persistência)
       Não é banco de dados: é por navegador, sem usuário, sem relacionamentos.
       ========================================================================== */

    function createLocalStorageAdapter() {
        // Lê sempre do storage (sem cache), assim abas diferentes não ficam desatualizadas.
        function readAll() {
            let raw;
            try {
                raw = global.localStorage.getItem(STORAGE_KEY);
            } catch (error) {
                throw new DataError("Não foi possível acessar o armazenamento do navegador.", "STORAGE_UNAVAILABLE");
            }
            if (raw === null) return [];
            try {
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed.campaigns) ? parsed.campaigns.filter(item => !LEGACY_SEED.test(item.id)) : [];
            } catch (error) {
                console.warn("[Chronicle] Dados de campanhas corrompidos; iniciando lista vazia.", error);
                return [];
            }
        }

        function writeAll(campaigns) {
            try {
                global.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, campaigns }));
            } catch (error) {
                throw new DataError("Não foi possível salvar (armazenamento cheio ou bloqueado).", "STORAGE_WRITE_FAILED");
            }
        }

        // Envolve em Promise para ter a mesma assinatura de uma chamada de rede.
        const run = fn => new Promise(resolve => resolve(fn()));
        const copy = item => ({ ...item });

        return {
            list() {
                return run(() => readAll().map(copy));
            },

            get(id) {
                return run(() => {
                    const found = readAll().find(item => item.id === id);
                    if (!found) throw new DataError("Campanha não encontrada.", "NOT_FOUND");
                    return copy(found);
                });
            },

            create(data) {
                return run(() => {
                    const now = new Date().toISOString();
                    const record = {
                        players: 0,
                        nextSession: null,
                        cover: null,
                        banner: null,
                        sessions: [],
                        ...normalize(data),
                        id: generateId(), // com API, o id passa a ser gerado pelo servidor
                        createdAt: now,
                        updatedAt: now
                    };
                    const all = readAll();
                    all.unshift(record); // mais recente primeiro
                    writeAll(all);
                    return copy(record);
                });
            },

            update(id, changes) {
                return run(() => {
                    const all = readAll();
                    const index = all.findIndex(item => item.id === id);
                    if (index === -1) throw new DataError("Campanha não encontrada.", "NOT_FOUND");
                    const updated = {
                        ...all[index],
                        ...normalize(changes, { partial: true }),
                        id, // o id nunca muda
                        updatedAt: new Date().toISOString()
                    };
                    all[index] = updated;
                    writeAll(all);
                    return copy(updated);
                });
            },

            remove(id) {
                return run(() => {
                    const all = readAll();
                    const next = all.filter(item => item.id !== id);
                    if (next.length === all.length) throw new DataError("Campanha não encontrada.", "NOT_FOUND");
                    writeAll(next);
                    return true;
                });
            }
        };
    }

    /* ==========================================================================
       Adaptador 2 · API REST (ESQUELETO, ainda não usado)
       Mapeia as mesmas 5 operações para endpoints. Ajuste conforme o backend Python.
       ========================================================================== */

    function createApiAdapter(baseUrl) {
        const root = (baseUrl || "/api").replace(/\/$/, "");

        async function request(path, options) {
            let response;
            try {
                response = await fetch(root + path, {
                    headers: { "Content-Type": "application/json" },
                    credentials: "include", // quando houver login/sessão
                    ...options
                });
            } catch (error) {
                throw new DataError("Sem conexão com o servidor.", "NETWORK");
            }
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new DataError(body.message || "Erro ao falar com o servidor.", body.code || "HTTP_" + response.status);
            }
            return response.status === 204 ? true : response.json();
        }

        const encode = id => encodeURIComponent(id);

        return {
            list: () => request("/campaigns"),
            get: id => request("/campaigns/" + encode(id)),
            create: data => request("/campaigns", { method: "POST", body: JSON.stringify(data) }),
            update: (id, changes) => request("/campaigns/" + encode(id), { method: "PATCH", body: JSON.stringify(changes) }),
            remove: id => request("/campaigns/" + encode(id), { method: "DELETE" })
        };
    }

    /* ---------- API pública ---------- */

    // O objeto `campaigns` delega para o adaptador ativo, então `use()` troca tudo em um ponto só.
    let adapter = createLocalStorageAdapter();

    const campaigns = {
        list: () => adapter.list(),
        get: id => adapter.get(id),
        create: data => adapter.create(data),
        update: (id, changes) => adapter.update(id, changes),
        remove: id => adapter.remove(id)
    };

    global.ChronicleData = {
        campaigns,
        constants: { ROLES, STATUSES },
        DataError,
        adapters: { createLocalStorageAdapter, createApiAdapter },
        use(nextAdapter) { adapter = nextAdapter; }
    };

    // Integração futura com o backend: descomente a linha abaixo.
    // global.ChronicleData.use(createApiAdapter("/api"));
})(window);
