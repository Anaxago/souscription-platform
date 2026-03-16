# Spec Windsurf — Mise à jour de la page de souscription Anaxago Value

**Projet :** Anaxago Value - Gestion libre (`/souscrire/axvaluegestionlibre`)
**Design System de référence :** [anaxago-patrimony-ds4.surge.sh](https://anaxago-patrimony-ds4.surge.sh/)
**Objectif :** Refondre la page de souscription actuelle pour l'aligner avec le Design System Anaxago Patrimony DS4.

---

## Contexte

La page actuelle est minimaliste : fond blanc, typographie système, bouton bleu générique. Elle doit être transformée en une page institutionnelle, cohérente avec l'identité visuelle du site Anaxago Patrimony, qui utilise une palette vert obsidian/écru, la police Syne (display) et Playfair Display (serif), et un système de composants précis.

---

## 1. Design Tokens — Variables CSS à déclarer

Ajouter ces variables dans le `:root` du fichier CSS global (ou dans `tailwind.config.js` si Tailwind est utilisé) :

```css
:root {
  /* Couleurs */
  --clr-obsidian:       #0d2e2b;
  --clr-primary:        #1a5d56;
  --clr-primary-dark:   #134440;
  --clr-primary-light:  #e0f0ee;
  --clr-cashmere:       #3d6b66;
  --clr-mauve:          #7ab5af;
  --clr-ecru-type:      #e0f0ee;
  --clr-ecru-bg:        #edf5f4;
  --clr-off-white:      #f7fafa;
  --clr-true-white:     #ffffff;
  --clr-stroke-light:   rgba(122, 181, 175, 0.4);
  --clr-stroke-dark:    rgba(122, 181, 175, 0.3);

  /* Typographie */
  --font-display: 'Syne', 'Helvetica Neue', sans-serif;
  --font-serif:   'Playfair Display', 'Georgia', serif;
  --font-body:    'Syne', 'Helvetica Neue', Arial, sans-serif;

  /* Espacements */
  --space-xs:   8px;
  --space-sm:   16px;
  --space-md:   24px;
  --space-lg:   40px;
  --space-xl:   64px;
  --space-2xl:  96px;
  --space-3xl:  128px;
  --grid-margin: clamp(1.5rem, 3.75vw + 0.62rem, 4rem);
  --max-width:   1440px;

  /* Rayons de bordure */
  --radius-pill: 9999px;
  --radius-sm:   4px;
  --radius-md:   8px;

  /* Transitions */
  --transition-fast: all 0.3s ease;
  --transition-link: color 0.6s ease-out;
}
```

**Polices Google Fonts à importer :**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@300;400;600;700&family=Playfair+Display:wght@400;500&display=swap" rel="stylesheet">
```

---

## 2. Fond de page et Reset

```css
body {
  font-family: var(--font-body);
  font-size: 17px;
  line-height: 1.6;
  color: var(--clr-obsidian);
  background: var(--clr-ecru-bg);   /* ← remplace le fond blanc actuel */
  -webkit-font-smoothing: antialiased;
}
```

---

## 3. Structure de la page — HTML cible

La page doit être restructurée selon le layout suivant. Chaque section est décrite avec ses classes CSS et son contenu.

### 3.1 Navbar (si présente)

Si la page possède une barre de navigation, elle doit suivre ce pattern :

```html
<nav class="nav-bar">
  <a class="nav-logo-text" href="/">Anaxago</a>
  <!-- liens de navigation si nécessaire -->
</nav>
```

```css
.nav-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between;
  padding: 24px var(--grid-margin);
  background: transparent;
  transition: background 0.4s ease, padding 0.4s ease;
}
.nav-bar.scrolled {
  background: var(--clr-obsidian);
  padding: 16px var(--grid-margin);
}
.nav-logo-text {
  font-family: var(--font-display);
  font-size: 18px; font-weight: 700;
  color: var(--clr-off-white); letter-spacing: -0.02em;
}
```

### 3.2 Section principale — En-tête du produit

```html
<section class="section-light">
  <div class="section-inner">

    <!-- Badge de statut -->
    <span class="badge badge--open">Ouvert à la souscription</span>

    <!-- Tags de catégories -->
    <div class="fund-card__tags" style="margin: var(--space-md) 0;">
      <span class="tag">Immobilier</span>
      <span class="tag">Private Equity</span>
      <span class="tag">Infrastructure</span>
      <span class="tag">Santé</span>
      <span class="tag">Technologie</span>
      <span class="tag">Énergie</span>
      <span class="tag">Agriculture</span>
    </div>

    <!-- Titre principal -->
    <h1 class="text-h1">Anaxago Value - Gestion libre</h1>

    <!-- Sous-titre -->
    <p style="font-size: 17px; color: var(--clr-cashmere); max-width: 640px; margin-top: var(--space-md);">
      Anaxago Value combine fonds en euros et unités de compte pour construire librement une allocation adaptée à vos objectifs.
    </p>

  </div>
