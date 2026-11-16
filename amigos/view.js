/* ==========================================================================
   Chronicle · Helpers de apresentação dos amigos
   Compartilhados pela página de amigos e pela página inicial, para que as
   duas mostrem o mesmo texto, avatar e indicador de status.
   Não acessa dados nem altera a página: só transforma um amigo em texto/classes.
   ========================================================================== */
(function (global) {
    "use strict";

    const AVATAR_CLASS = { peach: "avatar-peach", teal: "avatar-teal", lilac: "avatar-lilac" };
    const DOT_CLASS = { online: "online", jogando: "playing", offline: "offline" };
    const DOT_LABEL = { online: "Online", jogando: "Em uma sessão", offline: "Offline" };
    const sinceFormatter = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });

    function initials(name) {
        const parts = String(name || "").trim().split(/\s+/).filter(Boolean).map(part => Array.from(part));
        if (parts.length === 0) return "?";
        const first = parts[0][0];
        const second = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] || "";
        return (first + second).toUpperCase();
    }

    function subtitle(friend) {
        if (friend.status === "online") return { text: "Online agora", playing: false };
        if (friend.status === "jogando") {
            return { text: friend.activity ? "Jogando " + friend.activity : "Em sessão", playing: true };
        }
        const since = new Date(friend.createdAt);
        return {
            text: Number.isNaN(since.getTime()) ? "Offline" : "Amigo desde " + sinceFormatter.format(since),
            playing: false
        };
    }

    global.ChronicleFriendsView = {
        initials,
        subtitle,
        avatarClass: friend => AVATAR_CLASS[friend.avatar] || AVATAR_CLASS.peach,
        dotClass: friend => DOT_CLASS[friend.status] || DOT_CLASS.offline,
        dotLabel: friend => DOT_LABEL[friend.status] || DOT_LABEL.offline
    };
})(window);
