(function () {
    "use strict";

    const form = document.getElementById("form-config");
    const avatarInput = document.getElementById("avatar-input");
    const avatarPreview = document.getElementById("profile-preview");
    const savedMessage = document.querySelector(".saved");
    const bioCounter = document.getElementById("bio-counter");
    const profileCardName = document.getElementById("profile-card-name");
    const profileCardUsername = document.getElementById("profile-card-username");
    const createdAt = document.getElementById("created-at");
    const accountAge = document.getElementById("account-age-stat");
    const campaignStat = document.getElementById("campaign-stat");
    const friendStat = document.getElementById("friend-stat");
    let profile = null;
    let avatarData = "";

    function setField(name, value) {
        const field = form.elements[name];
        if (field) field.type === "checkbox" ? field.checked = Boolean(value) : field.value = value;
    }

    function getField(name) {
        const field = form.elements[name];
        return field.type === "checkbox" ? field.checked : field.value;
    }

    function setNested(target, path, value) {
        const parts = path.split(".");
        let current = target;
        parts.slice(0, -1).forEach(part => { current[part] = current[part] || {}; current = current[part]; });
        current[parts[parts.length - 1]] = value;
    }

    function readFormSettings() {
        const settings = {};
        Array.from(form.elements).filter(field => field.name && field.name.includes(".")).forEach(field => setNested(settings, field.name, getField(field.name)));
        return {
            motionReduced: getField("motionReduced"),
            notifications: settings.notifications,
            privacy: settings.privacy
        };
    }

    function applyMotionSetting(value) {
        document.documentElement.classList.toggle("sem-movimento", Boolean(value));
    }

    function formatDate(value) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "não disponível" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    }

    function accountAgeLabel(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "—";
        const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
        return days < 30 ? `${days}d` : `${Math.floor(days / 30)}m`;
    }

    function updateProfilePreview() {
        profileCardName.textContent = profile.displayName;
        profileCardUsername.textContent = "@" + profile.username;
        avatarPreview.src = avatarData || profile.avatar;
        createdAt.textContent = formatDate(profile.createdAt);
        accountAge.textContent = accountAgeLabel(profile.createdAt);
    }

    function updateBioCounter() {
        bioCounter.textContent = `${getField("bio").length}/240`;
    }

    async function load() {
        profile = await window.ChronicleAccount.profile.get();
        const settings = await window.ChronicleAccount.settings.get();
        setField("displayName", profile.displayName);
        setField("username", profile.username);
        setField("bio", profile.bio);
        setField("motionReduced", settings.motionReduced);
        Object.entries(settings.notifications).forEach(([name, value]) => setField("notifications." + name, value));
        Object.entries(settings.privacy).forEach(([name, value]) => setField("privacy." + name, value));
        applyMotionSetting(settings.motionReduced);
        updateProfilePreview();
        updateBioCounter();
        const [campaigns, friends] = await Promise.all([
            window.ChronicleData ? window.ChronicleData.campaigns.list() : Promise.resolve([]),
            window.ChronicleFriends ? window.ChronicleFriends.friends.list() : Promise.resolve([])
        ]);
        campaignStat.textContent = campaigns.length;
        friendStat.textContent = friends.length;
    }

    avatarInput.addEventListener("change", () => {
        const file = avatarInput.files[0];
        if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            avatarInput.value = "";
            savedMessage.textContent = "Escolha uma imagem JPG, PNG ou WEBP.";
            return;
        }
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            avatarData = reader.result;
            avatarPreview.src = avatarData;
        });
        reader.readAsDataURL(file);
    });

    form.elements.bio.addEventListener("input", updateBioCounter);

    form.addEventListener("submit", async event => {
        event.preventDefault();
        savedMessage.textContent = "";
        try {
            profile = await window.ChronicleAccount.profile.update({
                displayName: getField("displayName"),
                username: getField("username"),
                bio: getField("bio"),
                avatar: avatarData || profile.avatar
            });
            const settings = await window.ChronicleAccount.settings.update(readFormSettings());
            applyMotionSetting(settings.motionReduced);
            avatarData = "";
            updateProfilePreview();
            savedMessage.textContent = "Alterações salvas.";
        } catch (error) {
            savedMessage.textContent = error.message || "Não foi possível salvar as alterações.";
            console.error("[Chronicle] Falha ao salvar conta.", error);
        }
    });

    window.addEventListener("storage", event => {
        if (event.key === "chronicle_profile" || event.key === "chronicle_account_settings") load();
    });

    load().catch(error => {
        savedMessage.textContent = error.message || "Não foi possível carregar sua conta.";
        console.error("[Chronicle] Falha ao carregar conta.", error);
    });
})();