</section>
```

**Styles CSS associés :**

```css
.section-light { background: var(--clr-ecru-bg); color: var(--clr-obsidian); }

.section-inner {
  padding: var(--space-xl) var(--grid-margin) var(--space-lg);
  max-width: var(--max-width);
  margin: 0 auto;
}

.text-h1 {
  font-family: var(--font-display);
  font-size: clamp(40px, 5vw, 74px);
  font-weight: 300;
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: var(--clr-obsidian);
  margin-top: var(--space-sm);
}

/* Badge de statut */
.badge {
  font-family: var(--font-display);
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  padding: 3px 10px; border-radius: var(--radius-pill);
  display: inline-block;
}
.badge--open { background: var(--clr-primary); color: var(--clr-off-white); }

/* Tags */
.tag {
  font-family: var(--font-display);
  font-size: 11px; font-weight: 600;
  padding: 3px 10px; border-radius: var(--radius-pill);
  background: var(--clr-ecru-bg); color: var(--clr-cashmere);
  border: 1px solid var(--clr-stroke-dark);
  display: inline-flex; align-items: center; gap: 5px;
}
.fund-card__tags { display: flex; flex-wrap: wrap; gap: 5px; }
```

### 3.3 Section des caractéristiques clés (KV Grid)

```html
<section class="section-white">
  <div class="container">
    <div class="kv-grid">

      <div class="kv-item">
        <span class="kv-item__key">Investissement minimum</span>
        <span class="kv-item__value">5 000 €</span>
      </div>

      <div class="kv-item">
        <span class="kv-item__key">Zones géographiques</span>
        <span class="kv-item__value">France, Europe, Amérique du Nord, Asie-Pacifique</span>
      </div>

      <div class="kv-item">
        <span class="kv-item__key">Type de contrat</span>
        <span class="kv-item__value">Assurance-vie multisupport</span>
      </div>

      <div class="kv-item">
        <span class="kv-item__key">Assureur</span>
        <span class="kv-item__value">Generali Vie</span>
      </div>

    </div>
  </div>
</section>
```

**Styles CSS associés :**

```css
.section-white { background: var(--clr-off-white); color: var(--clr-obsidian); }

.container {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 var(--grid-margin);
}

/* KV Grid */
.kv-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid var(--clr-stroke-dark);
  margin-bottom: var(--space-xl);
}
.kv-item {
  padding: var(--space-md) var(--space-lg);
  border-right: 1px solid var(--clr-stroke-dark);
  border-bottom: 1px solid var(--clr-stroke-dark);
  display: flex; flex-direction: column; gap: 6px;
}
.kv-item:nth-child(4n) { border-right: none; }
.kv-item__key {
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--clr-cashmere);
}
.kv-item__value {
  font-family: var(--font-display);
  font-size: 17px; font-weight: 600;
  color: var(--clr-obsidian);
}

/* Responsive KV Grid */
@media (max-width: 940px) {
  .kv-grid { grid-template-columns: repeat(2, 1fr); }
  .kv-item:nth-child(4n) { border-right: 1px solid var(--clr-stroke-dark); }
  .kv-item:nth-child(2n) { border-right: none; }
}
@media (max-width: 600px) {
  .kv-grid { grid-template-columns: 1fr; }
  .kv-item { border-right: none; }
}
```

### 3.4 Section Description longue

```html
<section class="section-light">
  <div class="section-inner">
    <p style="font-size: 17px; line-height: 1.6; color: var(--clr-obsidian); max-width: 800px;">
      Contrat d'assurance-vie multisupport, accessible dès 5 000 €, Anaxago Value combine fonds en euros et unités de compte pour construire librement une allocation adaptée à vos objectifs.
    </p>
  </div>
