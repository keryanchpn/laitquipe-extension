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

    // ==========================================================================
    // LOGIQUE MÉTIER (Extraction & Parsing)
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
        const source = document.querySelector('input[name="mr-source"]:checked').value;

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
            const match = originalTitle.match(regex);


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
                    if(scopePattern.source === "") {
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
                if(!label.innerText.includes(errorText)) {
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
            labelText = `Changer desc pour "Issues ${ticket.replace(/\[|\]/g, '')}"`;
        } else {
            labelText = `Changer desc pour "Issues TC-XXXXX"`;
        }

        const panel = document.createElement('div');
        panel.id = 'mr-helper-panel';

        // Header
        const header = document.createElement('div');
        header.id = 'mr-helper-header';

        const headerText = document.createElement('span');
        headerText.className = 'header-text';
        headerText.textContent = '🪄 MR Helper';

        const toggleIcon = document.createElement('span');
        toggleIcon.className = 'toggle-icon';
        toggleIcon.textContent = '−';

        header.appendChild(headerText);
        header.appendChild(toggleIcon);
        panel.appendChild(header);

        // Content
        const content = document.createElement('div');
        content.id = 'mr-helper-content';

        // Radio Group
        const radioGroup = document.createElement('div');
        radioGroup.className = 'mr-radio-group';

        function createRadio(value, text, checked = false) {
            const label = document.createElement('label');
            label.className = 'mr-radio-label';

            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'mr-source';
            input.value = value;
            if (checked) input.checked = true;

            label.appendChild(input);
            label.appendChild(document.createTextNode(text));
            return label;
        }

        radioGroup.appendChild(createRadio('input', 'Titre depuis Commit', true));
        radioGroup.appendChild(createRadio('branch', 'Titre depuis Branche'));
        content.appendChild(radioGroup);

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

        const checkboxText = document.createElement('span');
        checkboxText.id = 'mr-desc-label-text';
        checkboxText.textContent = labelText;

        checkboxLabel.appendChild(checkbox);
        checkboxLabel.appendChild(checkboxText);
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
