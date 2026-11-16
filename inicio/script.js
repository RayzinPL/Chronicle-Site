
const notificationButton = document.querySelector(".notification");
const notificationPanel = document.querySelector(".notification-panel");
const notificationList = document.querySelector(".notification-list");
const notificationCount = document.querySelector(".notification-count");
const markAllButton = document.querySelector(".mark-all-read");

// Carregar notificações salvas
let notifications = JSON.parse(
    localStorage.getItem("chronicle_notifications")
) || [
    {
        id: 1,
        title: "Bem-vindo ao Chronicle!",
        message: "Sua jornada começa agora. Prepare-se para criar suas histórias.",
        read: false
    },
    {
        id: 2,
        title: "Central de notificações",
        message: "Aqui você acompanhará as novidades das suas campanhas.",
        read: false
    }
];

// Salvar notificações
function saveNotifications() {
    localStorage.setItem(
        "chronicle_notifications",
        JSON.stringify(notifications)
    );
}

// Atualizar contador
function updateNotificationCount() {
    const unread = notifications.filter(n => !n.read).length;

    notificationCount.textContent = unread > 99 ? "99+" : unread;
    notificationCount.hidden = unread === 0;
}

// Exibir notificações
function renderNotifications() {
    notificationList.innerHTML = "";

    if (notifications.length === 0) {
        notificationList.innerHTML = `
            <div class="notification-empty">
                <p>Nenhuma notificação por aqui.</p>
                <span>Quando houver novidades, elas aparecerão aqui.</span>
            </div>
        `;

        updateNotificationCount();
        return;
    }

    notifications.forEach(notification => {
        const item = document.createElement("div");

        item.className = "notification-item";

        if (!notification.read) {
            item.classList.add("unread");
        }

        const content = document.createElement("div");
        content.className = "notification-content";

        const title = document.createElement("strong");
        title.textContent = notification.title;

        const message = document.createElement("p");
        message.textContent = notification.message;

        content.append(title, message);

        const dot = document.createElement("span");
        dot.className = "notification-dot";

        const deleteButton = document.createElement("button");
        deleteButton.className = "notification-delete";
        deleteButton.type = "button";
        deleteButton.textContent = "×";
        deleteButton.setAttribute("aria-label", "Excluir notificação");

        deleteButton.addEventListener("click", () => {
            deleteNotification(notification.id);
        });

        // Marcar como lida ao clicar
        item.addEventListener("click", () => {
            markAsRead(notification.id);
        });

        item.append(dot, content, deleteButton);
        notificationList.appendChild(item);
    });

    updateNotificationCount();
}

// Adicionar notificação
function addNotification(title, message) {
    const notification = {
        id: Date.now(),
        title: title,
        message: message,
        read: false
    };

    notifications.unshift(notification);

    saveNotifications();
    renderNotifications();
}

// Marcar uma como lida
function markAsRead(id) {
    notifications = notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
    );

    saveNotifications();
    renderNotifications();
}

// Marcar todas como lidas
markAllButton.addEventListener("click", () => {
    notifications = notifications.map(n => ({
        ...n,
        read: true
    }));

    saveNotifications();
    renderNotifications();
});

// Excluir notificação
function deleteNotification(id) {
    notifications = notifications.filter(n => n.id !== id);

    saveNotifications();
    renderNotifications();
}

// Abrir e fechar painel
notificationButton.addEventListener("click", () => {
    const isOpen = !notificationPanel.hidden;

    notificationPanel.hidden = isOpen;

    notificationButton.setAttribute(
        "aria-expanded",
        String(!isOpen)
    );
});

// Fechar ao clicar fora
document.addEventListener("click", event => {
    if (!event.target.closest(".notification-container")) {
        notificationPanel.hidden = true;
        notificationButton.setAttribute("aria-expanded", "false");
    }
});

// Fechar com ESC
document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        notificationPanel.hidden = true;
        notificationButton.setAttribute("aria-expanded", "false");
    }
});

// Inicializar
renderNotifications();