</section>
```

### 3.5 Section Points forts et Points d'attention

Cette section doit être redessinée sous forme d'une grille à deux colonnes, chaque colonne étant une carte distincte.

```html
<section class="section-light">
  <div class="container" style="padding-top: var(--space-xl); padding-bottom: var(--space-xl);">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--clr-stroke-dark); border: 1px solid var(--clr-stroke-dark); border-radius: var(--radius-md); overflow: hidden;">

      <!-- Points forts -->
      <div style="background: var(--clr-off-white); padding: var(--space-lg);">
        <div style="display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-md);">
          <!-- Icône SVG check circle -->
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
          </svg>
          <span class="text-eyebrow" style="margin-bottom: 0;">Points forts</span>
        </div>
        <ul style="list-style: none; display: flex; flex-direction: column; gap: var(--space-sm);">
          <li class="info-list-item">Fiscalité avantageuse de l'assurance vie (abattement après 8 ans, exonération des droits de succession jusqu'à 152 500€ par bénéficiaire).</li>
          <li class="info-list-item">Diversification sur plusieurs classes d'actifs (fonds euros, ETF, SCPI, Private Equity).</li>
          <li class="info-list-item">Gestion libre permettant une personnalisation de l'allocation selon le profil de risque.</li>
          <li class="info-list-item">Accès à des supports d'investissement habituellement réservés aux institutionnels.</li>
          <li class="info-list-item">Liquidité assurée par le contrat d'assurance vie.</li>
          <li class="info-list-item">Accompagnement par les équipes Anaxago.</li>
          <li class="info-list-item">Contrat assuré par Generali Vie, assureur de référence.</li>
        </ul>
      </div>

      <!-- Points d'attention -->
      <div style="background: var(--clr-off-white); padding: var(--space-lg);">
        <div style="display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-md);">
          <!-- Icône SVG alerte -->
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--clr-mauve)" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span class="text-eyebrow" style="margin-bottom: 0; color: var(--clr-mauve);">Points d'attention</span>
        </div>
        <ul style="list-style: none; display: flex; flex-direction: column; gap: var(--space-sm);">
          <li class="info-list-item">Risque de perte en capital sur les unités de compte (UC).</li>
          <li class="info-list-item">Horizon d'investissement recommandé de 8 ans minimum pour bénéficier pleinement des avantages fiscaux.</li>
          <li class="info-list-item">Frais de gestion annuels sur les UC.</li>
          <li class="info-list-item">Performances passées ne préjugent pas des performances futures.</li>
          <li class="info-list-item">Liquidité des UC non garantie en cas de conditions de marché exceptionnelles.</li>
          <li class="info-list-item">Complexité de certains supports d'investissement (Private Equity, SCPI).</li>
        </ul>
      </div>

    </div>
  </div>
</section>
```

**Styles CSS associés :**

```css
.text-eyebrow {
  display: block;
  font-family: var(--font-display);
  font-size: 14px; font-weight: 600;
  letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--clr-cashmere);
  margin-bottom: var(--space-md);
}

.info-list-item {
  font-size: 14px;
  line-height: 1.6;
  color: var(--clr-cashmere);
  padding-left: var(--space-md);
  position: relative;
}
.info-list-item::before {
  content: '—';
  position: absolute; left: 0;
  color: var(--clr-stroke-dark);
}

/* Responsive : passer en colonne unique sur mobile */
@media (max-width: 768px) {
  .info-grid { grid-template-columns: 1fr !important; }
}
```

### 3.6 Section Call-to-Action (Souscrire)

```html
<section class="section-dark">
  <div class="cta-dark">
    <div class="cta-dark-text">
      <span class="text-eyebrow">Prêt à investir ?</span>
      <h2 class="section-title" style="color: var(--clr-off-white);">
        Souscrivez à Anaxago Value dès 5 000 €.
      </h2>
    </div>
    <div class="cta-dark-actions">
      <a href="#formulaire" class="btn-primary">
        Souscrire maintenant
      </a>
    </div>
  </div>
