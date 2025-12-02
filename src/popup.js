document.addEventListener("DOMContentLoaded", () => {
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
        document.getElementById("prod").addEventListener("click", () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                const targetURL = buildTargetURL("prod", tab.url);
                if (targetURL) {
                    chrome.tabs.update(tab.id, { url: targetURL });
                }
            });
        });

        document.getElementById("preprod").addEventListener("click", () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                const targetURL = buildTargetURL("preprod", tab.url);
                if (targetURL) {
                    chrome.tabs.update(tab.id, { url: targetURL });
                }
            });
        });

        document.getElementById("uat").addEventListener("click", () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                const targetURL = buildTargetURL("uat", tab.url);
                if (targetURL) {
                    chrome.tabs.update(tab.id, { url: targetURL });
                }
            });
        });
    };

    setupButtons();
});
