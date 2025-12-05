console.log("Popup script loaded");

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM Content Loaded");
    // Configuration des mappings spécifiques
    const uatToProdMappings = {
        "upwa-www": "www",
        "middle": "private"
    };

    const prodTLDs = {
        "www": "fr",
        "gcp-preprod-www": "fr",
        "default": "tools" // Tous les autres sous-domaines vont en .tools
    };

    // Fonction pour déterminer l'environnement actuel
    const getCurrentEnvironment = (hostname) => {
        if (hostname.endsWith(".dev-candidate.lequipe.eu")) {
            return "uat";
        }
        if (hostname.startsWith("gcp-preprod-")) {
            return "preprod";
        }
        return "prod";
    };

    // Fonction pour obtenir le TLD (Top Level Domain) en fonction du sous-domaine
    const getTLD = (subdomain) => {
        return prodTLDs[subdomain] || prodTLDs["default"];
    };

    // Fonction pour construire l'URL cible
    const buildTargetURL = (environment, currentURL) => {
        const url = new URL(currentURL);
        let hostname = url.hostname;
        let [subdomain, ...domainParts] = hostname.split(".");
        const currentEnvironment = getCurrentEnvironment(hostname);

        if (environment === currentEnvironment) {
            console.log("Déjà dans l'environnement cible.");
            return null;
        }

        let targetSubdomain;
        let targetDomain;

        if (environment === "prod") {
            if (currentEnvironment === "preprod") {
                // Préfixe "gcp-preprod-" à supprimer
                targetSubdomain = subdomain.replace("gcp-preprod-", "");
            } else if (currentEnvironment === "uat") {
                // Mapping UAT vers PROD
                targetSubdomain = uatToProdMappings[subdomain] || subdomain;
            }
            targetDomain = `lequipe.${getTLD(targetSubdomain)}`;
        } else if (environment === "preprod") {
            if (currentEnvironment === "prod") {
                // Ajout du préfixe "gcp-preprod-"
                targetSubdomain = `gcp-preprod-${subdomain}`;
            } else if (currentEnvironment === "uat") {
                // Mapping UAT vers PREPROD
                const prodSubdomain = uatToProdMappings[subdomain] || subdomain;
                targetSubdomain = `gcp-preprod-${prodSubdomain}`;
            }
            targetDomain = `lequipe.${getTLD(targetSubdomain)}`;
        } else if (environment === "uat") {
            if (currentEnvironment === "prod" || currentEnvironment === "preprod") {
                // Mapping PROD/PREPROD vers UAT
                const uatSubdomain = Object.keys(uatToProdMappings).find(
                    (key) => uatToProdMappings[key] === subdomain.replace("gcp-preprod-", "")
                ) || subdomain.replace("gcp-preprod-", "");
                targetSubdomain = uatSubdomain;
                targetDomain = "dev-candidate.lequipe.eu";
            }
        }

        return url.href.replace(hostname, `${targetSubdomain}.${targetDomain}`);
    };

    // Gestion des clics sur les boutons
    const setupButtons = () => {
        console.log("Setting up buttons...");

        const prodBtn = document.getElementById("prod");
        if (prodBtn) {
            prodBtn.addEventListener("click", () => {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const tab = tabs[0];
                    const targetURL = buildTargetURL("prod", tab.url);
                    if (targetURL) {
                        chrome.tabs.update(tab.id, { url: targetURL });
                    }
                });
            });
        }

        const preprodBtn = document.getElementById("preprod");
        if (preprodBtn) {
            preprodBtn.addEventListener("click", () => {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const tab = tabs[0];
                    const targetURL = buildTargetURL("preprod", tab.url);
                    if (targetURL) {
                        chrome.tabs.update(tab.id, { url: targetURL });
                    }
                });
            });
        }

        const uatBtn = document.getElementById("uat");
        if (uatBtn) {
            uatBtn.addEventListener("click", () => {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const tab = tabs[0];
                    const targetURL = buildTargetURL("uat", tab.url);
                    if (targetURL) {
                        chrome.tabs.update(tab.id, { url: targetURL });
                    }
                });
            });
        }

        const cleanBtn = document.getElementById("clean-cookies");
        if (cleanBtn) {
            cleanBtn.addEventListener("click", () => {
                if (!navigator.userAgent.includes("Firefox")) {
                    alert("Cette fonctionnalité est réservée à Firefox.");
                    return;
                }

                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const tab = tabs[0];
                    console.log("Current tab:", tab);

                    // On ajoute les origines principales car les cookies d'auth sont souvent sur le domaine racine
                    const origins = [
                        "https://gcp-preprod-www.lequipe.fr",
                        "https://lequipe.fr",
                        "https://www.lequipe.fr"
                    ];

                    if (tab.url && tab.url.includes("gcp-preprod")) {
                        const url = new URL(tab.url);
                        origins.push(url.origin);
                    }

                    const uniqueOrigins = [...new Set(origins)];
                    console.log("Origins to clear:", uniqueOrigins);

                    chrome.browsingData.remove({
                        origins: uniqueOrigins
                    }, {
                        "cookies": true,
                        "localStorage": true,
                        "cache": true,
                        "indexedDB": true
                    }, () => {
                        if (chrome.runtime.lastError) {
                            console.error("Error clearing data:", chrome.runtime.lastError);
                            alert("Erreur lors du nettoyage des cookies.");
                        } else {
                            console.log("Data cleared successfully");
                            alert("Cookies et données nettoyés avec succès !");
                            chrome.tabs.reload(tab.id);
                        }
                    });
                });
            });
        }

        // Navigation Endpoints View
        const showEndpointsBtn = document.getElementById("show-endpoints");
        const backToMenuBtn = document.getElementById("back-to-menu");
        const mainMenu = document.getElementById("main-menu");
        const endpointsView = document.getElementById("endpoints-view");
        const endpointsContent = endpointsView ? endpointsView.querySelector(".content") : null;

        if (showEndpointsBtn && backToMenuBtn && mainMenu && endpointsView) {
            showEndpointsBtn.addEventListener("click", () => {
                mainMenu.style.display = "none";
                endpointsView.style.display = "block";
                document.body.style.width = "800px"; // Agrandir la popup

                // Charger les endpoints depuis le content script
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const tab = tabs[0];
                    if (tab.url && (tab.url.includes("lequipe.fr") || tab.url.includes("lequipe.tools") || tab.url.includes("lequipe.eu"))) {

                        // Mise à jour du badge environnement
                        const url = new URL(tab.url);
                        const env = getCurrentEnvironment(url.hostname);
                        const badge = document.getElementById("env-badge");
                        if (badge) {
                            badge.textContent = `ENVIRONNEMENT : ${env.toUpperCase()}`;
                            badge.className = `env-badge ${env}`; // Reset classes and add env
                        }

                        chrome.tabs.sendMessage(tab.id, { action: "getEndpoints" }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.error(chrome.runtime.lastError);
                                endpointsContent.innerHTML = "<p style='padding: 10px; color: #666;'>Impossible de récupérer les endpoints. Rechargez la page.</p>";
                                return;
                            }

                            if (response && response.endpoints) {
                                renderEndpoints(response.endpoints);
                            } else {
                                endpointsContent.innerHTML = "<p style='padding: 10px; color: #666;'>Aucun endpoint capturé pour le moment.</p>";
                            }
                        });
                    } else {
                        endpointsContent.innerHTML = "<p style='padding: 10px; color: #666;'>Cette fonctionnalité n'est disponible que sur les sites L'Équipe.</p>";
                        const badge = document.getElementById("env-badge");
                        if (badge) badge.style.display = "none";
                    }
                });
            });

            backToMenuBtn.addEventListener("click", () => {
                endpointsView.style.display = "none";
                mainMenu.style.display = "block";
                document.body.style.width = "300px"; // Revenir à la taille normale
            });
        }
    };

    const renderEndpoints = (endpoints) => {
        const container = document.querySelector("#endpoints-view .content");
        if (!container) return;

        // Vider le conteneur proprement
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        if (endpoints.length === 0) {
            const p = document.createElement("p");
            p.style.padding = "10px";
            p.style.color = "#666";
            p.textContent = "Aucun endpoint capturé pour le moment.";
            container.appendChild(p);
            return;
        }

        // Grouper par service
        const groups = {};
        endpoints.forEach(ep => {
            if (!groups[ep.service]) {
                groups[ep.service] = [];
            }
            groups[ep.service].push(ep);
        });

        for (const [service, items] of Object.entries(groups)) {
            // Créer le groupe
            const groupDiv = document.createElement("div");
            groupDiv.className = "endpoint-group";

            // Créer le header du groupe
            const header = document.createElement("h4");
            const titleText = document.createTextNode(`📂 ${service} `);
            header.appendChild(titleText);

            const countSpan = document.createElement("span");
            countSpan.style.fontWeight = "normal";
            countSpan.style.fontSize = "11px";
            countSpan.style.opacity = "0.7";
            countSpan.textContent = `${items.length} requêtes`;
            header.appendChild(countSpan);

            groupDiv.appendChild(header);

            // Créer la liste
            const ul = document.createElement("ul");
            ul.className = "endpoint-list";

            items.forEach(ep => {
                const statusColor = ep.status >= 400 ? "🔴" : "🟢";
                const urlObj = new URL(ep.url);
                const path = urlObj.pathname + urlObj.search;

                const li = document.createElement("li");
                li.className = "endpoint-item";

                // Badge Status
                const statusBadge = document.createElement("span");
                statusBadge.className = "status-badge";
                statusBadge.textContent = `${statusColor} ${ep.status}`;
                li.appendChild(statusBadge);

                // Badge Method
                const methodBadge = document.createElement("span");
                methodBadge.className = "method-badge";
                methodBadge.textContent = ep.method;
                li.appendChild(methodBadge);

                // URL Text
                const urlText = document.createElement("span");
                urlText.className = "url-text";
                urlText.title = ep.url;
                urlText.textContent = path;
                // Event listener pour ouvrir le lien
                urlText.addEventListener("click", () => {
                    chrome.tabs.create({ url: ep.url });
                });
                li.appendChild(urlText);

                // Copy Button
                const copyBtn = document.createElement("button");
                copyBtn.className = "copy-btn";
                copyBtn.title = "Copier l'URL";
                copyBtn.textContent = "📋";
                // Event listener pour copier
                copyBtn.addEventListener("click", () => {
                    navigator.clipboard.writeText(ep.url).then(() => {
                        const originalText = copyBtn.textContent;
                        copyBtn.textContent = "✅";
                        setTimeout(() => {
                            copyBtn.textContent = originalText;
                        }, 1000);
                    });
                });
                li.appendChild(copyBtn);

                ul.appendChild(li);
            });

            groupDiv.appendChild(ul);
            container.appendChild(groupDiv);
        }
    };

    // Écouter les nouveaux endpoints en temps réel
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "newEndpoint") {
            const endpointsView = document.getElementById("endpoints-view");
            // Si la vue est visible, on met à jour
            if (endpointsView && endpointsView.style.display !== "none") {
                // On peut optimiser en ajoutant juste le dernier, mais pour l'instant on recharge tout
                // pour garder le tri et le groupement cohérents
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    // On vérifie que le message vient bien de l'onglet actif
                    if (tabs[0] && sender.tab && tabs[0].id === sender.tab.id) {
                        // On redemande la liste complète pour être sûr d'avoir l'état à jour
                        chrome.tabs.sendMessage(tabs[0].id, { action: "getEndpoints" }, (response) => {
                            if (response && response.endpoints) {
                                renderEndpoints(response.endpoints);
                            }
                        });
                    }
                });
            }
        }
    });

    setupButtons();
});