function updateSessionCountdown() {
    document.querySelectorAll("[data-session-date]").forEach(element => {
        const sessionDate = new Date(element.dataset.sessionDate);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
        const daysUntilSession = Math.round(
            (sessionDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        element.textContent = daysUntilSession > 1
            ? `Faltam ${daysUntilSession} dias`
            : daysUntilSession === 1
                ? "Falta 1 dia"
                : daysUntilSession === 0
                    ? "Sessão hoje"
                    : "Sessão encerrada";
    });
}

updateSessionCountdown();

const campaignRepository = window.ChronicleData && window.ChronicleData.campaigns;
const campaignMonths = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Imagem do destaque: a da tela inicial (banner); sem ela, a do card; sem nenhuma, só o fundo roxo
function campaignCover(campaign) {
    const isImage = value => typeof value === "string" && value.startsWith("data:image/");
    return isImage(campaign.banner) ? campaign.banner : isImage(campaign.cover) ? campaign.cover : null;
}

function campaignPlayers(count) {
    return count > 0 ? `${count} ${count === 1 ? "jogador" : "jogadores"}` : "Nenhum jogador";
}

function sessionDate(value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        const isoDate = new Date(value);
        return Number.isNaN(isoDate.getTime()) ? null : isoDate;
    }
    const match = String(value || "").match(/(\d{1,2})\s+([a-zç]{3})\s*[·-]\s*(\d{1,2})h(\d{2})?/i);
    if (!match) return null;
    const month = campaignMonths.indexOf(match[2].toLowerCase());
    if (month < 0) return null;
    const date = new Date(new Date().getFullYear(), month, Number(match[1]), Number(match[3]), Number(match[4] || 0));
    return Number.isNaN(date.getTime()) ? null : date;
}

function sessionDisplay(value) {
    const date = sessionDate(value);
    if (!date) return value || "Nenhuma sessão agendada";
    const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const minutes = date.getMinutes() ? String(date.getMinutes()).padStart(2, "0") : "";
    return `${weekdays[date.getDay()]}, ${date.getDate()} ${campaignMonths[date.getMonth()]} · ${date.getHours()}h${minutes}`;
}

function upcomingSession(campaign) {
    const sessions = Array.isArray(campaign.sessions)
        ? campaign.sessions
            .filter(session => sessionDate(session.startsAt) && sessionDate(session.startsAt).getTime() > Date.now())
            .sort((a, b) => sessionDate(a.startsAt) - sessionDate(b.startsAt))
        : [];
    if (sessions.length > 0) return sessions[0].startsAt;
    return campaign.nextSession && sessionDate(campaign.nextSession) && sessionDate(campaign.nextSession).getTime() > Date.now()
        ? campaign.nextSession
        : null;
}

function formatUpdatedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Atividade recente";
    const hours = Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60)));
    if (hours < 1) return "Atualizada agora";
    if (hours < 24) return `Atualizada há ${hours} ${hours === 1 ? "hora" : "horas"}`;
    const days = Math.floor(hours / 24);
    return `Atualizada há ${days} ${days === 1 ? "dia" : "dias"}`;
}

function renderFeaturedCampaign(campaign) {
    const cover = document.querySelector("#featured-cover");
    const session = document.querySelector("#featured-session");
    const countdown = document.querySelector("#featured-countdown");
    const title = document.querySelector("#featured-title");
    const meta = document.querySelector("#featured-meta");
    const open = document.querySelector("#featured-open");
    const upcoming = upcomingSession(campaign);
    const nextSession = sessionDisplay(upcoming);
    const parsedSession = sessionDate(upcoming);

    const image = campaignCover(campaign);
    cover.hidden = !image;
    if (image) { cover.src = image; cover.alt = `Imagem da campanha ${campaign.name}`; }
    title.textContent = campaign.name;
    session.textContent = parsedSession ? `Próxima sessão · ${nextSession}` : "Nenhuma sessão agendada";
    countdown.textContent = parsedSession ? "Calculando..." : "Sem data";
    if (parsedSession) countdown.dataset.sessionDate = parsedSession.toISOString();
    else delete countdown.dataset.sessionDate;
    meta.replaceChildren();

    const avatars = document.createElement("span");
    avatars.className = "avatars";
    avatars.setAttribute("aria-hidden", "true");
    for (let index = 0; index < Math.min(campaign.players || 0, 4); index += 1) {
        avatars.append(document.createElement("span"));
    }

    const description = document.createElement("span");
    description.textContent = `Daniel · ${campaign.role === "jogador" ? "Jogador" : "Mestre"} · ${campaignPlayers(campaign.players)} · ${formatUpdatedAt(campaign.updatedAt)}`;
    meta.append(avatars, description);
    open.href = "../campanhas/index.html";
}

