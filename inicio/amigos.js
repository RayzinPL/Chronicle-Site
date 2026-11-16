/* ==========================================================================
   Chronicle · Início: bloco "Seus amigos"
   Lê a mesma lista da página de amigos (ChronicleFriends) e a mantém sincronizada.
   Sem amigos, mostra um convite em vez de uma lista vazia.
   ========================================================================== */
(function () {
    "use strict";

    const container = document.getElementById("home-friends");
    if (!container || !window.ChronicleFriends || !window.ChronicleFriendsView) return;

    const View = window.ChronicleFriendsView;
    const MAX_VISIBLE = 3;
    const FRIENDS_PAGE = "../amigos/index.html";
    const EMPTY_TEXT = "Toda boa história começa com boas amizades! Convide sua mesa! 💫";

    function buildFriend(friend) {
        const link = document.createElement("a");
        link.className = "friend";
        link.href = FRIENDS_PAGE;

        const avatar = document.createElement("span");
        avatar.className = `friend-avatar ${View.avatarClass(friend)}`;
        avatar.textContent = View.initials(friend.name);

        const info = document.createElement("span");
        const name = document.createElement("strong");
        name.textContent = friend.name;
        const small = document.createElement("small");
        const subtitle = View.subtitle(friend);
        small.textContent = subtitle.text;
        if (subtitle.playing) small.className = "friend-playing";
        info.append(name, small);

        const dot = document.createElement("span");
        dot.className = `friend-status ${View.dotClass(friend)}`;
        dot.setAttribute("aria-label", View.dotLabel(friend));

        link.append(avatar, info, dot);
        return link;
    }

    function buildLink(text) {
        const link = document.createElement("a");
        link.className = "link";
        link.href = FRIENDS_PAGE;
        link.textContent = text;
        return link;
    }

    function buildEmpty() {
        const box = document.createElement("div");
        box.className = "friends-empty";
        const message = document.createElement("p");
        message.textContent = EMPTY_TEXT;
        box.append(message, buildLink("Adicionar amigos →"));
        return box;
    }

    async function render() {
        let friends = [];
        try {
            friends = await window.ChronicleFriends.friends.list();
        } catch (error) {
            console.error(error);
        }

        if (friends.length === 0) {
            container.replaceChildren(buildEmpty());
            return;
        }

        const items = friends.slice(0, MAX_VISIBLE).map(buildFriend);
        if (friends.length > MAX_VISIBLE) items.push(buildLink(`Ver todos os ${friends.length} amigos →`));
        container.replaceChildren(...items);
    }

    // Alterações feitas em outra aba
    window.addEventListener("storage", event => {
        if (event.key === window.ChronicleFriends.storageKey) render();
    });
    // Voltar com o botão do navegador pode restaurar a página do cache (desatualizada)
    window.addEventListener("pageshow", event => {
        if (event.persisted) render();
    });

    render();
})();
