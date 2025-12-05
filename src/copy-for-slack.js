(function () {
    'use strict';

    // --- SÉLECTEURS ---
    const HEADER_ACTIONS_SELECTOR = '.js-issuable-actions';
    const TITLE_SELECTOR = 'h1.title';
    const URL_META_SELECTOR = 'meta[property="og:url"]';

    // Bouton dropdown pour sélectionner le label (ex: ADDED, FIXED...)
    const PREFIX_PARENT_SELECTOR = 'span[data-testid="selected-label-content"]';

    // --- LOGO SLACK (SVG) ---
    // J'ai forcé width="16" height="16" et ajouté le style margin-right
    // --- LOGO SLACK (SVG) ---
    function createSlackIcon() {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 2447.6 2452.5");
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        svg.style.verticalAlign = "text-bottom";
        svg.style.marginRight = "8px";

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("clip-rule", "evenodd");
        g.setAttribute("fill-rule", "evenodd");

        const paths = [
            { d: "m897.4 0c-135.3.1-244.8 109.9-244.7 245.2-.1 135.3 109.5 245.1 244.8 245.2h244.8v-245.1c.1-135.3-109.5-245.1-244.9-245.3.1 0 .1 0 0 0m0 654h-652.6c-135.3.1-244.9 109.9-244.8 245.2-.2 135.3 109.4 245.1 244.7 245.3h652.7c135.3-.1 244.9-109.9 244.8-245.2.1-135.4-109.5-245.2-244.8-245.3z", fill: "#36c5f0" },
            { d: "m2447.6 899.2c.1-135.3-109.5-245.1-244.8-245.2-135.3.1-244.9 109.9-244.8 245.2v245.3h244.8c135.3-.1 244.9-109.9 244.8-245.3zm-652.7 0v-654c.1-135.2-109.4-245-244.7-245.2-135.3.1-244.9 109.9-244.8 245.2v654c-.2 135.3 109.4 245.1 244.7 245.3 135.3-.1 244.9-109.9 244.8-245.3z", fill: "#2eb67d" },
            { d: "m1550.1 2452.5c135.3-.1 244.9-109.9 244.8-245.2.1-135.3-109.5-245.1-244.8-245.2h-244.8v245.2c-.1 135.2 109.5 245 244.8 245.2zm0-654.1h652.7c135.3-.1 244.9-109.9 244.8-245.2.2-135.3-109.4-245.1-244.7-245.3h-652.7c-135.3.1-244.9 109.9-244.8 245.2-.1 135.4 109.4 245.2 244.7 245.3z", fill: "#ecb22e" },
            { d: "m0 1553.2c-.1 135.3 109.5 245.1 244.8 245.2 135.3-.1 244.9-109.9 244.8-245.2v-245.2h-244.8c-135.3.1-244.9 109.9-244.8 245.2zm652.7 0v654c-.2 135.3 109.4 245.1 244.7 245.3 135.3-.1 244.9-109.9 244.8-245.2v-653.9c.2-135.3-109.4-245.1-244.7-245.3-135.4 0-244.9 109.8-244.8 245.1 0 0 0 .1 0 0", fill: "#e01e5a" }
        ];

        paths.forEach(p => {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", p.d);
            path.setAttribute("fill", p.fill);
            g.appendChild(path);
        });

        svg.appendChild(g);
        return svg;
    }

    const LOCAL_STORAGE_KEY = 'mr-copy-mentions-history';

    // --- FONCTION DE COPIE ---
    function copyHtmlToClipboard(element) {
        const container = document.createElement('div');
        container.appendChild(element);

        container.style.position = 'fixed';
        container.style.pointerEvents = 'none';
        container.style.opacity = 0;
        container.style.background = 'white';
        container.style.color = 'black';

        document.body.appendChild(container);

        window.getSelection().removeAllRanges();
        const range = document.createRange();
        range.selectNode(container);
        window.getSelection().addRange(range);

        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Erreur copie :', err);
            alert('Erreur de copie. Vérifiez les permissions.');
        }

        window.getSelection().removeAllRanges();
        document.body.removeChild(container);
    }

    /**
     * Récupère le préfixe sélectionné dans le dropdown GitLab (ex: ADDED, FIXED).
     * @returns {string} Le préfixe entre crochets "[ADDED]" (par défaut "ADDED").
     */
    function getPrefix() {
        const prefixSpan = document.querySelector(PREFIX_PARENT_SELECTOR);
        let prefixVal = "ADDED";
        if (prefixSpan) {
            const currentLabel = prefixSpan.innerText.trim();
            // Ignore les placeholders par défaut
            if (currentLabel !== "Select label" && currentLabel !== "Label" && currentLabel !== "") {
                prefixVal = currentLabel;
            }
        }
        return `[${prefixVal}]`;
    }

    function getMRDataHTML(mentionTarget) {
        const titleEl = document.querySelector(TITLE_SELECTOR);
        const titleText = titleEl ? titleEl.textContent.trim() : "Titre inconnu";
        const project = document.body.dataset.project || "projet-inconnu";

        const urlMeta = document.querySelector(URL_META_SELECTOR);
        const url = urlMeta ? urlMeta.content : window.location.href;

        const prefix = getPrefix();

        const wrapper = document.createElement('div');
        wrapper.style.fontFamily = 'sans-serif';

        wrapper.appendChild(document.createTextNode('MR: '));

        if (mentionTarget && mentionTarget.trim() !== "") {
            const cleanTarget = mentionTarget.trim().replace(/^@/, '');
            const strong = document.createElement('strong');
            strong.textContent = '@' + cleanTarget;
            wrapper.appendChild(strong);
            wrapper.appendChild(document.createTextNode(' '));
        }

        wrapper.appendChild(document.createTextNode(prefix + titleText + ' '));

        const code = document.createElement('code');
        code.style.background = '#eee';
        code.style.padding = '2px 4px';
        code.style.borderRadius = '3px';
        code.textContent = project;
        wrapper.appendChild(code);

        wrapper.appendChild(document.createElement('br'));

        const link = document.createElement('a');
        link.href = url;
        link.textContent = url;
        wrapper.appendChild(link);

        return wrapper;
    }

    // --- GESTION HISTORIQUE MENTIONS ---
    function getMentions() {
        try {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Erreur lecture localStorage', e);
            return [];
        }
    }

    function saveMention(mention) {
        if (!mention || !mention.trim()) return;
        const cleanMention = mention.trim();
        let mentions = getMentions();

        // Supprimer si existe déjà pour le remettre en premier
        mentions = mentions.filter(m => m !== cleanMention);
        mentions.unshift(cleanMention);

        // Limiter à 5
        if (mentions.length > 5) {
            mentions = mentions.slice(0, 5);
        }

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mentions));
        renderMentionList();
    }

    function renderMentionList() {
        const listContainer = document.getElementById('mr-copy-mention-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        const mentions = getMentions();

        if (mentions.length === 0) {
            // On cache si vide
            return;
        }

        mentions.forEach((m, index) => {
            const item = document.createElement('div');
            item.textContent = m;
            item.style.padding = '6px 10px';
            item.style.cursor = 'pointer';
            item.style.fontSize = '13px';
            // item.className = 'gl-bg-subtle';
            item.style.background = 'var(--gl-button-default-primary-background-color-default)';

            if (index < mentions.length - 1) {
                item.style.borderBottom = '1px solid #444'; // Dark mode separator
            }

            // Hover effect
            item.onmouseenter = () => item.style.background = 'var(--gl-button-default-primary-background-color-hover)';
            item.onmouseleave = () => item.style.background = 'var(--gl-button-default-primary-background-color-default)';

            // Empêcher la perte de focus de l'input lors du clic
            item.onmousedown = (e) => {
                e.preventDefault();
            };

            item.onclick = () => {
                const input = document.getElementById('mr-copy-mention-input');
                if (input) {
                    input.value = m;
                    // On ferme la liste après sélection
                    listContainer.style.display = 'none';
                }
            };

            listContainer.appendChild(item);
        });
    }

    function handleCopy() {
        const inputEl = document.getElementById('mr-copy-mention-input');
        const mentionTarget = inputEl ? inputEl.value : "";

        const htmlMessage = getMRDataHTML(mentionTarget);
        copyHtmlToClipboard(htmlMessage);

        if (mentionTarget) {
            saveMention(mentionTarget);
        }

        const btn = document.getElementById('mr-copy-msg-btn');
        if (btn) {
            // Animation de succès
            btn.textContent = '✅ Copié !';
            btn.classList.remove('btn-default');
            btn.classList.add('btn-confirm'); // Vert/Bleu

            setTimeout(() => {
                // Retour à l'état initial avec l'icône
                btn.textContent = '';
                btn.appendChild(createSlackIcon());
                btn.appendChild(document.createTextNode('Copier'));

                btn.classList.remove('btn-confirm');
                btn.classList.add('btn-default');
            }, 2000);
        }
    }

    function addInterface() {
        if (document.getElementById('mr-copy-wrapper')) return;

        const container = document.querySelector(HEADER_ACTIONS_SELECTOR);
        if (!container) return;

        // 1. Wrapper pour les boutons existants (Edit, Code)
        // On les déplace pour pouvoir gérer le layout en colonne
        const buttonsWrapper = document.createElement('div');
        buttonsWrapper.className = 'gl-flex gl-flex-row gl-gap-3 gl-items-center';

        // Déplacer tous les enfants existants dans ce wrapper
        while (container.firstChild) {
            buttonsWrapper.appendChild(container.firstChild);
        }

        // 2. Modifier le conteneur principal (colonne, aligné droite)
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'flex-end';

        // Réinsérer les boutons
        container.appendChild(buttonsWrapper);

        // 3. Créer le widget de copie
        const mainWrapper = document.createElement('div');
        mainWrapper.id = 'mr-copy-wrapper';
        mainWrapper.style.display = 'flex';
        mainWrapper.style.justifyContent = 'flex-end';
        mainWrapper.style.marginTop = '8px';

        // LIGNE INPUT + BOUTON
        const inputRow = document.createElement('div');
        inputRow.className = 'gl-flex gl-items-center';
        inputRow.style.gap = '5px';
        inputRow.style.justifyContent = 'flex-end';

        // Wrapper relatif pour l'input et la liste déroulante
        const inputWrapper = document.createElement('div');
        inputWrapper.style.position = 'relative';
        inputWrapper.style.display = 'flex';
        inputWrapper.style.flexDirection = 'column';

        const input = document.createElement('input');
        input.id = 'mr-copy-mention-input';
        input.type = 'text';
        input.placeholder = '@who?';
        input.className = 'form-control gl-form-input markdown-area';
        input.style.minHeight = 'unset';

        // LISTE HISTORIQUE
        const historyList = document.createElement('div');
        historyList.className = 'gl-bg-subtle';
        historyList.id = 'mr-copy-mention-list';
        historyList.style.display = 'none';
        historyList.style.position = 'absolute';
        historyList.style.top = '100%';
        historyList.style.left = '0';
        historyList.style.width = '100%';
        historyList.style.zIndex = '9999';
        historyList.style.border = '1px solid #555';
        historyList.style.borderRadius = '0 0 4px 4px';
        historyList.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
        historyList.style.flexDirection = 'column';
        historyList.style.marginTop = '2px';

        input.onfocus = () => {
            const mentions = getMentions();
            if (mentions.length > 0) historyList.style.display = 'flex';
        };

        input.onblur = () => {
            setTimeout(() => { historyList.style.display = 'none'; }, 200);
        };

        inputWrapper.appendChild(input);
        inputWrapper.appendChild(historyList);

        const btn = document.createElement('button');
        btn.id = 'mr-copy-msg-btn';
        btn.appendChild(createSlackIcon());
        btn.appendChild(document.createTextNode('Copier'));
        btn.title = 'Copier le résumé avec lien (Format Riche)';
        btn.type = 'button';
        btn.className = 'gl-button btn btn-md btn-default';
        btn.onclick = handleCopy;

        inputRow.appendChild(inputWrapper);
        inputRow.appendChild(btn);

        mainWrapper.appendChild(inputRow);

        // Ajouter le widget SOUS les boutons
        container.appendChild(mainWrapper);

        renderMentionList();
    }

    const observer = new MutationObserver((mutations) => {
        if (document.querySelector(HEADER_ACTIONS_SELECTOR)) {
            addInterface();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
