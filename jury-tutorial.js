/**
 * Mode tutoriel jury — activé via index.html?tutoriel=1
 * Overlay persistant hors #scoring-page.
 */

const params = new URLSearchParams(window.location.search);
export const isJuryTutorialMode = params.get('tutoriel') === '1';

let defaultPasswordHint = '…';
let phase = null; // 'login' | 'confirm' | 'scoring' | 'done'
let stepIndex = 0;
let resizeBound = false;
let scoringSteps = [];
let pendingReposition = null;
let stabilizeToken = 0;

function ensureRoot() {
    let root = document.getElementById('jury-tutorial-root');
    if (!root) {
        root = document.createElement('div');
        root.id = 'jury-tutorial-root';
        root.setAttribute('aria-live', 'polite');
        document.body.appendChild(root);
    }
    return root;
}

function setInputLock(enabled) {
    document.body.classList.toggle('tutorial-input-lock', !!enabled);
}

function clearChrome() {
    const root = document.getElementById('jury-tutorial-root');
    if (root) root.innerHTML = '';
    // Bouton Suivant monté sur body (hors root) pour rester au premier plan
    document.querySelectorAll('.tutorial-next-btn').forEach((el) => el.remove());
    document.querySelectorAll('.tutorial-target-active').forEach((el) => {
        el.classList.remove('tutorial-target-active');
    });
    setInputLock(false);
}

function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function firstVisible(selectors) {
    for (const sel of selectors) {
        const nodes = typeof sel === 'string' ? document.querySelectorAll(sel) : [sel];
        for (const el of nodes) {
            if (isVisible(el)) return el;
        }
    }
    return null;
}

function syncNextBtnToKeyboard() {
    const btn = document.querySelector('.tutorial-next-btn');
    if (!btn) return;
    const vv = window.visualViewport;
    const base = window.matchMedia('(max-width: 480px)').matches ? 14 : 20;
    if (!vv) {
        btn.style.bottom = `${base}px`;
        return;
    }
    // Remonte le bouton au-dessus du clavier virtuel
    const occluded = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    btn.style.bottom = `${base + occluded}px`;
}

function placeCallout(target, opts = {}) {
    const {
        box = false,
        label = '',
        showNext = false,
        arrowOnly = false,
        stabilize = true,
        onNext = null,
        lock = true
    } = opts;
    clearChrome();
    if (!target) {
        pendingReposition = null;
        return;
    }

    const root = ensureRoot();
    target.classList.add('tutorial-target-active');
    setInputLock(!!lock);

    // Mesurer après style (évite un cadre décalé pendant fadeIn translateY)
    const rect = target.getBoundingClientRect();
    const pad = 6;

    if (box || !arrowOnly) {
        const frame = document.createElement('div');
        frame.className = 'tutorial-box' + (box ? ' tutorial-box--strong' : '');
        frame.style.top = `${Math.max(0, rect.top - pad)}px`;
        frame.style.left = `${Math.max(0, rect.left - pad)}px`;
        frame.style.width = `${rect.width + pad * 2}px`;
        frame.style.height = `${rect.height + pad * 2}px`;
        root.appendChild(frame);
    }

    const callout = document.createElement('div');
    callout.className = 'tutorial-callout';
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < 120 && rect.top > 140;
    if (placeAbove) {
        callout.classList.add('tutorial-callout--above');
        callout.style.top = `${Math.max(8, rect.top - 8)}px`;
    } else {
        callout.style.top = `${rect.bottom + 10}px`;
    }
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - 110), window.innerWidth - 232);
    callout.style.left = `${left}px`;

    callout.innerHTML = `
        <div class="tutorial-arrow-glyph" aria-hidden="true">${placeAbove ? '↓' : '↑'}</div>
        ${label ? `<div class="tutorial-label">${label}</div>` : ''}
    `;
    root.appendChild(callout);

    if (showNext) {
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'tutorial-next-btn';
        next.textContent = 'Suivant';
        next.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof onNext === 'function') onNext();
            else advanceScoring();
        });
        // Sur body (pas dans le root) pour ne jamais passer sous la zone encadrée
        document.body.appendChild(next);
        syncNextBtnToKeyboard();
    }

    const baseOpts = { box, label, showNext, arrowOnly, onNext, lock };
    pendingReposition = () => placeCallout(target, { ...baseOpts, stabilize: false });

    // Recaler après l'animation fadeIn (0.4s) et les décalages de layout (texte du tour, etc.)
    if (stabilize) {
        const token = ++stabilizeToken;
        const restabilize = () => {
            if (token !== stabilizeToken) return;
            if (!target.isConnected) return;
            placeCallout(target, { ...baseOpts, stabilize: false });
        };
        requestAnimationFrame(() => requestAnimationFrame(restabilize));
        setTimeout(restabilize, 120);
        setTimeout(restabilize, 450);
    }
}

