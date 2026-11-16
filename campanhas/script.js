/* ==========================================================================
   Chronicle · Página de campanhas (camada de interface)
   --------------------------------------------------------------------------
   Aqui só existe interface: modais, validação, cards, filtros e avisos.
   Persistência fica em data.js (ChronicleData.campaigns), nunca aqui.

   Tudo roda dentro de uma função isolada para não colidir com as variáveis
   globais de ../inicio/script.js (notifications, markAsRead, etc.).
   ========================================================================== */
(function () {
    "use strict";

    const repository = window.ChronicleData.campaigns;
    const { DataError } = window.ChronicleData;

    /* ---------- Configuração ---------- */

    const ROLE_LABELS = { mestre: "Mestre", jogador: "Jogador" };
    const STATUS_LABELS = { ativa: "Ativa", pausada: "Pausada", encerrada: "Encerrada" };
    const LIMITS = { nameMin: 3, nameMax: 80, systemMin: 2, systemMax: 60, descriptionMax: 500 };
    const EMPTY_FILTER_TEXT = "Nada por aqui com esse filtro.";
    const EMPTY_LIST_TEXT = "Você ainda não tem campanhas. Clique em “Nova campanha” para criar a primeira.";

    /* ---------- Elementos ---------- */

    const $ = id => document.getElementById(id);

    const grid = $("campaign-grid");
    const emptyMessage = document.querySelector(".empty");
    const tabs = document.querySelectorAll(".tabs:not(.details-tabs) .tab");
    const searchInput = document.querySelector(".page-search input") || document.querySelector(".top-header .search input");
    const menuCount = document.querySelector(".menu-count");
    const cardTemplate = $("campaign-card-template");

    const newButton = $("new-campaign-btn");
    const formModal = $("campaign-modal");
    const form = $("campaign-form");
    const formAlert = $("form-alert");
    const submitButton = $("form-submit");
    const fields = {
        name: $("f-name"),
        system: $("f-system"),
        status: $("f-status"),
        description: $("f-description")
    };
    const descriptionCounter = $("description-counter");

    const detailsModal = $("details-modal");
    const confirmModal = $("confirm-modal");
    const confirmAlert = $("confirm-alert");
    const toastRegion = $("toast-region");

    /* ---------- Estado da tela ---------- */

    const state = {
        campaigns: [],
        filter: "todos",
        term: "",
        editingId: null,   // null = criando
        currentId: null,   // campanha aberta nos detalhes / confirmação
        submitting: false
    };

    /* ---------- Utilitários ---------- */

    // Minúsculas e sem acentos: "andromeda" encontra "Andrômeda"
    const fold = text => String(text || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

    const findCampaign = id => state.campaigns.find(item => item.id === id);

    const playersLabel = count => (count > 0 ? `${count} ${count === 1 ? "jogador" : "jogadores"}` : "Nenhum jogador ainda");

    const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" });
    const formatDate = iso => {
        const date = new Date(iso);
        return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
    };

    const isImage = value => typeof value === "string" && value.startsWith("data:image/");

    // Próxima sessão futura (usa o cronograma; helpers vêm de ../inicio/script.js)
    const sessionText = campaign => {
        const next = typeof upcomingSession === "function" ? upcomingSession(campaign) : null;
        return next ? sessionDisplay(next) : null;
    };
    const announceChange = () => window.dispatchEvent(new Event("chronicle:campaigns-changed"));

    function messageFor(error) {
        if (error instanceof DataError) return error.message;
        console.error(error);
        return "Algo deu errado. Tente novamente.";
    }

    /* ==========================================================================
       Avisos: toast na tela + central de notificações do cabeçalho
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

    // Sucesso também vai para o sino de notificações (addNotification vem de ../inicio/script.js)
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
        // Fechar ao clicar fora: só vale se o clique começou E terminou no fundo.
        // (evita fechar ao arrastar para fora na hora de selecionar texto de um campo)
        let pressedOnBackdrop = false;
        dialog.addEventListener("pointerdown", event => { pressedOnBackdrop = event.target === dialog; });
        dialog.addEventListener("click", event => {
            if (event.target === dialog && pressedOnBackdrop) dialog.close();
            pressedOnBackdrop = false;
        });
        dialog.addEventListener("close", syncScrollLock); // também cobre a tecla ESC
    });

    // Botões "×" e "Cancelar"
    document.addEventListener("click", event => {
        const trigger = event.target.closest("[data-modal-close]");
        if (trigger) closeModal(trigger.closest("dialog"));
    });

    /* ==========================================================================
       Listagem, filtros e busca
       ========================================================================== */

    function matchesFilter(campaign) {
        if (state.filter === "todos") return true;
        // A aba "Finalizadas" corresponde ao status "encerrada" (RN04)
        if (state.filter === "finalizada") return campaign.status === "encerrada";
        return campaign.role === state.filter;
    }

    function matchesSearch(campaign, term) {
        if (!term) return true;
        const haystack = fold([
            campaign.name,
            campaign.system,
            campaign.description,
            ROLE_LABELS[campaign.role],
            STATUS_LABELS[campaign.status],
            sessionText(campaign)
        ].join(" "));
        return haystack.includes(term);
    }

    function visibleCampaigns() {
        const term = fold(state.term.trim());
        return state.campaigns.filter(item => matchesFilter(item) && matchesSearch(item, term));
    }

    function buildCard(campaign) {
        const card = cardTemplate.content.firstElementChild.cloneNode(true);
        card.dataset.id = campaign.id;
        card.dataset.cat = campaign.role;       // mesmo atributo usado pelo filtro original
        card.dataset.status = campaign.status;

        const image = card.querySelector("img");
        if (isImage(campaign.cover)) {
            image.src = campaign.cover;
            image.alt = `Imagem da campanha ${campaign.name}`;
            image.hidden = false;
        }

        const role = card.querySelector(".role");
        role.textContent = ROLE_LABELS[campaign.role] || campaign.role;

        const status = card.querySelector(".status");
        status.classList.add(campaign.status);
        status.textContent = STATUS_LABELS[campaign.status] || campaign.status;

        card.querySelector("h2").textContent = campaign.name;
        card.querySelector(".camp-meta").textContent = `${campaign.system} · ${playersLabel(campaign.players)}`;
        card.querySelector(".camp-session").textContent = sessionText(campaign)
            ? `Próxima sessão: ${sessionText(campaign)}`
            : "Nenhuma sessão agendada";

        card.querySelector('[data-action="open"]').setAttribute("aria-label", `Abrir campanha ${campaign.name}`);
        return card;
    }

    function render() {
        const visible = visibleCampaigns();
        grid.replaceChildren(...visible.map(buildCard));

        const noCampaignsAtAll = state.campaigns.length === 0;
        emptyMessage.textContent = noCampaignsAtAll ? EMPTY_LIST_TEXT : EMPTY_FILTER_TEXT;
        emptyMessage.hidden = visible.length > 0;

        if (menuCount) {
            menuCount.textContent = state.campaigns.length;
            menuCount.hidden = false;
        }
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

    async function loadCampaigns() {
        try {
            state.campaigns = await repository.list();
            render();
        } catch (error) {
            emptyMessage.textContent = "Não foi possível carregar suas campanhas.";
            emptyMessage.hidden = false;
            showToast("error", "Erro ao carregar", messageFor(error));
        }
    }

    // Depois de criar, garante que o card apareça (mesmo com filtro/busca ativos) e o destaca
    function revealCampaign(id) {
        const created = findCampaign(id);
        if (created && !(matchesFilter(created) && matchesSearch(created, fold(state.term.trim())))) {
            setFilter("todos");
            state.term = "";
            if (searchInput) searchInput.value = "";
        }
        render();
        const card = grid.querySelector(`[data-id="${CSS.escape(id)}"]`);
        if (!card) return;
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        card.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "nearest" });
        card.classList.add("camp-new");
        card.addEventListener("animationend", () => card.classList.remove("camp-new"), { once: true });
    }

    /* ==========================================================================
       Formulário: criar e editar
       ========================================================================== */

    const errorElement = key => $(`e-${key}`);
    let visibleErrors = new Set();

    function readForm() {
        return {
            name: fields.name.value.trim(),
            system: fields.system.value.trim(),
            status: fields.status.value,
            description: fields.description.value.trim()
        };
    }

    function validate(values) {
        const errors = {};

        if (!values.name) errors.name = "Informe o nome da campanha.";
        else if (values.name.length < LIMITS.nameMin) errors.name = `O nome precisa ter pelo menos ${LIMITS.nameMin} caracteres.`;
        else if (values.name.length > LIMITS.nameMax) errors.name = `O nome pode ter no máximo ${LIMITS.nameMax} caracteres.`;

        if (!values.system) errors.system = "Informe o sistema de RPG utilizado.";
        else if (values.system.length < LIMITS.systemMin) errors.system = `O sistema precisa ter pelo menos ${LIMITS.systemMin} caracteres.`;
        else if (values.system.length > LIMITS.systemMax) errors.system = `O sistema pode ter no máximo ${LIMITS.systemMax} caracteres.`;

        // A descrição é opcional. Para torná-la obrigatória, descomente:
        // if (!values.description) errors.description = "Escreva uma breve descrição da campanha.";
        if (values.description.length > LIMITS.descriptionMax) errors.description = `A descrição pode ter no máximo ${LIMITS.descriptionMax} caracteres.`;

        return errors;
    }

    function controlFor(key) {
        return fields[key];
    }

    function setFieldError(key, message) {
        const small = errorElement(key);
        const control = controlFor(key);
        small.textContent = message || "";
        small.hidden = !message;

        control.setAttribute("aria-invalid", String(Boolean(message)));
        if (!message) control.removeAttribute("aria-invalid");

        if (message) visibleErrors.add(key);
        else visibleErrors.delete(key);
    }

    function showErrors(errors) {
        ["name", "system", "description"].forEach(key => setFieldError(key, errors[key]));
        const firstKey = ["name", "system", "description"].find(key => errors[key]);
        if (firstKey) fields[firstKey].focus();
    }

    function clearErrors() {
        ["name", "system", "description"].forEach(key => setFieldError(key, ""));
        formAlert.hidden = true;
        formAlert.textContent = "";
    }

    function updateCounter() {
        descriptionCounter.textContent = `${fields.description.value.length}/${LIMITS.descriptionMax}`;
    }

    function setSubmitting(isSubmitting) {
        state.submitting = isSubmitting;
        submitButton.disabled = isSubmitting;
        if (isSubmitting) submitButton.textContent = "Salvando…";
        else submitButton.textContent = state.editingId ? "Salvar alterações" : "Criar campanha";
    }

    function prepareForm(campaign) {
        form.reset();
        clearErrors();
        state.editingId = campaign ? campaign.id : null;

        $("campaign-modal-title").textContent = campaign ? "Editar campanha" : "Nova campanha";
        $("campaign-modal-sub").textContent = campaign
            ? "Atualize as informações da sua mesa."
            : "Dê um nome à sua mesa e escolha o sistema.";

        if (campaign) {
            fields.name.value = campaign.name;
            fields.system.value = campaign.system;
            fields.status.value = campaign.status;
            fields.description.value = campaign.description || "";
        }
        media.banner = campaign && isImage(campaign.banner) ? campaign.banner : null;
        media.cover = campaign && isImage(campaign.cover) ? campaign.cover : null;
        paintMedia();
        updateCounter();
        setSubmitting(false);
    }

    /* ---------- Imagens (tela inicial e card) com mini editor ---------- */

    const MEDIA_SPEC = {
        banner: { aspect: [5, 2], width: 1920, label: "Imagem da tela inicial" },
        cover: { aspect: [16, 9], width: 960, label: "Imagem do card" }
    };
    const media = { banner: null, cover: null };
    const mediaInput = $("media-input");
    let mediaTarget = null;

    function paintMedia() {
        form.querySelectorAll("[data-media]").forEach(button => {
            const value = media[button.dataset.media];
            const img = button.querySelector("img");
            img.hidden = !value;
            if (value) img.src = value;
            button.querySelector(".media-empty").hidden = Boolean(value);
        });
        form.querySelectorAll("[data-media-remove]").forEach(button => { button.hidden = !media[button.dataset.mediaRemove]; });
    }

    form.addEventListener("click", event => {
        const pick = event.target.closest("[data-media]");
        if (pick) { mediaTarget = pick.dataset.media; mediaInput.value = ""; mediaInput.click(); return; }
        const remove = event.target.closest("[data-media-remove]");
        if (remove) { media[remove.dataset.mediaRemove] = null; paintMedia(); }
    });

    mediaInput.addEventListener("change", async () => {
        const file = mediaInput.files[0];
        const key = mediaTarget;
        if (!file || !key) return;
        try {
            const result = await window.ChronicleImageEditor.edit(file, MEDIA_SPEC[key]);
            if (result) { media[key] = result; paintMedia(); }
        } catch (error) {
            showToast("error", "Imagem não aplicada", error.message);
        }
    });

    function openCreateForm() {
        prepareForm(null);
        openModal(formModal);
    }

    function openEditForm(campaign) {
        prepareForm(campaign);
        openModal(formModal);
    }

    // Revalida só o campo que já estava com erro, conforme a pessoa corrige
    form.addEventListener("input", event => {
        if (event.target === fields.description) updateCounter();
        const key = event.target.name;
        if (visibleErrors.has(key)) setFieldError(key, validate(readForm())[key]);
    });
    form.addEventListener("change", event => {
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

        const editing = state.editingId !== null;
        setSubmitting(true);
        try {
            if (editing) {
                const updated = await repository.update(state.editingId, { ...values, cover: media.cover, banner: media.banner });
                state.campaigns = state.campaigns.map(item => (item.id === updated.id ? updated : item));
                closeModal(formModal);
                render();
                announceChange();
                notifySuccess("Campanha atualizada", `As alterações em “${updated.name}” foram salvas.`);
            } else {
                // Só o mestre cria campanhas, então quem cria é sempre o mestre.
                const created = await repository.create({ ...values, role: "mestre", cover: media.cover, banner: media.banner });
                state.campaigns.unshift(created);
                closeModal(formModal);
                revealCampaign(created.id);
                announceChange();
                notifySuccess("Campanha criada", `“${created.name}” já está na sua lista.`);
            }
        } catch (error) {
            formAlert.textContent = messageFor(error);
            formAlert.hidden = false;
            if (error instanceof DataError && error.code === "NOT_FOUND") await loadCampaigns();
        } finally {
            setSubmitting(false);
        }
    });

    /* ==========================================================================
       Detalhes e exclusão
       ========================================================================== */

    function openDetails(campaign) {
        state.currentId = campaign.id;

        const cover = $("details-cover");
        cover.hidden = !isImage(campaign.cover);
        if (!cover.hidden) { cover.src = campaign.cover; cover.alt = `Imagem da campanha ${campaign.name}`; }
        $("details-role").textContent = ROLE_LABELS[campaign.role] || campaign.role;

        const status = $("details-status");
        status.className = `status ${campaign.status}`;
        status.textContent = STATUS_LABELS[campaign.status] || campaign.status;

        $("details-title").textContent = campaign.name;
        $("details-system").textContent = campaign.system;
        $("details-players").textContent = playersLabel(campaign.players);
        $("details-session").textContent = sessionText(campaign) || "Nenhuma sessão agendada";
        $("details-created").textContent = formatDate(campaign.createdAt);
        $("details-updated").textContent = formatDate(campaign.updatedAt);

        const description = $("details-description");
        description.textContent = campaign.description || "Sem descrição.";
        description.classList.toggle("is-empty", !campaign.description);

        setDetailsTab("geral");
        renderSessions(campaign);
        openModal(detailsModal);
    }

    /* ---------- Cronograma de sessões (aba dentro dos detalhes) ---------- */

    const sessionForm = $("session-form");
    const sessionError = $("e-session");
    const sessionList = $("details-sessions");
    const sessionFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

    function setDetailsTab(name) {
        detailsModal.querySelectorAll("[data-details-tab]").forEach(tab => tab.setAttribute("aria-pressed", String(tab.dataset.detailsTab === name)));
        $("details-panel-geral").hidden = name !== "geral";
        $("details-panel-cronograma").hidden = name !== "cronograma";
    }

    function renderSessions(campaign) {
        const sessions = (campaign.sessions || []).slice().sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
        const isMaster = campaign.role === "mestre";
        sessionForm.hidden = !isMaster; // só o mestre cadastra o cronograma
        $("details-sessions-empty").hidden = sessions.length > 0;
        sessionError.hidden = true;

        sessionList.replaceChildren(...sessions.map(session => {
            const date = new Date(session.startsAt);
            const past = date.getTime() < Date.now();
            const item = document.createElement("li");
            item.className = "session-item" + (past ? " is-past" : "");

            const info = document.createElement("span");
            const when = document.createElement("strong");
            when.textContent = sessionFormatter.format(date).replace(/\.$/, "").replace(" às ", " · ");
            const note = document.createElement("small");
            note.textContent = (session.title || "Sem título") + (past ? " · já aconteceu" : "");
            info.append(when, note);
            item.append(info);

            if (isMaster) {
                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "session-remove";
                remove.dataset.sessionDel = session.id;
                remove.setAttribute("aria-label", "Remover sessão");
                remove.textContent = "×";
                item.append(remove);
            }
            return item;
        }));
    }

    async function saveSessions(campaign, sessions, title, message) {
        try {
            const updated = await repository.update(campaign.id, { sessions });
            state.campaigns = state.campaigns.map(item => (item.id === updated.id ? updated : item));
            renderSessions(updated);
            render();
            announceChange();
            if (title) notifySuccess(title, message);
        } catch (error) {
            sessionError.textContent = messageFor(error);
            sessionError.hidden = false;
        }
    }

    detailsModal.addEventListener("click", event => {
        const tab = event.target.closest("[data-details-tab]");
        if (tab) { setDetailsTab(tab.dataset.detailsTab); return; }
        const del = event.target.closest("[data-session-del]");
        const campaign = del && findCampaign(state.currentId);
        if (campaign) saveSessions(campaign, (campaign.sessions || []).filter(item => item.id !== del.dataset.sessionDel));
    });

    sessionForm.addEventListener("submit", event => {
        event.preventDefault();
        const campaign = findCampaign(state.currentId);
        if (!campaign) return;
        const date = $("s-date").value, time = $("s-time").value;
        const startsAt = date && time ? new Date(`${date}T${time}`) : null;
        let problem = "";
        if (!startsAt) problem = "Informe a data e o horário da sessão.";
        else if (startsAt.getTime() <= Date.now()) problem = "A sessão precisa ser em um horário futuro.";
        sessionError.textContent = problem;
        sessionError.hidden = !problem;
        if (problem) return;

        const sessions = [...(campaign.sessions || []), { id: crypto.randomUUID ? crypto.randomUUID() : "s-" + Date.now(), startsAt: startsAt.toISOString(), title: $("s-title").value.trim() }];
        saveSessions(campaign, sessions, "Sessão agendada", `${campaign.name}: os jogadores serão avisados 1 dia antes e no dia.`);
        sessionForm.reset();
    });

    function openConfirm(campaign) {
        state.currentId = campaign.id;
        confirmAlert.hidden = true;
        $("confirm-text").textContent = `“${campaign.name}” será removida da sua lista. Essa ação não pode ser desfeita.`;
        openModal(confirmModal);
    }

    detailsModal.addEventListener("click", event => {
        const action = event.target.closest("[data-action]");
        const campaign = action && findCampaign(state.currentId);
        if (!campaign) return;
        closeModal(detailsModal);
        if (action.dataset.action === "edit") openEditForm(campaign);
        if (action.dataset.action === "delete") openConfirm(campaign);
    });

    $("confirm-delete").addEventListener("click", async event => {
        const button = event.currentTarget;
        const campaign = findCampaign(state.currentId);
        if (!campaign || button.disabled) return;

        button.disabled = true;
        confirmAlert.hidden = true;
        try {
            await repository.remove(campaign.id);
            state.campaigns = state.campaigns.filter(item => item.id !== campaign.id);
            closeModal(confirmModal);
            render();
            announceChange();
            notifySuccess("Campanha excluída", `“${campaign.name}” foi removida.`);
        } catch (error) {
            confirmAlert.textContent = messageFor(error);
            confirmAlert.hidden = false;
            if (error instanceof DataError && error.code === "NOT_FOUND") await loadCampaigns();
        } finally {
            button.disabled = false;
        }
    });

    /* ---------- Eventos principais ---------- */

    newButton.addEventListener("click", openCreateForm);
    if (new URLSearchParams(location.search).has("nova")) {
        history.replaceState(null, "", location.pathname); // o botão "Nova campanha" do Início chega aqui
        openCreateForm();
    }

    grid.addEventListener("click", event => {
        const open = event.target.closest('[data-action="open"]');
        if (!open) return;
        const campaign = findCampaign(open.closest(".camp").dataset.id);
        if (campaign) openDetails(campaign);
    });

    /* ---------- Inicialização ---------- */

    loadCampaigns();
})();
