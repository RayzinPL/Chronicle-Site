/* ==========================================================================
   Chronicle · Camada de dados dos amigos
   --------------------------------------------------------------------------
   - Não conhece o DOM. Compartilhada pela página de amigos e pela inicial.
   - Todas as operações retornam Promises, como farão as chamadas a uma API.
   - A lista começa VAZIA: nenhum amigo é criado automaticamente.
   - LocalStorage é só uma simulação temporária (por navegador, sem usuários
     reais). Quando existir o backend Python/SQL, o fluxo de "adicionar amigo"
     deve virar convite/aceite entre usuários cadastrados.

   Para integrar o backend depois:
     1. Ajuste `createApiAdapter` (endpoints e formato das respostas).
     2. Descomente a última linha do arquivo.
   ========================================================================== */
(function (global) {
    "use strict";

    const STORAGE_KEY = "chronicle_friends";
    const SCHEMA_VERSION = 1;

    const STATUSES = ["online", "jogando", "offline"]; // presença (virá do backend)
    const AVATARS = ["peach", "teal", "lilac"];
    const LIMITS = { nameMin: 2, nameMax: 60, emailMax: 120 };
    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    class DataError extends Error {
        constructor(message, code) {
            super(message);
            this.name = "DataError";
            this.code = code || "DATA_ERROR";
        }
    }

    /* ---------- Utilitários ---------- */

    function generateId() {
        if (global.crypto && typeof global.crypto.randomUUID === "function") return global.crypto.randomUUID();
        return "friend-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    }

    const clean = text => (typeof text === "string" ? text.trim() : "");
    const fold = text => clean(text).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

    // Chave de identidade usada para impedir duplicatas
    const identityKey = friend => (friend.email ? "e:" + friend.email.toLowerCase() : "n:" + fold(friend.name));

    function normalize(input, { partial } = { partial: false }) {
        const out = {};
        const has = key => Object.prototype.hasOwnProperty.call(input, key);

        if (!partial || has("name")) {
            out.name = clean(input.name).replace(/\s+/g, " ");
            if (out.name.length < LIMITS.nameMin || out.name.length > LIMITS.nameMax) {
                throw new DataError("Informe um nome entre " + LIMITS.nameMin + " e " + LIMITS.nameMax + " caracteres.", "INVALID_NAME");
            }
        }
        if (!partial || has("email")) {
            out.email = clean(input.email).toLowerCase();
            if (out.email && (out.email.length > LIMITS.emailMax || !EMAIL_PATTERN.test(out.email))) {
                throw new DataError("E-mail inválido.", "INVALID_EMAIL");
            }
        }
        if (!partial || has("status")) {
            const status = input.status || "offline";
            if (!STATUSES.includes(status)) throw new DataError("Status inválido.", "INVALID_STATUS");
            out.status = status;
        }
        if (has("activity")) out.activity = clean(input.activity) || null;
        if (has("avatar")) out.avatar = AVATARS.includes(input.avatar) ? input.avatar : AVATARS[0];
        return out;
    }

    /* ==========================================================================
       Adaptador 1 · LocalStorage (TEMPORÁRIO)
       ========================================================================== */

    function createLocalStorageAdapter() {
        function readAll() {
            let raw;
            try {
                raw = global.localStorage.getItem(STORAGE_KEY);
            } catch (error) {
                throw new DataError("Não foi possível acessar o armazenamento do navegador.", "STORAGE_UNAVAILABLE");
            }
            if (raw === null) return []; // padrão: ninguém na lista
            try {
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed.friends) ? parsed.friends : [];
            } catch (error) {
                console.warn("[Chronicle] Dados de amigos corrompidos; iniciando lista vazia.", error);
                return [];
            }
        }

        function writeAll(friends) {
            try {
                global.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, friends }));
            } catch (error) {
                throw new DataError("Não foi possível salvar (armazenamento cheio ou bloqueado).", "STORAGE_WRITE_FAILED");
            }
        }

        const run = fn => new Promise(resolve => resolve(fn()));
        const copy = item => ({ ...item });

        return {
            list() {
                return run(() => readAll().map(copy));
            },

            get(id) {
                return run(() => {
                    const found = readAll().find(item => item.id === id);
                    if (!found) throw new DataError("Amigo não encontrado.", "NOT_FOUND");
                    return copy(found);
                });
            },

            create(data) {
                return run(() => {
                    const now = new Date().toISOString();
                    const record = {
                        activity: null,
                        avatar: AVATARS[0],
                        ...normalize(data),
                        id: generateId(), // com API, o id passa a ser do servidor
                        createdAt: now,
                        updatedAt: now
                    };
                    const all = readAll();
                    if (all.some(item => identityKey(item) === identityKey(record))) {
                        throw new DataError("Essa pessoa já está na sua lista de amigos.", "DUPLICATE");
                    }
                    all.unshift(record); // mais recente primeiro
                    writeAll(all);
                    return copy(record);
                });
            },

            update(id, changes) {
                return run(() => {
                    const all = readAll();
                    const index = all.findIndex(item => item.id === id);
                    if (index === -1) throw new DataError("Amigo não encontrado.", "NOT_FOUND");
                    const updated = { ...all[index], ...normalize(changes, { partial: true }), id, updatedAt: new Date().toISOString() };
                    all[index] = updated;
                    writeAll(all);
                    return copy(updated);
                });
            },

            remove(id) {
                return run(() => {
                    const all = readAll();
                    const next = all.filter(item => item.id !== id);
                    if (next.length === all.length) throw new DataError("Amigo não encontrado.", "NOT_FOUND");
                    writeAll(next);
                    return true;
                });
            }
        };
    }

    /* ==========================================================================
       Adaptador 2 · API REST (ESQUELETO, ainda não usado)
       ========================================================================== */

    function createApiAdapter(baseUrl) {
        const root = (baseUrl || "/api").replace(/\/$/, "");

        async function request(path, options) {
            let response;
            try {
                response = await fetch(root + path, { headers: { "Content-Type": "application/json" }, credentials: "include", ...options });
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
            list: () => request("/friends"),
            get: id => request("/friends/" + encode(id)),
            create: data => request("/friends", { method: "POST", body: JSON.stringify(data) }),
            update: (id, changes) => request("/friends/" + encode(id), { method: "PATCH", body: JSON.stringify(changes) }),
            remove: id => request("/friends/" + encode(id), { method: "DELETE" })
        };
    }

    /* ---------- API pública ---------- */

    let adapter = createLocalStorageAdapter();

    global.ChronicleFriends = {
        friends: {
            list: () => adapter.list(),
            get: id => adapter.get(id),
            create: data => adapter.create(data),
            update: (id, changes) => adapter.update(id, changes),
            remove: id => adapter.remove(id)
        },
        constants: { STATUSES, AVATARS, LIMITS },
        storageKey: STORAGE_KEY, // usado para sincronizar abas/páginas (evento "storage")
        emailPattern: EMAIL_PATTERN,
        DataError,
        adapters: { createLocalStorageAdapter, createApiAdapter },
        use(nextAdapter) { adapter = nextAdapter; }
    };

    // Integração futura com o backend: descomente a linha abaixo.
    // global.ChronicleFriends.use(createApiAdapter("/api"));
})(window);