/** Recalcule la position du cadre tutoriel (après chargement du tour, etc.). */
export function refreshTutorialPlacement() {
    if (typeof pendingReposition === 'function') pendingReposition();
}

function bindResize() {
    if (resizeBound) return;
    resizeBound = true;
    const onViewportChange = () => {
        syncNextBtnToKeyboard();
        if (pendingReposition) pendingReposition();
    };
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncNextBtnToKeyboard);
        window.visualViewport.addEventListener('scroll', syncNextBtnToKeyboard);
    }
}

async function loadDefaultPassword(fetchFn) {
    try {
        if (typeof fetchFn === 'function') {
            const pwd = await fetchFn();
            if (pwd != null && String(pwd).length) defaultPasswordHint = String(pwd);
        }
    } catch (e) {
        console.warn('tutoriel: mdp défaut indisponible', e);
    }
    if (phase === 'login' && stepIndex === 1) goLoginStep(1);
}

/* ---------- Phase login ---------- */

function goLoginStep(index) {
    phase = 'login';
    stepIndex = index;
    bindResize();

    if (index === 0) {
        const input = document.getElementById('jury-name-input');
        const el = input?.closest('.control-group') || input;
        if (!el) return;
        placeCallout(el, {
            box: true,
            label: 'Précisez si vous êtes le « Jury 1 » ou 2…',
            showNext: true,
            onNext: () => goLoginStep(1)
        });
        try { input?.focus({ preventScroll: true }); } catch (_) { input?.focus(); }
        return;
    }
    if (index === 1) {
        const input = document.getElementById('password-input');
        const el = input?.closest('.control-group') || input;
        if (!el) return;
        placeCallout(el, {
            box: true,
            label: `Remplir le code « ${defaultPasswordHint} » ou, si vous l’avez modifié, le vôtre`,
            showNext: true,
            onNext: () => goLoginStep(2)
        });
        try { input?.focus({ preventScroll: true }); } catch (_) { input?.focus(); }
        return;
    }
    if (index === 2) {
        const el = document.getElementById('start-scoring-button');
        if (!el) return;
        placeCallout(el, {
            box: true,
            arrowOnly: false,
            label: 'Appuyez sur Commencer',
            showNext: true,
            onNext: () => {
                // Masque le tutoriel jusqu'au clic sur Commencer (formulaire libre)
                clearChrome();
                pendingReposition = null;
                phase = 'login-waiting';
                stepIndex = 2;
            }
        });
    }
}

export function onIdentificationShown() {
    if (!isJuryTutorialMode) return;
    goLoginStep(0);
}

export function onNewAccountConfirmShown() {
    if (!isJuryTutorialMode) return;
    phase = 'confirm';
    bindResize();
    const tryHighlight = (attempt = 0) => {
        const btn = document.getElementById('modal-confirm');
        if (btn && isVisible(btn)) {
            placeCallout(btn, {
                box: true,
                arrowOnly: false,
                label: 'Confirmez la création du compte'
            });
            return;
        }
        if (attempt < 20) setTimeout(() => tryHighlight(attempt + 1), 50);
    };
    tryHighlight();
}

export function onNewAccountConfirmClosed() {
    if (!isJuryTutorialMode) return;
    clearChrome();
    pendingReposition = null;
}

/** Reprendre le tutoriel login sur « Commencer » (ex. annulation création de compte). */
export function resumeLoginTutorialAtCommencer() {
    if (!isJuryTutorialMode) return;
    goLoginStep(2);
}

/* ---------- Phase scoring ---------- */

function resolveFirstTab() {
    return firstVisible(['#scoring-page .jury-tab-btn']);
}

function resolveCandidateSelect() {
    return firstVisible([
        '#scoring-page .jury-tab-content.active select',
        '#scoring-page select#candidate-select',
        '#scoring-page select#candidate-select-1',
        '#scoring-page select[id^="candidate-select"]',
        '#scoring-page select'
    ]);
}

function resolveNotesZone() {
    return firstVisible([
        '#scoring-page .jury-tab-content.active .notes-layout-board',
        '#scoring-page .notes-layout-board',
        '#scoring-page .jury-tab-content.active .score-grid',
        '#scoring-page .score-grid',
        '#scoring-page .jury-notation-card .control-group',
        '#scoring-page #grid-fond',
        '#scoring-page .choix-person-row'
    ]);
}

function resolveValidateButton() {
    return firstVisible([
        '#scoring-page .jury-tab-content.active .jury-notation-validate',
        '#scoring-page .jury-tab-content.active #validate-button',
        '#scoring-page #validate-button',
        '#scoring-page .jury-notation-validate',
        '#scoring-page #repechage-validate-button',
        '#scoring-page #duel-validate-button',
        '#scoring-page button[id*="validate"]'
    ]);
}

function resolveHelpButton() {
    return firstVisible([
        '#scoring-page .jury-help-btn',
        '.jury-help-btn'
    ]);
}

