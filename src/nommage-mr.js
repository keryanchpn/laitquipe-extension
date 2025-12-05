(function () {
    'use strict';

    // ==========================================================================
    // CONFIGURATION DES SÉLECTEURS DOM
    // ==========================================================================
    // Input du titre de la MR
    const INPUT_TITLE_SELECTOR = 'input#merge_request_title';

    // Input de la description. 
    // NOTE: On cible la classe .js-gfm-input car l'ID #merge_request_description 
    // est souvent un input caché sur les versions récentes de GitLab.
    const INPUT_DESC_SELECTOR = 'textarea.js-gfm-input';

    // Élément affichant la branche source (pour extraire le ticket si besoin)
    const BRANCH_SOURCE_SELECTOR = '.branch-selector code';

    const BRANCH_PATHS = [{ d: 'M416,160a64,64,0,1,0-96.27,55.24c-2.29,29.08-20.08,37-75,48.42-17.76,3.68-35.93,7.45-52.71,13.93V151.39a64,64,0,1,0-64,0V360.61a64,64,0,1,0,64.42.24c2.39-18,16-24.33,65.26-34.52,27.43-5.67,55.78-11.54,79.78-26.95,29-18.58,44.53-46.78,46.36-83.89A64,64,0,0,0,416,160ZM160,64a32,32,0,1,1-32,32A32,32,0,0,1,160,64Zm0,384a32,32,0,1,1,32-32A32,32,0,0,1,160,448ZM352,192a32,32,0,1,1,32-32A32,32,0,0,1,352,192Z' }]
    const COMMIT_PATHS = [{ d: 'M11.8759,8.99237 C11.4346,10.7215 9.86658,12 8,12 C6.13342,12 4.56545,10.7215 4.12406,8.99238 C4.08342,8.99741 4.04201,9 4,9 L1,9 C0.447715,9 0,8.55228 0,8 C0,7.44771 0.447715,7 1,7 L4,7 C4.04201,7 4.08342,7.00259 4.12406,7.00762 C4.56545,5.27853 6.13342,4 8,4 C9.86658,4 11.4346,5.27853 11.8759,7.00763 C11.9166,7.00259 11.958,7 12,7 L15,7 C15.5523,7 16,7.44772 16,8 C16,8.55228 15.5523,9 15,9 L12,9 C11.958,9 11.9166,8.9974 11.8759,8.99237 Z M8,10 C9.10457,10 10,9.10457 10,8 C10,6.89543 9.10457,6 8,6 C6.89543,6 6,6.89543 6,8 C6,9.10457 6.89543,10 8,10 Z' }]
    // ==========================================================================
    // LOGIQUE MÉTY (Extraction & Parsing)
    // ==========================================================================

    /**
     * Extrait le numéro de ticket (ex: TC-14328) depuis le nom de la branche source.
     * @returns {string} Le ticket entre crochets "[TC-14328]" ou vide.
     */
    function getTicketFromBranch() {
        const branchEl = document.querySelector(BRANCH_SOURCE_SELECTOR);
        if (!branchEl) return "";
        const match = branchEl.innerText.match(/(TC-\d+)/);
        return match ? `[${match[1]}]` : "";
    }



    /**
     * Extrait les scopes depuis le titre actuel.
     * Supporte deux formats :
     * 1. Format initial : "feat(scope1, scope2): ..." -> "[scope1][scope2]"
     * 2. Format déjà traité : "[TC-123][scope1][scope2] ..." -> "[scope1][scope2]"
     * @param {string} inputValue - Le titre actuel de la MR.
     * @returns {string} Les scopes formatés "[scope1][scope2]" ou vide.
     */
    function getScopesFromInput(inputValue) {
        // 1. Recherche du format (scope1, scope2)
        const regexParen = /\(([^)]+)\)/;
        const matchParen = inputValue.match(regexParen);

        if (matchParen && matchParen[1]) {
            return matchParen[1].split(',').map(s => `[${s.trim()}]`).join('');
        }

        // 2. Recherche du format [scope1][scope2]
        // On cherche tous les blocs entre crochets
        const bracketPattern = /\[([^\]]+)\]/g;
        const matches = [...inputValue.matchAll(bracketPattern)];

        if (matches.length > 0) {
            // On filtre ce qui ressemble à un ticket (TC-xxx) pour ne garder que les scopes
            const potentialScopes = matches.filter(m => !m[1].match(/^TC-\d+$/));
            if (potentialScopes.length > 0) {
                return potentialScopes.map(m => `[${m[1]}]`).join('');
            }
        }

        return "";
    }

    /**
     * Met à jour le champ titre et déclenche les événements pour Vue.js.
     * @param {string} newTitle - Le nouveau titre à appliquer.
     */
    function updateTitleInput(newTitle) {
        const input = document.querySelector(INPUT_TITLE_SELECTOR);
        if (!input) return;
        input.value = newTitle;
        // Dispatch events pour que GitLab détecte le changement
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // ==========================================================================
    // MISE À JOUR DESCRIPTION (Avec Fix Reactivité)
    // ==========================================================================

    /**
     * Remplit la description avec "Issues TC-XXXX".
     * Utilise un hack pour forcer la réactivité de Vue.js sur le textarea.
     * @param {string} ticketBracket - Le ticket avec crochets "[TC-XXXX]".
     */
    function updateDescriptionInput(ticketBracket) {
        const textarea = document.querySelector(INPUT_DESC_SELECTOR);
        const shouldUpdate = document.getElementById('mr-fill-desc').checked;

        if (!textarea || !shouldUpdate) return;

        // Fallback: Si aucun ticket n'est passé, on essaie de le trouver dans la branche
        if (!ticketBracket) {
            ticketBracket = getTicketFromBranch();
        }

        if (!ticketBracket) return;

        // Nettoyage: [TC-14328] -> TC-14328
        const cleanTicket = ticketBracket.replace(/[\[\]]/g, '');
        const newValue = `Issues ${cleanTicket}`;

        // --- HACK REACTIVITÉ VUE.JS ---
        // Vue.js surcharge le setter de value. Pour déclencher correctement la réactivité,
        // on doit appeler le setter natif du prototype HTMLTextAreaElement.
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        nativeInputValueSetter.call(textarea, newValue);

        // Déclenchement des événements standards pour notifier le framework
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // ==========================================================================
    // FONCTION PRINCIPALE (Orchestration)
    // ==========================================================================
    function applyFormat() {
        const inputTitle = document.querySelector(INPUT_TITLE_SELECTOR);
        if (!inputTitle) {
            alert("Champ titre introuvable !");
            return;
        }

        // Récupération des options utilisateur depuis le panneau
        const selectedRow = document.querySelector('.mr-option-row.selected');
        if (!selectedRow) return; // Should not happen
        const source = selectedRow.dataset.value;

        let finalTicket = "";

        // CAS 1: TITRE DEPUIS LA BRANCHE
        // Format attendu branche: feature/TC-14328#Description-du-ticket
        if (source === 'branch') {
            const branchEl = document.querySelector(BRANCH_SOURCE_SELECTOR);
            if (branchEl) {
                const fullBranchName = branchEl.innerText;
                finalTicket = getTicketFromBranch(); // ex: [TC-14328]
                const currentScopes = getScopesFromInput(inputTitle.value);

                let description = "";
                // Extraction de la description après le '#' ou nettoyage standard
                if (fullBranchName.includes('#')) {
                    description = fullBranchName.split('#')[1];
                } else {
                    description = fullBranchName.replace(/^(feature|feat|fix)\//, '').replace(/TC-\d+/, '');
                }

                // Formatage de la description (espaces, majuscule)
                description = description.replace(/[-_]/g, ' ').trim();
                if (description.length > 0) {
                    description = description.charAt(0).toUpperCase() + description.slice(1);
                }

                // Construction finale: [PREFIX][TICKET][SCOPES] Description
                updateTitleInput(`${finalTicket}${currentScopes} ${description}`);
            }
        }
        // CAS 2: TITRE DEPUIS LE COMMIT (INPUT EXISTANT)
        // Essaie de parser le titre actuel pour le reformater proprement
        else {
            let originalTitle = inputTitle.value;

            // TENTATIVE DE RÉCUPÉRATION DU TITRE COMPLET DEPUIS LA DESCRIPTION
            // Souvent le titre dans l'input est coupé (ex: "...") alors que la description contient tout.
            const textarea = document.querySelector(INPUT_DESC_SELECTOR);
            if (textarea && textarea.value.trim().length > 0) {
                const lines = textarea.value.split('\n');
                if (lines.length > 0 && lines[0].trim().length > 0) {
                    // On suppose que la première ligne de la description est le "vrai" titre complet
                    // On l'utilise si elle semble valide (non vide)
                    originalTitle = lines[0].trim();
                }
            }
            // Regex pour parser: [TICKET] scope: Description
            // Modifiée pour accepter les espaces avant les deux points
            const ticketPattern = /(\[[^\]]+\])?/; // Optional ticket like [TC-123]
            const typePattern = /\w+/; // Commit type like feat, fix, chore
            const scopePattern = /(?:\(([^)]+)\))?/; // Optional scope like (core)
            const separatorPattern = /\s*:\s*/; // Separator between type/scope and description
            const descriptionPattern = /(.*)/; // The rest is the description

            const regex = new RegExp(
                `^${ticketPattern.source}\\s*${typePattern.source}${scopePattern.source}${separatorPattern.source}${descriptionPattern.source}`
            );
            let match = originalTitle.match(regex);

            // FALLBACK: Si le titre extrait de la description ne matche pas,
            // on essaie avec le titre actuel de l'input.
            if (!match) {
                originalTitle = inputTitle.value;
                match = originalTitle.match(regex);
            }


            if (match) {
                finalTicket = match[1] || "";
                const scopeRaw = match[2];
                let description = match[3];

                // Si pas de ticket dans le titre, on le prend de la branche
                if (!finalTicket) {
                    const branchTicket = getTicketFromBranch();
                    if (branchTicket) finalTicket = branchTicket;
                }

                // Formatage des scopes
                let formattedScopes = "";
                if (scopeRaw) {
                    if (scopePattern.source === "") {
                        formattedScopes = getScopesFromInput(inputTitle.value);
                    } else {
                        formattedScopes = scopeRaw.split(',').map(s => `[${s.trim()}]`).join('');
                    }
                }

                // Capitalisation de la description
                if (description) {
                    description = description.trim();
                    if (description.length > 0) {
                        description = description.charAt(0).toUpperCase() + description.slice(1);
                    }
                }

                updateTitleInput(`${finalTicket}${formattedScopes} ${description}`);
            } else {
                // Si le titre ne matche pas la regex, on insère juste le ticket et le préfixe
                let ticketInsert = "";
                if (!originalTitle.includes("[TC-")) ticketInsert = getTicketFromBranch();
                finalTicket = ticketInsert;

                let label = document.querySelector('label[for="merge_request_title"]');
                let errorText = "Le titre n\'est pas dans le format attendu pour le formater";
                if (!label.innerText.includes(errorText)) {
                    const errorSpan = document.createElement('span');
                    errorSpan.className = 'error-span';
                    errorSpan.style.color = 'red';
                    errorSpan.textContent = errorText;
                    label.appendChild(errorSpan);
                }

                // updateTitleInput(`${ticketInsert} ${originalTitle}`);
            }
        }

        // 2. MISE À JOUR DE LA DESCRIPTION
        updateDescriptionInput(finalTicket);
    }

    // ==========================================================================
    // INTERFACE UTILISATEUR (Création du Panneau)
    // ==========================================================================

    function createPanel() {
        // Évite les doublons
        if (document.getElementById('mr-helper-panel')) return;
        const ticket = getTicketFromBranch();
        let labelText = "";
        if (ticket) {
            labelText = `Changer la description pour "Issues ${ticket.replace(/\[|\]/g, '')}"`;
        } else {
            labelText = `Changer la description pour "Issues TC-XXXXX"`;
        }

        const panel = document.createElement('div');
        panel.id = 'mr-helper-panel';

        // Header
        const header = document.createElement('div');
        header.id = 'mr-helper-header';

        const headerText = document.createElement('span');
        headerText.className = 'header-text';
        headerText.textContent = 'Merge Request Helper';

        const toggleIcon = document.createElement('span');
        toggleIcon.className = 'toggle-icon';
        toggleIcon.textContent = '−';

        const logoImg = document.createElement('img');
        logoImg.src = chrome.runtime.getURL('src/laitquipe.png');
        logoImg.className = 'minimized-icon';
        logoImg.style.display = 'none'; // Caché par défaut

        header.appendChild(logoImg);
        header.appendChild(headerText);
        header.appendChild(toggleIcon);
        panel.appendChild(header);

        // Content
        const content = document.createElement('div');
        content.id = 'mr-helper-content';

        // Radio Group
        // Options Group
        const optionsGroup = document.createElement('div');
        optionsGroup.className = 'mr-options-group';

        function createOptionRow(value, text, svgPaths, selected = false) {
            const row = document.createElement('div');
            row.className = 'mr-option-row';
            if (selected) row.classList.add('selected');
            row.dataset.value = value;

            // SVG Icon
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("viewBox", "0 0 512 512"); // Default viewBox, might need adjustment based on path
            // Note: The paths provided have different viewBoxes potentially. 
            // Commit icon seems to be 16x16 based on previous file content, Branch is 512x512.
            // Let's adjust viewBox based on value or standardize.

            if (value === 'input') {
                svg.setAttribute("viewBox", "0 0 16 16");
            } else {
                svg.setAttribute("viewBox", "0 0 512 512");
            }

            svg.classList.add('option-icon');

            svgPaths.forEach(pathData => {
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", pathData.d);
                // Add fill if needed, or handle in CSS
                path.setAttribute("fill", "currentColor");
                svg.appendChild(path);
            });

            const label = document.createElement('span');
            label.className = 'option-label';
            label.textContent = text;

            row.appendChild(svg);
            row.appendChild(label);

            // Click Event
            row.addEventListener('click', () => {
                // Deselect all
                optionsGroup.querySelectorAll('.mr-option-row').forEach(r => r.classList.remove('selected'));
                // Select clicked
                row.classList.add('selected');
            });

            return row;
        }

        optionsGroup.appendChild(createOptionRow('input', 'Récupérer la description depuis le commit', COMMIT_PATHS, true));
        optionsGroup.appendChild(createOptionRow('branch', 'Récupérer le titre depuis le nom de la branche', BRANCH_PATHS));
        content.appendChild(optionsGroup);

        // Apply Button
        const applyBtn = document.createElement('button');
        applyBtn.id = 'mr-apply-btn';
        applyBtn.className = 'mr-action-btn';
        applyBtn.textContent = 'Appliquer Tout';
        content.appendChild(applyBtn);

        // Checkbox
        const checkboxLabel = document.createElement('label');
        checkboxLabel.className = 'mr-checkbox-label';
        checkboxLabel.title = "Force l'écrasement de la description";

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'mr-fill-desc';
        checkbox.checked = true;

        const textContainer = document.createElement('div');
        textContainer.className = 'mr-checkbox-text-container';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'mr-checkbox-title';
        titleSpan.textContent = "Mettre à jour la description";

        const subtitleSpan = document.createElement('span');
        subtitleSpan.className = 'mr-checkbox-subtitle';
        subtitleSpan.textContent = ticket ? `Issues ${ticket.replace(/\[|\]/g, '')}` : "Issues TC-XXXXX";

        textContainer.appendChild(titleSpan);
        textContainer.appendChild(subtitleSpan);

        checkboxLabel.appendChild(checkbox);
        checkboxLabel.appendChild(textContainer);
        content.appendChild(checkboxLabel);

        panel.appendChild(content);

        document.body.appendChild(panel);

        // Gestionnaires d'événements
        // (header and applyBtn are already defined above)

        // Minimiser/Agrandir le panneau
        header.addEventListener('click', () => {
            panel.classList.toggle('minimized');
            const icon = panel.querySelector('.toggle-icon');
            if (icon) icon.textContent = panel.classList.contains('minimized') ? '+' : '−';
        });

        // Clic sur "Appliquer Tout"
        applyBtn.addEventListener('click', applyFormat);
    }

    // ==========================================================================
    // INITIALISATION (Observer)
    // ==========================================================================
    // GitLab est une SPA (Single Page App), le chargement est dynamique.
    // On observe le body pour détecter quand le formulaire de MR apparaît.
    const observer = new MutationObserver((mutations) => {
        if (document.querySelector(INPUT_TITLE_SELECTOR)) {
            createPanel();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
