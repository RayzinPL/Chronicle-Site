/* ==========================================================================
   Chronicle · Dados de perfil e conta
   LocalStorage é somente o adaptador temporário. A interface conversa com
   este contrato para que a troca por uma API Python/SQL fique isolada.
   ========================================================================== */
(function (global) {
    "use strict";

    const PROFILE_KEY = "chronicle_profile";
    const SETTINGS_KEY = "chronicle_account_settings";
    const DEFAULT_PROFILE = {
        displayName: "Daniel",
        username: "daniel",
        bio: "",
        avatar: "../images/perfil.jpeg",
        createdAt: new Date().toISOString()
    };
    const DEFAULT_SETTINGS = {
        motionReduced: false,
        notifications: {
            campaignInvites: true,
            friendRequests: true,
            campaignUpdates: true,
            sessionAlerts: true,
            other: true
        },
        privacy: {
            profileVisibility: "public",
            allowFriendRequests: true,
            showActivity: true
        }
    };

    class AccountDataError extends Error {
        constructor(message, code) {
            super(message);
            this.name = "AccountDataError";
            this.code = code || "ACCOUNT_DATA_ERROR";
        }
    }

    function read(key, fallback) {
        try {
            const raw = global.localStorage.getItem(key);
            return raw === null ? fallback : JSON.parse(raw);
        } catch (error) {
            console.warn("[Chronicle] Não foi possível ler os dados da conta.", error);
            return fallback;
        }
    }

    function write(key, value) {
        try {
            global.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            throw new AccountDataError("Não foi possível salvar. O armazenamento pode estar cheio ou bloqueado.", "STORAGE_WRITE_FAILED");
        }
    }

    function merge(base, value) {
        return Object.keys(base).reduce((result, key) => {
            const source = value && typeof value === "object" ? value[key] : undefined;
            result[key] = base[key] && typeof base[key] === "object" && !Array.isArray(base[key])
                ? merge(base[key], source)
                : source === undefined ? base[key] : source;
            return result;
        }, {});
    }

    function clean(text) {
        return typeof text === "string" ? text.trim() : "";
    }

    function normalizeProfile(input) {
        const profile = {
            displayName: clean(input.displayName).replace(/\s+/g, " "),
            username: clean(input.username).toLowerCase(),
            bio: clean(input.bio).slice(0, 240),
            avatar: typeof input.avatar === "string" && input.avatar ? input.avatar : DEFAULT_PROFILE.avatar,
            createdAt: input.createdAt || DEFAULT_PROFILE.createdAt
        };
        if (profile.displayName.length < 2) throw new AccountDataError("Informe um nome de exibição.", "INVALID_DISPLAY_NAME");
        if (!/^[a-z0-9._-]{3,30}$/.test(profile.username)) throw new AccountDataError("O nome de usuário deve ter de 3 a 30 caracteres válidos.", "INVALID_USERNAME");
        return profile;
    }

    function readProfile() {
        const legacy = read("chronicle_config", {});
        const profile = merge(DEFAULT_PROFILE, read(PROFILE_KEY, {}));
        if (!read(PROFILE_KEY, null) && legacy.nome) profile.displayName = clean(legacy.nome);
        return profile;
    }

    const localAdapter = {
        getProfile() {
            return Promise.resolve({ ...readProfile() });
        },
        updateProfile(changes) {
            const profile = normalizeProfile({ ...readProfile(), ...changes });
            write(PROFILE_KEY, profile);
            global.dispatchEvent(new CustomEvent("chronicle:profile-changed", { detail: profile }));
            return Promise.resolve({ ...profile });
        },
        getSettings() {
            return Promise.resolve(merge(DEFAULT_SETTINGS, read(SETTINGS_KEY, {})));
        },
        updateSettings(changes) {
            const settings = merge(DEFAULT_SETTINGS, changes);
            write(SETTINGS_KEY, settings);
            return Promise.resolve(settings);
        }
    };

    function createApiAdapter(baseUrl) {
        const root = (baseUrl || "/api").replace(/\/$/, "");
        async function request(path, options) {
            let response;
            try {
                response = await fetch(root + path, { headers: { "Content-Type": "application/json" }, credentials: "include", ...options });
            } catch (error) {
                throw new AccountDataError("Sem conexão com o servidor.", "NETWORK");
            }
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new AccountDataError(body.message || "Erro ao falar com o servidor.", body.code || "HTTP_" + response.status);
            }
            return response.status === 204 ? true : response.json();
        }
        return {
            getProfile: () => request("/me/profile"),
            updateProfile: changes => request("/me/profile", { method: "PATCH", body: JSON.stringify(changes) }),
            getSettings: () => request("/me/settings"),
            updateSettings: changes => request("/me/settings", { method: "PATCH", body: JSON.stringify(changes) })
        };
    }

    global.ChronicleAccount = {
        profile: {
            get: () => localAdapter.getProfile(),
            update: changes => localAdapter.updateProfile(changes)
        },
        settings: {
            get: () => localAdapter.getSettings(),
            update: changes => localAdapter.updateSettings(changes)
        },
        constants: { DEFAULT_PROFILE, DEFAULT_SETTINGS },
        adapters: { local: localAdapter, createApiAdapter },
        use(nextAdapter) {
            if (!nextAdapter || typeof nextAdapter.getProfile !== "function") {
                throw new AccountDataError("Adaptador de conta inválido.", "INVALID_ADAPTER");
            }
            this.profile.get = () => nextAdapter.getProfile();
            this.profile.update = changes => nextAdapter.updateProfile(changes);
            this.settings.get = () => nextAdapter.getSettings();
            this.settings.update = changes => nextAdapter.updateSettings(changes);
        }
    };
})(window);