function openBurgerMenu() {
    const menu = document.getElementById('menu-content-scoring')
        || document.querySelector('#scoring-page .burger-menu-content');
    if (menu) menu.classList.add('active');
    return menu;
}

function closeBurgerMenu() {
    document.querySelectorAll('#scoring-page .burger-menu-content, #menu-content-scoring').forEach((m) => {
        m.classList.remove('active');
    });
}

function listMenuItemElements() {
    const menu = document.getElementById('menu-content-scoring')
        || document.querySelector('#scoring-page .burger-menu-content');
    if (!menu) return [];
    return Array.from(menu.querySelectorAll(':scope > .theme-toggle, :scope > .menu-item'));
}

function collectMenuItems() {
    openBurgerMenu();
    return listMenuItemElements();
}

function menuItemLabel(el) {
    if (!el) return 'Menu';
    if (el.classList.contains('theme-toggle')) return 'Mode sombre — change l’apparence de l’interface';
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (/Rafraîchir/i.test(text)) return 'Rafraîchir la liste des candidats';
    if (/Synchroniser/i.test(text)) return 'Synchroniser avec l’admin';
    if (/mot de passe/i.test(text)) return 'Changer votre mot de passe';
    if (/Déconnexion/i.test(text)) return 'Se déconnecter';
    return text || 'Option du menu';
}

function buildScoringSteps() {
    const steps = [];

    const tab = resolveFirstTab();
    if (tab) {
        const name = (tab.textContent || 'Onglet').trim();
        steps.push({
            id: 'tab',
            resolve: () => resolveFirstTab(),
            box: false,
            label: `Onglet « ${name} » — changez d’écran ici`
        });
    }

    steps.push({
        id: 'candidates',
        resolve: () => resolveCandidateSelect(),
        box: true,
        label: 'Choisir le candidat à noter',
        optional: true
    });

    steps.push({
        id: 'notes',
        resolve: () => resolveNotesZone(),
        box: false,
        label: 'Saisir les notes ici',
        optional: true
    });

    steps.push({
        id: 'validate',
        resolve: () => resolveValidateButton(),
        box: true,
        label: 'Valider la notation',
        optional: true
    });

    steps.push({
        id: 'help',
        resolve: () => resolveHelpButton(),
        box: false,
        label: 'Contacter l’organisation en cas de problème'
    });

    const menuItems = listMenuItemElements();
    menuItems.forEach((item, i) => {
        steps.push({
            id: `menu-${i}`,
            resolve: () => {
                const items = collectMenuItems();
                return items[i] || null;
            },
            box: true,
            label: menuItemLabel(item),
            openMenu: true
        });
    });

    return steps;
}

function showScoringStep(index) {
    phase = 'scoring';
    stepIndex = index;
    bindResize();

    while (index < scoringSteps.length) {
        const step = scoringSteps[index];
        const el = step.resolve();
        if (!el && step.optional) {
            index += 1;
            stepIndex = index;
            continue;
        }
        if (!el) {
            index += 1;
            stepIndex = index;
            continue;
        }
        if (step.openMenu) openBurgerMenu();
        placeCallout(el, {
            box: !!step.box,
            label: step.label,
            showNext: true
        });
        return;
    }
    finishTutorial();
}

function advanceScoring() {
    if (phase !== 'scoring') return;
    showScoringStep(stepIndex + 1);
}

function finishTutorial() {
    phase = 'done';
    closeBurgerMenu();
    clearChrome();
    pendingReposition = null;
    const root = document.getElementById('jury-tutorial-root');
    if (root) root.remove();
    // Session conservée ; quitter le mode tutoriel
    window.location.replace('index.html');
}

export function onScoringInterfaceReady() {
    if (!isJuryTutorialMode) return;
    if (phase === 'done') return;

    // Rebuild steps when UI is ready (or re-rendered)
    const wasScoring = phase === 'scoring';
    const prevId = wasScoring && scoringSteps[stepIndex] ? scoringSteps[stepIndex].id : null;

    scoringSteps = buildScoringSteps();

    if (!wasScoring) {
        // Coming from login / auto-session
        clearChrome();
        showScoringStep(0);
        return;
    }

    // Re-attach current step after UI rewrite
    let idx = scoringSteps.findIndex((s) => s.id === prevId);
    if (idx < 0) idx = Math.min(stepIndex, scoringSteps.length - 1);
    if (idx < 0) idx = 0;
    showScoringStep(idx);
}

/**
 * @param {{ fetchDefaultPassword?: () => Promise<string> }} options
 */
export function initJuryTutorial(options = {}) {
    if (!isJuryTutorialMode) return;
    ensureRoot();
    bindResize();
    loadDefaultPassword(options.fetchDefaultPassword);
    window.__juryTutorial = {
        onNewAccountConfirmShown,
        onNewAccountConfirmClosed,
        isActive: () => isJuryTutorialMode && phase !== 'done'
    };
    window.__juryTutorialResumeLogin = resumeLoginTutorialAtCommencer;
}