</section>
```

**Styles CSS associés :**

```css
.section-dark { background: var(--clr-obsidian); color: var(--clr-ecru-type); }
.section-dark h1, .section-dark h2, .section-dark h3 { color: var(--clr-off-white); }
.section-dark .text-eyebrow { color: var(--clr-mauve); }

.cta-dark {
  padding: var(--space-3xl) var(--grid-margin);
  max-width: var(--max-width); margin: 0 auto;
  display: flex; align-items: flex-end;
  justify-content: space-between; gap: var(--space-xl);
}
.cta-dark-text { max-width: 600px; }
.cta-dark-actions { display: flex; gap: 16px; align-items: center; flex-shrink: 0; }

.section-title {
  font-family: var(--font-serif);
  font-size: clamp(28px, 3.5vw, 42px);
  font-weight: 400; letter-spacing: -0.01em;
  line-height: 1.25; max-width: 700px; margin: 0;
}

/* Bouton principal */
.btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font-display); font-size: 14px; font-weight: 600;
  color: var(--clr-off-white); background: var(--clr-primary);
  border: 1px solid var(--clr-primary); border-radius: var(--radius-pill);
  padding: 14px 28px; transition: var(--transition-fast);
  text-decoration: none; cursor: pointer;
}
.btn-primary:hover {
  background: var(--clr-primary-dark);
  border-color: var(--clr-primary-dark);
}

/* Responsive CTA */
@media (max-width: 940px) {
  .cta-dark { flex-direction: column; align-items: flex-start; }
}
```

---

## 4. Séparateurs visuels

Les séparateurs entre sections doivent utiliser la classe `.divider` :

```css
.divider {
  border: none;
  border-top: 1px solid var(--clr-stroke-light);
  margin: 0;
}
```

---

## 5. Animations de scroll (optionnel)

Pour une expérience premium, ajouter des animations d'apparition au scroll :

```css
[data-reveal] {
  opacity: 0; transform: translateY(24px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}
[data-reveal].is-visible { opacity: 1; transform: translateY(0); }
[data-reveal-delay="1"] { transition-delay: 0.1s; }
[data-reveal-delay="2"] { transition-delay: 0.2s; }
[data-reveal-delay="3"] { transition-delay: 0.3s; }
```

```js
// Script d'activation des animations au scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(el => {
    if (el.isIntersecting) el.target.classList.add('is-visible');
  });
}, { threshold: 0.1 });

document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
```

Ajouter `data-reveal` et `data-reveal-delay="1"` (ou 2, 3...) aux éléments que vous souhaitez animer.

---

## 6. Checklist d'implémentation

Voici les éléments à vérifier avant de considérer la mise à jour comme terminée :

| Élément | Statut cible |
| :--- | :--- |
| Variables CSS `:root` déclarées | Obligatoire |
| Polices Syne et Playfair Display importées | Obligatoire |
| Fond de page `--clr-ecru-bg` appliqué | Obligatoire |
| Badge "Ouvert à la souscription" stylisé | Obligatoire |
| Tags de catégories en pills | Obligatoire |
| Titre H1 en police Syne weight 300 | Obligatoire |
| KV Grid avec 4 colonnes (2 sur mobile) | Obligatoire |
| Points forts / attention en grille 2 colonnes | Obligatoire |
| Bouton CTA en forme de pilule verte | Obligatoire |
| Section CTA sur fond obsidian | Recommandé |
| Animations scroll reveal | Optionnel |
| Responsive mobile (breakpoints 940px et 768px) | Obligatoire |

---

## 7. Références

- **Design System de référence :** [anaxago-patrimony-ds4.surge.sh](https://anaxago-patrimony-ds4.surge.sh/)
- **Page à mettre à jour :** [souscription-anaxago-anaxago.vercel.app/souscrire/axvaluegestionlibre](https://souscription-anaxago-anaxago.vercel.app/souscrire/axvaluegestionlibre)
- **CSS source du DS :** `https://anaxago-patrimony-ds4.surge.sh/style.css`
