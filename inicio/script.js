
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
        const daysUntilSession = Math.ceil(
            (sessionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        element.textContent = daysUntilSession > 1
            ? `Faltam ${daysUntilSession} dias`
            : daysUntilSession === 1
                ? "Falta 1 dia"
                : "Sessão hoje";
    });
}

updateSessionCountdown();

window.addNotification = addNotification;