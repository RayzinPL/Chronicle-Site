/* ==========================================================================
   Chronicle · Mini editor de imagem
   --------------------------------------------------------------------------
   ChronicleImageEditor.edit(file, { aspect: [5, 2], width: 1920, label })
     -> Promise<string|null>  (data URL JPEG já no tamanho final, ou null se cancelar)

   - Moldura com proporção FIXA: a imagem final nunca sai esticada.
   - Arrastar = posicionar · slider/roda do mouse = zoom · botão = girar 90°.
   - O zoom mínimo preenche a moldura (sem bordas vazias); a exportação usa
     a resolução final (ex.: 1920×768), então fica nítida em tela HD.
   ========================================================================== */
(function (global) {
    "use strict";

    const MAX_FILE = 15 * 1024 * 1024;
    const MAX_SIDE = 3600; // reduz fotos gigantes para não estourar a memória
    let dialog, canvas, ctx, zoomInput, hint, titleEl, applyBtn;
    let job = null; // { src, aspect, outW, outH, z, cx, cy, resolve, pw, ph }

    function build() {
        dialog = document.createElement("dialog");
        dialog.className = "modal modal-editor";
        dialog.setAttribute("aria-labelledby", "editor-title");
        dialog.innerHTML = `
            <div class="modal-box">
                <header class="modal-head">
                    <div><h2 id="editor-title">Ajustar imagem</h2><p class="modal-sub" id="editor-hint"></p></div>
                    <button type="button" class="modal-close" data-editor-cancel aria-label="Fechar">&times;</button>
                </header>
                <div class="modal-body">
                    <div class="editor-stage"><canvas id="editor-canvas" aria-label="Pré-visualização. Arraste para posicionar."></canvas></div>
                    <div class="editor-tools">
                        <label class="editor-zoom">Zoom
                            <input type="range" id="editor-zoom" min="1" max="4" step="0.01" value="1" aria-label="Zoom">
                        </label>
                        <button type="button" class="btn btn-outline" data-editor-rotate>Girar 90°</button>
                        <button type="button" class="btn btn-outline" data-editor-reset>Redefinir</button>
                    </div>
                </div>
                <footer class="modal-actions">
                    <button type="button" class="btn btn-outline" data-editor-cancel>Cancelar</button>
                    <button type="button" class="btn btn-primary" data-editor-apply>Usar imagem</button>
                </footer>
            </div>`;
        document.body.append(dialog);
        canvas = dialog.querySelector("#editor-canvas");
        ctx = canvas.getContext("2d");
        zoomInput = dialog.querySelector("#editor-zoom");
        hint = dialog.querySelector("#editor-hint");
        titleEl = dialog.querySelector("#editor-title");
        applyBtn = dialog.querySelector("[data-editor-apply]");

        zoomInput.addEventListener("input", () => { job.z = Number(zoomInput.value); clamp(); draw(); });
        dialog.querySelector("[data-editor-rotate]").addEventListener("click", rotate);
        dialog.querySelector("[data-editor-reset]").addEventListener("click", () => reset());
        dialog.querySelectorAll("[data-editor-cancel]").forEach(b => b.addEventListener("click", () => finish(null)));
        applyBtn.addEventListener("click", () => finish(exportImage()));
        dialog.addEventListener("cancel", event => { event.preventDefault(); finish(null); }); // ESC

        canvas.addEventListener("wheel", event => {
            event.preventDefault();
            setZoom(job.z * (event.deltaY < 0 ? 1.08 : 1 / 1.08));
        }, { passive: false });

        let drag = null;
        canvas.addEventListener("pointerdown", event => {
            canvas.setPointerCapture(event.pointerId);
            drag = { x: event.clientX, y: event.clientY, cx: job.cx, cy: job.cy };
            canvas.classList.add("is-dragging");
        });
        canvas.addEventListener("pointermove", event => {
            if (!drag) return;
            const scale = currentScale();
            job.cx = drag.cx - (event.clientX - drag.x) * (canvas.width / canvas.clientWidth) / scale;
            job.cy = drag.cy - (event.clientY - drag.y) * (canvas.height / canvas.clientHeight) / scale;
            clamp(); draw();
        });
        const stop = () => { drag = null; canvas.classList.remove("is-dragging"); };
        canvas.addEventListener("pointerup", stop);
        canvas.addEventListener("pointercancel", stop);
        canvas.addEventListener("keydown", event => {
            const step = 30 / currentScale();
            const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
            if (!moves[event.key]) return;
            event.preventDefault();
            job.cx += moves[event.key][0]; job.cy += moves[event.key][1];
            clamp(); draw();
        });
        canvas.tabIndex = 0;
    }

    const baseScale = () => Math.max(job.pw / job.src.width, job.ph / job.src.height);
    const currentScale = () => baseScale() * job.z;

    function clamp() {
        const scale = currentScale();
        const halfW = job.pw / 2 / scale, halfH = job.ph / 2 / scale;
        job.cx = Math.min(Math.max(job.cx, halfW), job.src.width - halfW);
        job.cy = Math.min(Math.max(job.cy, halfH), job.src.height - halfH);
    }

    function setZoom(value) {
        job.z = Math.min(4, Math.max(1, value));
        zoomInput.value = job.z;
        clamp(); draw();
    }

    function reset() {
        job.z = 1; zoomInput.value = 1;
        job.cx = job.src.width / 2; job.cy = job.src.height / 2;
        clamp(); draw();
    }

    function rotate() {
        const { src } = job;
        const turned = document.createElement("canvas");
        turned.width = src.height; turned.height = src.width;
        const c = turned.getContext("2d");
        c.translate(turned.width, 0); c.rotate(Math.PI / 2); c.drawImage(src, 0, 0);
        job.src = turned;
        reset();
    }

    function paint(target, width, height) {
        const c = target.getContext("2d");
        const k = width / job.pw;
        const scale = currentScale() * k;
        c.fillStyle = "#0B0C14";
        c.fillRect(0, 0, width, height);
        c.imageSmoothingQuality = "high";
        c.drawImage(job.src, width / 2 - job.cx * scale, height / 2 - job.cy * scale, job.src.width * scale, job.src.height * scale);
    }

    function draw() { paint(canvas, canvas.width, canvas.height); }

    function exportImage() {
        const out = document.createElement("canvas");
        out.width = job.outW; out.height = job.outH;
        paint(out, out.width, out.height);
        return out.toDataURL("image/jpeg", 0.85);
    }

    function finish(result) {
        if (!job) return;
        const { resolve } = job;
        job = null;
        if (dialog.open) dialog.close();
        document.body.classList.toggle("modal-open", Boolean(document.querySelector("dialog[open]")));
        resolve(result);
    }

    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
                const src = document.createElement("canvas");
                src.width = Math.round(img.naturalWidth * k); src.height = Math.round(img.naturalHeight * k);
                src.getContext("2d").drawImage(img, 0, 0, src.width, src.height);
                URL.revokeObjectURL(url);
                resolve(src);
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível abrir essa imagem.")); };
            img.src = url;
        });
    }

    async function edit(file, { aspect = [16, 9], width = 1280, label = "Ajustar imagem" } = {}) {
        if (!file || !/^image\/(png|jpe?g|webp|gif|avif)$/i.test(file.type)) throw new Error("Escolha uma imagem PNG, JPG ou WebP.");
        if (file.size > MAX_FILE) throw new Error("A imagem é grande demais (máximo de 15 MB).");
        const src = await loadImage(file);
        if (!dialog) build();

        const outW = width, outH = Math.round(width * aspect[1] / aspect[0]);
        const pw = 720, ph = Math.round(pw * aspect[1] / aspect[0]);
        canvas.width = pw; canvas.height = ph;
        canvas.style.aspectRatio = `${aspect[0]} / ${aspect[1]}`;
        titleEl.textContent = label;
        const small = src.width < outW * 0.6 || src.height < outH * 0.6;
        hint.textContent = `Arraste para posicionar e use o zoom. Saída final: ${outW}×${outH} px.` + (small ? " Esta imagem é pequena e pode ficar com pouca nitidez." : "");

        return new Promise(resolve => {
            job = { src, aspect, outW, outH, pw, ph, z: 1, cx: 0, cy: 0, resolve };
            reset();
            dialog.showModal();
            document.body.classList.add("modal-open");
            applyBtn.focus();
        });
    }

    global.ChronicleImageEditor = { edit };
})(window);
