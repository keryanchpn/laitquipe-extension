#!/bin/bash

# --- CONFIGURATION ---

# Nom du fichier zip final
NOM_ZIP="laitquipe.zip"
API_KEY="user:19596375:903"
API_SECRET="9d6bba542f2941c6923e184df78d05d2374e429857757eff2d8a8597f29d9478"


# --- 1. AUTO-INCREMENT VERSION ---

echo "🔄 Vérification de la version..."

# Lire la version actuelle depuis manifest.json
CURRENT_VERSION=$(jq -r '.version' manifest.json)
echo "   Version actuelle : $CURRENT_VERSION"

# Incrémenter la version (Dernier chiffre + 1)
# On découpe par le point, on prend le dernier élément, on l'incrémente
IFS='.' read -ra ADDR <<< "$CURRENT_VERSION"
LAST_INDEX=$((${#ADDR[@]} - 1))
ADDR[$LAST_INDEX]=$((${ADDR[$LAST_INDEX]} + 1))

# Reconstruire la version
NEW_VERSION=$(IFS=. ; echo "${ADDR[*]}")
echo "   Nouvelle version : $NEW_VERSION"

# Mise à jour de manifest.json
# On utilise un fichier temporaire pour jq car il ne supporte pas l'édition en place directe facilement sans extension
jq --arg v "$NEW_VERSION" '.version = $v' manifest.json > manifest.tmp && mv manifest.tmp manifest.json
echo "   ✅ manifest.json mis à jour."

# Mise à jour de src/popup.html
# On cherche <span id="version">...</span> et on remplace le contenu
sed -i "s/<span id=\"version\">.*<\/span>/<span id=\"version\">$NEW_VERSION<\/span>/" src/popup.html
echo "   ✅ src/popup.html mis à jour."

echo "------------------------------------------------"

# --- 2. SELECTION DES FICHIERS ---
# Listez ici exactement ce que vous voulez envoyer.
# Le script copiera ces éléments dans un dossier propre avant l'envoi.
ELEMENTS_A_ENVOYER=(
    "manifest.json"
    "icons"         # Copiera tout le dossier icons
    "src"
)

# Nom du dossier temporaire de construction
DOSSIER_BUILD="build_tmp"

# --- 3. EXECUTION ---

echo "🚀 Démarrage du déploiement..."

# Nettoyage préalable
if [ -d "$DOSSIER_BUILD" ]; then
    rm -rf "$DOSSIER_BUILD"
fi
mkdir "$DOSSIER_BUILD"

# Copie des fichiers sélectionnés vers le dossier temporaire
echo "📂 Préparation des fichiers..."
for element in "${ELEMENTS_A_ENVOYER[@]}"; do
    if [ -e "$element" ]; then
        cp -r "$element" "$DOSSIER_BUILD/"
        echo "   -> Ajouté : $element"
    else
        echo "   ⚠️ ATTENTION : '$element' n'existe pas et sera ignoré."
    fi
done

echo "------------------------------------------------"
echo "📡 Envoi vers Mozilla Add-ons..."

# Commande d'envoi automatique
# --channel=listed : Pour publier sur le store public
# --source-dir : On dit à Mozilla de ne regarder QUE dans notre dossier propre
web-ext sign \
  --api-key="$API_KEY" \
  --api-secret="$API_SECRET" \
  --channel=unlisted \
  --source-dir="$DOSSIER_BUILD"

# Vérification du résultat
RET_VAL=$?
if [ $RET_VAL -eq 0 ]; then
    echo "✅ SUCCÈS : L'extension a été envoyée et validée !"
    
    # --- 4. GITHUB RELEASE & UPDATES.JSON ---
    echo "------------------------------------------------"
    echo "📦 Préparation de la release GitHub..."

    # Création du ZIP pour Chrome (basé sur le dossier de build propre)
    # Création du ZIP pour Chrome (basé sur le dossier de build propre)
    # On le crée dans /tmp pour ne pas polluer le dossier courant
    CHROME_ZIP="/tmp/laitquipe-chrome-v$NEW_VERSION.zip"
    echo "📦 Création du ZIP pour Chrome : $CHROME_ZIP..."
    (cd "$DOSSIER_BUILD" && zip -r "$CHROME_ZIP" .)
    
    # Trouver le fichier .xpi généré (le plus récent dans web-ext-artifacts)
    XPI_FILE=$(ls -t web-ext-artifacts/*.xpi | head -n 1)
    XPI_FILENAME=$(basename "$XPI_FILE")
    
    if [ -z "$XPI_FILE" ]; then
        echo "❌ ERREUR : Impossible de trouver le fichier .xpi généré."
        exit 1
    fi
    echo "   Fichier trouvé : $XPI_FILENAME"

    # URL de téléchargement pour updates.json
    DOWNLOAD_URL="https://github.com/keryanchpn/laitquipe-extension-releases/releases/download/v$NEW_VERSION/$XPI_FILENAME"

    # Clone ou Pull du repo de releases
    if [ ! -d "laitquipe-releases" ]; then
        echo "📥 Clonage du dépôt de releases..."
        gh repo clone keryanchpn/laitquipe-extension-releases laitquipe-releases
    else
        echo "🔄 Mise à jour du dépôt de releases..."
        (cd laitquipe-releases && git pull)
    fi

    # Mise à jour de updates.json
    echo "📝 Mise à jour de updates.json..."
    UPDATES_FILE="laitquipe-releases/updates.json"
    
    # On utilise jq pour ajouter la nouvelle version au début du tableau "addons" -> "laitquipe@laitquipe.fr" -> "updates"
    # Note: La structure de updates.json doit être respectée.
    # On suppose une structure standard Mozilla updates.json.
    
    # Création de l'objet update
    UPDATE_ENTRY=$(jq -n \
                  --arg v "$NEW_VERSION" \
                  --arg u "$DOWNLOAD_URL" \
                  '{version: $v, update_link: $u}')

    # Insertion dans le fichier updates.json
    # On lit le fichier, on ajoute l'entrée dans le tableau updates, et on réécrit
    jq --argjson new_entry "$UPDATE_ENTRY" \
       '.addons["laitquipe@laitquipe.fr"].updates += [$new_entry]' \
       "$UPDATES_FILE" > "${UPDATES_FILE}.tmp" && mv "${UPDATES_FILE}.tmp" "$UPDATES_FILE"
       
    echo "   ✅ updates.json mis à jour."

    # Commit et Push de updates.json
    echo "⬆️  Push de updates.json vers GitHub..."
    
    # On se déplace dans le dossier pour commiter
    (
        cd laitquipe-releases
        git add updates.json
        git commit -m "chore: release v$NEW_VERSION"
        git push
    )
    
    # Création de la release GitHub
    echo "🚀 Création de la release GitHub v$NEW_VERSION..."
    gh release create "v$NEW_VERSION" "$XPI_FILE" "$CHROME_ZIP" \
       --title "Version $NEW_VERSION" \
       --notes "Release automatique version $NEW_VERSION" \
       --repo "keryanchpn/laitquipe-extension-releases"

    if [ $? -eq 0 ]; then
        echo "✅ Release GitHub créée avec succès !"
    else
        echo "❌ Erreur lors de la création de la release GitHub."
    fi

    # Nettoyage final
    rm -rf "$DOSSIER_BUILD"
    # Le ZIP est dans /tmp, on peut le laisser ou le supprimer. 
    # On le supprime pour être propre.
    rm "$CHROME_ZIP"
else
    echo "❌ ERREUR : L'envoi a échoué. Vérifiez les logs ci-dessus."
fi