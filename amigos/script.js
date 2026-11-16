/* ==========================================================================
   Chronicle · Página de amigos (camada de interface)
   --------------------------------------------------------------------------
   Só interface: modais, validação, linhas, filtros e avisos.
   Persistência fica em data.js (ChronicleFriends.friends), nunca aqui.
   Tudo roda isolado para não colidir com as globais de ../inicio/script.js.
   ========================================================================== */
(function () {
    "use strict";

    const repository = window.ChronicleFriends.friends;
    const { DataError, constants, emailPattern } = window.ChronicleFriends;
    const View = window.ChronicleFriendsView;

    const EMPTY_FILTER_TEXT = "Nada por aqui com esse filtro.";

    /* ---------- Elementos ---------- */

    const $ = id => document.getElementById(id);

    const list = $("friend-list");
    const emptyPanel = $("friends-empty");
    const emptyMessage = document.querySelector(".empty");
    const rowTemplate = $("friend-row-template");
    const tabs = document.querySelectorAll(".tab");
    const searchInput = document.querySelector(".page-search input");

    const addModal = $("friend-modal");
    const form = $("friend-form");
    const formAlert = $("form-alert");
    const submitButton = $("form-submit");
    const fields = { name: $("f-name"), email: $("f-email") };

    const confirmModal = $("confirm-modal");
    const confirmAlert = $("confirm-alert");
    const toastRegion = $("toast-region");

    /* ---------- Estado ---------- */

    const state = { friends: [], filter: "todos", term: "", removingId: null, submitting: false };

    /* ---------- Utilitários ---------- */

    // Minúsculas e sem acentos: "joao" encontra "João"
    const fold = text => String(text || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    const findFriend = id => state.friends.find(item => item.id === id);

    function messageFor(error) {
        if (error instanceof DataError) return error.message;
        console.error(error);
        return "Algo deu errado. Tente novamente.";
    }

    /* ==========================================================================
       Avisos: toast + central de notificações do cabeçalho
       ========================================================================== */

    function showToast(type, title, message) {
        const toast = document.createElement("div");
        toast.className = "toast" + (type === "error" ? " error" : "");
        if (type === "error") toast.setAttribute("role", "alert");

        const text = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = title;
        text.append(strong);
        if (message) {
            const p = document.createElement("p");
            p.textContent = message;
            text.append(p);
        }

        const close = document.createElement("button");
        close.type = "button";
        close.setAttribute("aria-label", "Fechar aviso");
        close.textContent = "×";

        toast.append(text, close);
        toastRegion.append(toast);

        const remove = () => {
            toast.classList.add("leaving");
            setTimeout(() => toast.remove(), 220);
        };
        close.addEventListener("click", remove);
        setTimeout(remove, type === "error" ? 7000 : 4500);
    }

    // addNotification vem de ../inicio/script.js (sino do cabeçalho)
    function notifySuccess(title, message) {
        showToast("success", title, message);
        if (typeof window.addNotification === "function") window.addNotification(title, message);
    }

    /* ==========================================================================
       Modais (<dialog>)
       ========================================================================== */

    function syncScrollLock() {
        document.body.classList.toggle("modal-open", Boolean(document.querySelector("dialog[open]")));
    }

    function openModal(dialog) {
        if (!dialog.open) dialog.showModal();
        syncScrollLock();
    }

    function closeModal(dialog) {
        if (dialog.open) dialog.close();
        syncScrollLock();
    }

    document.querySelectorAll(".modal").forEach(dialog => {
        // Clicar fora fecha, mas só se o clique começou E terminou no fundo
        let pressedOnBackdrop = false;
        dialog.addEventListener("pointerdown", event => { pressedOnBackdrop = event.target === dialog; });
        dialog.addEventListener("click", event => {
            if (event.target === dialog && pressedOnBackdrop) dialog.close();
            pressedOnBackdrop = false;
        });
        dialog.addEventListener("close", syncScrollLock); // cobre também a tecla ESC
    });

    document.addEventListener("click", event => {
        const trigger = event.target.closest("[data-modal-close]");
        if (trigger) closeModal(trigger.closest("dialog"));
    });

    /* ==========================================================================
       Listagem, filtros e busca
       ========================================================================== */

    function matchesFilter(friend) {
        return state.filter === "todos" || friend.status === state.filter;
    }

    function matchesSearch(friend, term) {
        if (!term) return true;
        return fold([friend.name, friend.email, View.subtitle(friend).text].join(" ")).includes(term);
    }

    function visibleFriends() {
        const term = fold(state.term.trim());
        return state.friends.filter(item => matchesFilter(item) && matchesSearch(item, term));
    }

    function buildRow(friend) {
        const row = rowTemplate.content.firstElementChild.cloneNode(true);
        row.dataset.id = friend.id;
        row.dataset.cat = friend.status; // mesmo atributo do filtro original

        const avatar = row.querySelector(".friend-avatar");
        avatar.classList.add(View.avatarClass(friend));
        avatar.textContent = View.initials(friend.name);

        row.querySelector("strong").textContent = friend.name;

        const info = View.subtitle(friend);
        const small = row.querySelector("small");
        small.textContent = info.text;
        if (info.playing) small.classList.add("friend-playing");

        row.querySelector(".friend-status").classList.add(View.dotClass(friend));
        row.querySelector('[data-action="remove"]').setAttribute("aria-label", `Remover ${friend.name} dos amigos`);
        return row;
    }

    function render() {
        const visible = visibleFriends();
        list.replaceChildren(...visible.map(buildRow));

        const noFriendsAtAll = state.friends.length === 0;
        emptyPanel.hidden = !noFriendsAtAll;
        list.hidden = visible.length === 0;
        emptyMessage.textContent = EMPTY_FILTER_TEXT;
        emptyMessage.hidden = noFriendsAtAll || visible.length > 0;
    }

    function setFilter(filter) {
        state.filter = filter;
        tabs.forEach(tab => tab.setAttribute("aria-pressed", String(tab.dataset.filter === filter)));
    }

    tabs.forEach(tab => tab.addEventListener("click", () => {
        setFilter(tab.dataset.filter);
        render();
    }));

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            state.term = searchInput.value;
            render();
        });
    }

    async function loadFriends() {
        try {
            state.friends = await repository.list();
            render();
        } catch (error) {
            emptyPanel.hidden = true;
            list.hidden = true;
            emptyMessage.textContent = "Não foi possível carregar seus amigos.";
            emptyMessage.hidden = false;
            showToast("error", "Erro ao carregar", messageFor(error));
        }
    }

    // Garante que o novo amigo apareça (mesmo com filtro/busca ativos) e o destaca
    function revealFriend(id) {
        const created = findFriend(id);
        if (created && !(matchesFilter(created) && matchesSearch(created, fold(state.term.trim())))) {
            setFilter("todos");
            state.term = "";
            if (searchInput) searchInput.value = "";
        }
        render();
        const row = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
        if (!row) return;
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        row.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "nearest" });
        row.classList.add("friend-new");
        row.addEventListener("animationend", () => row.classList.remove("friend-new"), { once: true });
    }

    /* ==========================================================================
       Formulário: adicionar amigo
       ========================================================================== */

    let visibleErrors = new Set();
    const FIELD_KEYS = ["name", "email"];

    function readForm() {
        return { name: fields.name.value.trim().replace(/\s+/g, " "), email: fields.email.value.trim() };
    }

    function validate(values) {
        const errors = {};
        const { nameMin, nameMax, emailMax } = constants.LIMITS;

        if (!values.name) errors.name = "Informe o nome do seu amigo.";
        else if (values.name.length < nameMin) errors.name = `O nome precisa ter pelo menos ${nameMin} caracteres.`;
        else if (values.name.length > nameMax) errors.name = `O nome pode ter no máximo ${nameMax} caracteres.`;

        // O e-mail é opcional, mas se vier preenchido precisa ser válido
        if (values.email && (values.email.length > emailMax || !emailPattern.test(values.email))) {
            errors.email = "Digite um e-mail válido ou deixe em branco.";
        }
        return errors;
    }

    function setFieldError(key, message) {
        const small = $(`e-${key}`);
        small.textContent = message || "";
        small.hidden = !message;
        if (message) fields[key].setAttribute("aria-invalid", "true");
        else fields[key].removeAttribute("aria-invalid");
        if (message) visibleErrors.add(key);
        else visibleErrors.delete(key);
    }

    function showErrors(errors) {
        FIELD_KEYS.forEach(key => setFieldError(key, errors[key]));
        const first = FIELD_KEYS.find(key => errors[key]);
        if (first) fields[first].focus();
    }

    function clearErrors() {
        FIELD_KEYS.forEach(key => setFieldError(key, ""));
        formAlert.hidden = true;
        formAlert.textContent = "";
    }

    function setSubmitting(isSubmitting) {
        state.submitting = isSubmitting;
        submitButton.disabled = isSubmitting;
        submitButton.textContent = isSubmitting ? "Adicionando…" : "Adicionar";
    }

    function openAddForm() {
        form.reset();
        clearErrors();
        setSubmitting(false);
        openModal(addModal);
    }

    // Revalida só o campo que já estava com erro, conforme a pessoa corrige
    form.addEventListener("input", event => {
        const key = event.target.name;
        if (visibleErrors.has(key)) setFieldError(key, validate(readForm())[key]);
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (state.submitting) return;

        formAlert.hidden = true;
        const values = readForm();
        const errors = validate(values);
        if (Object.keys(errors).length > 0) {
            showErrors(errors);
            return;
        }

        setSubmitting(true);
        try {
            // O avatar é só visual; alterna entre as 3 cores existentes
            const avatar = constants.AVATARS[state.friends.length % constants.AVATARS.length];
            const created = await repository.create({ ...values, avatar });
            state.friends.unshift(created);
            closeModal(addModal);
            revealFriend(created.id);
            notifySuccess("Amigo adicionado", `${created.name} agora faz parte da sua lista de amigos.`);
        } catch (error) {
            formAlert.textContent = messageFor(error);
            formAlert.hidden = false;
        } finally {
            setSubmitting(false);
        }
    });

    /* ==========================================================================
       Remover amizade (com confirmação)
       ========================================================================== */

    function openConfirm(friend) {
        state.removingId = friend.id;
        confirmAlert.hidden = true;
        $("confirm-text").textContent = `${friend.name} deixará de aparecer na sua lista de amigos. Você pode adicionar essa pessoa de novo quando quiser.`;
        openModal(confirmModal);
    }

    $("confirm-remove").addEventListener("click", async event => {
        const button = event.currentTarget;
        const friend = findFriend(state.removingId);
        if (!friend || button.disabled) return;

        button.disabled = true;
        confirmAlert.hidden = true;
        try {
            await repository.remove(friend.id);
            state.friends = state.friends.filter(item => item.id !== friend.id);
            closeModal(confirmModal);
            render();
            notifySuccess("Amizade desfeita", `${friend.name} foi removido da sua lista de amigos.`);
        } catch (error) {
            confirmAlert.textContent = messageFor(error);
            confirmAlert.hidden = false;
            if (error instanceof DataError && error.code === "NOT_FOUND") await loadFriends();
        } finally {
            button.disabled = false;
        }
    });

    /* ---------- Eventos principais ---------- */

    $("add-friend-btn").addEventListener("click", openAddForm);
    document.querySelectorAll("[data-open-add]").forEach(button => button.addEventListener("click", openAddForm));

    list.addEventListener("click", event => {
        const remove = event.target.closest('[data-action="remove"]');
        if (!remove) return;
        const friend = findFriend(remove.closest(".friend-row").dataset.id);
        if (friend) openConfirm(friend);
    });

    // Mantém a lista em dia se ela mudar em outra aba
    window.addEventListener("storage", event => {
        if (event.key === window.ChronicleFriends.storageKey) loadFriends();
    });

    /* ---------- Inicialização ---------- */

    loadFriends();
})();
