# 🚀 Procédure de Mise à Jour de l'Extension (Firefox)

Voici la checklist complète pour publier une nouvelle version (ex: passage de v1.1 à v1.2).

## 1. Préparation du Code 💻
1.  **Modifie le code** (JS/CSS) selon tes besoins.
2.  **Ouvre `manifest.json`** et incrémente le numéro de version :
    ```json
    "version": "1.2",
    ```
3.  **Sauvegarde** tous les fichiers.

## 2. Création du Paquet 📦
1.  Va dans le dossier `gitlab-extension`.
2.  Sélectionne **tout le contenu** (`manifest.json`, dossier `src`, dossier `icons`).
3.  Fais un **Clic Droit > Compresser** (ZIP).
    *   *Attention : Ne zippe pas le dossier parent, mais bien le contenu !*

## 3. Signature Mozilla (AMO) 🦊
1.  Va sur le [Developer Hub](https://addons.mozilla.org/fr/developers/addon/gitlab-power-tools/versions/submit/).
2.  Upload ton nouveau fichier ZIP.
3.  Valide les étapes jusqu'à la fin.
4.  Une fois validé (c'est souvent immédiat), **télécharge le fichier `.xpi` signé**.
    *   *Clic droit sur le lien > "Enregistrer la cible du lien sous..."*
    *   Renomme-le proprement, ex : `gitlab-tools-v1.2.xpi`.

## 4. Publication GitHub (Hébergement) 🐙
1.  Va sur ton repo GitHub > **Releases**.
2.  Clique sur **"Draft a new release"**.
3.  **Tag** : `v1.2`
4.  **Titre** : `v1.2`
5.  **Description** : Liste les changements (optionnel).
6.  **Binaries** : Glisse ton fichier `gitlab-tools-v1.2.xpi` ici.
7.  Clique sur **"Publish release"**.
8.  Une fois publié, fais un clic droit sur le fichier `.xpi` dans la release et copie le lien (ex: `.../download/v1.2/gitlab-tools-v1.2.xpi`).

## 5. Activation de la Mise à Jour Auto 🔄
1.  Ouvre ton fichier `updates.json` localement.
2.  Ajoute un nouveau bloc pour la v1.2 **en haut de la liste** `updates` :
    ```json
    {
      "version": "1.2",
      "update_link": "LE_LIEN_GITHUB_QUE_TU_AS_COPIE"
    },
    ```
3.  **Commit et Push** ce fichier `updates.json` sur la branche `main` de ton repo.

---
✅ **C'est fini !**
Firefox détectera automatiquement la nouvelle version chez tes collègues (délai variable, ou forçage via "Rechercher des mises à jour").
