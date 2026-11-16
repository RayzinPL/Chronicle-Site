/* ==========================================================================
   Chronicle · Sincronização entre páginas (carregar DEPOIS de ../inicio/script.js e de data.js)
   1. Contador de campanhas do menu: igual em todas as páginas, vindo dos dados.
   2. Lembretes de sessão: aviso 1 dia antes e no dia, na central de notificações.
      Respeita a opção "Lembrete de sessão" em Configurações e nunca repete um aviso.

   Obs.: sem backend, o aviso aparece só neste navegador. Com o backend Python/SQL,
   a mesma regra (D-1 e D-0 por sessão) deve rodar no servidor para cada jogador da mesa.
   ========================================================================== */
(function () {
    "use strict";
    const ALERTS_KEY = "chronicle_session_alerts";
    const DAY = 86400000;
    const dayStart = date => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
    const remindersOn = () => {
        const settings = read("chronicle_account_settings", null);
        if (settings && settings.notifications && typeof settings.notifications.sessionAlerts === "boolean") {
            return settings.notifications.sessionAlerts;
        }
        return read("chronicle_config", {}).lembrete !== false;
    };
    const clock = date => `${date.getHours()}h${date.getMinutes() ? String(date.getMinutes()).padStart(2, "0") : ""}`;

    async function sync() {
        if (!window.ChronicleData) return;
        let campaigns;
        try { campaigns = await window.ChronicleData.campaigns.list(); } catch { return; }

        document.querySelectorAll(".menu-count").forEach(el => { el.textContent = campaigns.length; el.hidden = false; });

        if (!remindersOn() || typeof window.addNotification !== "function") return;
        const sent = read(ALERTS_KEY, {});
        const alive = new Set();
        const now = new Date();
        const today = dayStart(now);
        let changed = false;

        campaigns.forEach(campaign => {
            if (campaign.status === "encerrada") return;
            (campaign.sessions || []).forEach(session => {
                const date = new Date(session.startsAt);
                if (Number.isNaN(date.getTime())) return;
                alive.add(session.id + ":d1"); alive.add(session.id + ":d0");
                const diff = Math.round((dayStart(date) - today) / DAY);
                const kind = diff === 1 ? "d1" : diff === 0 && date > now ? "d0" : null;
                const key = kind && `${session.id}:${kind}`;
                if (!key || sent[key]) return;
                sent[key] = Date.now();
                changed = true;
                const label = session.title ? `${campaign.name} · ${session.title}` : campaign.name;
                window.addNotification(
                    kind === "d1" ? "Sessão amanhã" : "Sessão hoje",
                    `${label} começa ${kind === "d1" ? "amanhã" : "hoje"} às ${clock(date)}.`
                );
            });
        });

        Object.keys(sent).forEach(key => { if (!alive.has(key)) { delete sent[key]; changed = true; } });
        if (changed) localStorage.setItem(ALERTS_KEY, JSON.stringify(sent));
    }

    sync();
    setInterval(sync, 60000);
    window.addEventListener("storage", sync);
    window.addEventListener("chronicle:campaigns-changed", sync);
})();

/* Perfil compartilhado: mantém o cabeçalho consistente entre as páginas. */
(function () {
    "use strict";

    function loadProfile() {
        let profile = {};
        try { profile = JSON.parse(localStorage.getItem("chronicle_profile")) || {}; } catch (error) {
            console.warn("[Chronicle] Não foi possível atualizar o perfil do cabeçalho.", error);
        }
        const image = document.querySelector(".perfil-logo");
        const name = document.querySelector(".nomeperfil");
        const welcomeName = document.querySelector(".hello h1 em");
        if (image) {
            image.src = profile.avatar || "../images/perfil.jpeg";
            image.alt = profile.displayName ? `Foto de ${profile.displayName}` : "Foto do usuário";
        }
        if (name && profile.displayName) name.textContent = profile.displayName;
        if (welcomeName && profile.displayName) welcomeName.textContent = profile.displayName;
    }

    loadProfile();
    window.addEventListener("chronicle:profile-changed", loadProfile);
    window.addEventListener("storage", event => {
        if (event.key === "chronicle_profile") loadProfile();
    });
})();