function createScheduleRow(campaign) {
    const link = document.createElement("a");
    link.className = "schedule-row";
    link.href = "../campanhas/index.html";

    const date = sessionDate(campaign.nextSession);
    const time = document.createElement("time");
    if (date) {
        time.dateTime = date.toISOString();
        const day = document.createElement("strong");
        day.textContent = date.getDate();
        const month = document.createElement("span");
        month.textContent = campaignMonths[date.getMonth()];
        time.append(day, month);
    } else {
        const day = document.createElement("strong");
        day.textContent = "—";
        const month = document.createElement("span");
        month.textContent = "data";
        time.append(day, month);
    }

    const details = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = campaign.name;
    const session = document.createElement("small");
    session.textContent = sessionDisplay(campaign.nextSession);
    details.append(name, session);

    const status = document.createElement("em");
    const diff = date ? Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000) : null;
    status.textContent = campaign.label || (diff === 0 ? "Hoje" : diff === 1 ? "Amanhã" : "Agendada");
    link.append(time, details, status);
    return link;
}

async function loadCampaignsOnHome() {
    const schedule = document.querySelector("#campaign-schedule");
    const featured = document.querySelector("#featured-campaign");
    if (!campaignRepository || !schedule || !featured) return; // só existe na página inicial
    const empty = document.querySelector("#featured-empty");
    try {
        const campaigns = await campaignRepository.list();

        // Destaque: a campanha com a sessão mais próxima; sem sessões, a mexida mais recentemente
        const live = campaigns.filter(campaign => campaign.status !== "encerrada");
        const withNext = live.map(campaign => ({ campaign, next: upcomingSession(campaign) })).filter(item => item.next)
            .sort((a, b) => sessionDate(a.next) - sessionDate(b.next));
        const activityTime = campaign => new Date(campaign.updatedAt || campaign.createdAt).getTime() || 0;
        const mainCampaign = withNext.length
            ? withNext[0].campaign
            : (live.length ? live : campaigns).slice().sort((a, b) => activityTime(b) - activityTime(a))[0];

        featured.hidden = !mainCampaign;
        empty.hidden = Boolean(mainCampaign);
        if (mainCampaign) renderFeaturedCampaign(mainCampaign);

        // Cronograma: próximas sessões de todas as campanhas (até 4)
        const rows = [];
        live.forEach(campaign => (campaign.sessions || []).forEach(session => {
            const date = sessionDate(session.startsAt);
            if (date && date.getTime() > Date.now()) rows.push({ campaign, session, date });
        }));
        rows.sort((a, b) => a.date - b.date);
        schedule.replaceChildren(...rows.slice(0, 4).map(({ campaign, session }, index) =>
            createScheduleRow({ ...campaign, name: session.title ? `${campaign.name} · ${session.title}` : campaign.name, nextSession: session.startsAt, label: index === 0 ? "Próxima" : null })));
        if (rows.length === 0) {
            const note = document.createElement("p");
            note.className = "schedule-empty";
            note.textContent = campaigns.length ? "Nenhuma sessão agendada. Abra uma campanha e cadastre o cronograma na aba Cronograma." : "Nenhuma sessão agendada. Crie uma campanha para cadastrar o cronograma.";
            schedule.append(note);
        }
        updateSessionCountdown();
    } catch (error) {
        console.error("[Chronicle] Não foi possível carregar as campanhas na página inicial.", error);
        featured.hidden = false;
        featured.classList.add("is-unavailable");
        document.querySelector("#featured-title").textContent = "Campanhas indisponíveis";
    }
}

loadCampaignsOnHome();
window.addEventListener("chronicle:campaigns-changed", loadCampaignsOnHome);
window.addEventListener("storage", loadCampaignsOnHome);

window.addNotification = addNotification;