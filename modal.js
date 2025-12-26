/**
 * Système de modales personnalisées
 * Remplace les dialogues natifs alert(), confirm(), prompt()
 * Compatible avec le thème light/dark
 */

// Créer le conteneur de modales immédiatement ou au chargement
(function() {
    function createOverlay() {
        if (!document.getElementById('modal-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'modal-overlay';
            overlay.className = 'modal-overlay';
            document.body.appendChild(overlay);
        }
    }
    
    // Si le DOM est déjà chargé, créer immédiatement
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createOverlay);
    } else {
        // DOM déjà chargé (script chargé à la fin du body)
        createOverlay();
    }
})();

/**
 * Alert personnalisé
 * @param {string} message - Le message à afficher
 * @returns {Promise<void>}
 */
window.customAlert = function(message) {
    return new Promise((resolve) => {
        const overlay = getOrCreateOverlay();
        
        // Vider l'overlay avant d'ajouter une nouvelle modale
        overlay.innerHTML = '';
        overlay.classList.remove('show');
        
        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        modal.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow: visible;
            border: 2px solid #dee2e6;
            opacity: 1;
        `;
        modal.innerHTML = `
            <div class="modal-header" style="padding: 20px 24px; background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
                <h3 style="margin: 0; font-size: 1.4em; font-weight: 700; color: #ffffff; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);">Information</h3>
            </div>
            <div class="modal-body" style="padding: 24px; background: white; color: #212529; max-height: calc(90vh - 200px); overflow-y: auto;">
                <p style="margin: 0; line-height: 1.6; font-size: 1.05em;">${escapeHtml(message).replace(/\n/g, '<br>')}</p>
            </div>
            <div class="modal-footer" style="padding: 20px 24px; background: #f8f9fa; border-top: 1px solid #dee2e6; display: flex; gap: 12px; justify-content: flex-end;">
                <button class="modal-btn modal-btn-primary" id="modal-ok" style="padding: 12px 28px; border: none; border-radius: 6px; font-size: 1em; font-weight: 600; cursor: pointer; min-width: 100px; background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);">OK</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        
        // Montrer l'overlay
        overlay.style.display = 'flex';
        overlay.style.opacity = '0';
        overlay.style.visibility = 'visible';
        
        // Force un reflow avant d'ajouter la classe show
        void overlay.offsetWidth;
        
        // Petit délai pour s'assurer que les styles sont appliqués
        requestAnimationFrame(() => {
            overlay.classList.add('show');
            overlay.style.opacity = '1';
        });
        
        // Focus sur le bouton
        setTimeout(() => document.getElementById('modal-ok')?.focus(), 100);
        
        const closeModal = () => {
            closeOverlay(overlay, resolve);
        };
        
        const okBtn = document.getElementById('modal-ok');
        okBtn.style.transition = 'all 0.2s ease';
        okBtn.onclick = closeModal;
        okBtn.onmouseover = () => {
            okBtn.style.transform = 'translateY(-2px)';
            okBtn.style.boxShadow = '0 5px 20px rgba(0, 123, 255, 0.4)';
        };
        okBtn.onmouseout = () => {
            okBtn.style.transform = 'translateY(0)';
            okBtn.style.boxShadow = '0 2px 8px rgba(0, 123, 255, 0.3)';
        };
        
        // Fermer avec Escape ou Enter
        const handleKey = (e) => {
            if (e.key === 'Escape' || e.key === 'Enter') {
                closeModal();
                document.removeEventListener('keydown', handleKey);
            }
        };
        document.addEventListener('keydown', handleKey);
    });
};

/**
 * Confirm personnalisé
 * @param {string} message - Le message à afficher
 * @returns {Promise<boolean>}
 */
window.customConfirm = function(message) {
    return new Promise((resolve) => {
        const overlay = getOrCreateOverlay();
        
        // Vider l'overlay avant d'ajouter une nouvelle modale
        overlay.innerHTML = '';
        overlay.classList.remove('show');
        
        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        modal.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow: visible;
            border: 2px solid #dee2e6;
            opacity: 1;
        `;
        modal.innerHTML = `
            <div class="modal-header modal-header-warning" style="padding: 20px 24px; background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
                <h3 style="margin: 0; font-size: 1.4em; font-weight: 700; color: #ffffff; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);">⚠️ Confirmation</h3>
            </div>
            <div class="modal-body" style="padding: 24px; background: white; color: #212529; max-height: calc(90vh - 200px); overflow-y: auto;">
                <p style="margin: 0; line-height: 1.6; font-size: 1.05em;">${escapeHtml(message).replace(/\n/g, '<br>')}</p>
            </div>
            <div class="modal-footer" style="padding: 20px 24px; background: #f8f9fa; border-top: 1px solid #dee2e6; display: flex; gap: 12px; justify-content: flex-end;">
                <button class="modal-btn modal-btn-secondary" id="modal-cancel" style="padding: 12px 28px; border: none; border-radius: 6px; font-size: 1em; font-weight: 600; cursor: pointer; min-width: 100px; background: #6c757d; color: white; border: 2px solid #6c757d;">Annuler</button>
                <button class="modal-btn modal-btn-primary" id="modal-confirm" style="padding: 12px 28px; border: none; border-radius: 6px; font-size: 1em; font-weight: 600; cursor: pointer; min-width: 100px; background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);">Confirmer</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        
        // Montrer l'overlay
        overlay.style.display = 'flex';
        overlay.style.opacity = '0';
        overlay.style.visibility = 'visible';
        
        // Force un reflow avant d'ajouter la classe show
        void overlay.offsetWidth;
        
        // Petit délai pour s'assurer que les styles sont appliqués
        requestAnimationFrame(() => {
            overlay.classList.add('show');
            overlay.style.opacity = '1';
        });
        
        // Focus sur le bouton confirmer
        setTimeout(() => document.getElementById('modal-confirm')?.focus(), 100);
        
        const closeModal = (result) => {
            closeOverlay(overlay, () => resolve(result));
        };
        
        const cancelBtn = document.getElementById('modal-cancel');
        const confirmBtn = document.getElementById('modal-confirm');
        
        cancelBtn.style.transition = 'all 0.2s ease';
        confirmBtn.style.transition = 'all 0.2s ease';
        
        cancelBtn.onclick = () => closeModal(false);
        confirmBtn.onclick = () => closeModal(true);
        
        // Effets hover
        cancelBtn.onmouseover = () => {
            cancelBtn.style.background = '#5a6268';
            cancelBtn.style.transform = 'translateY(-1px)';
        };
        cancelBtn.onmouseout = () => {
            cancelBtn.style.background = '#6c757d';
            cancelBtn.style.transform = 'translateY(0)';
        };
        
        confirmBtn.onmouseover = () => {
            confirmBtn.style.transform = 'translateY(-2px)';
            confirmBtn.style.boxShadow = '0 5px 20px rgba(0, 123, 255, 0.4)';
        };
        confirmBtn.onmouseout = () => {
            confirmBtn.style.transform = 'translateY(0)';
            confirmBtn.style.boxShadow = '0 2px 8px rgba(0, 123, 255, 0.3)';
        };
        
        // Fermer avec Escape (annuler) ou Enter (confirmer)
        const handleKey = (e) => {
            if (e.key === 'Escape') {
                closeModal(false);
                document.removeEventListener('keydown', handleKey);
            } else if (e.key === 'Enter') {
                closeModal(true);
                document.removeEventListener('keydown', handleKey);
            }
        };
        document.addEventListener('keydown', handleKey);
    });
};

/**
 * Prompt personnalisé
 * @param {string} message - Le message à afficher
 * @param {string} defaultValue - Valeur par défaut (optionnel)
 * @returns {Promise<string|null>} - La valeur saisie ou null si annulé
 */
window.customPrompt = function(message, defaultValue = '') {
    return new Promise((resolve) => {
        const overlay = getOrCreateOverlay();
        
        // Vider l'overlay avant d'ajouter une nouvelle modale
        overlay.innerHTML = '';
        overlay.classList.remove('show');
        
        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        modal.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow: visible;
            border: 2px solid #dee2e6;
            opacity: 1;
        `;
        modal.innerHTML = `
            <div class="modal-header" style="padding: 20px 24px; background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
                <h3 style="margin: 0; font-size: 1.4em; font-weight: 700; color: #ffffff; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);">Saisie</h3>
            </div>
            <div class="modal-body" style="padding: 24px; background: white; color: #212529; max-height: calc(90vh - 200px); overflow-y: auto;">
                <p style="margin: 0 0 16px 0; line-height: 1.6; font-size: 1.05em;">${escapeHtml(message).replace(/\n/g, '<br>')}</p>
                <input type="text" id="modal-input" class="modal-input" value="${escapeHtml(defaultValue)}" style="width: 100%; padding: 12px 16px; border: 2px solid #ced4da; border-radius: 6px; font-size: 1em; font-family: inherit; background: white; color: #212529;">
            </div>
            <div class="modal-footer" style="padding: 20px 24px; background: #f8f9fa; border-top: 1px solid #dee2e6; display: flex; gap: 12px; justify-content: flex-end;">
                <button class="modal-btn modal-btn-secondary" id="modal-cancel" style="padding: 12px 28px; border: none; border-radius: 6px; font-size: 1em; font-weight: 600; cursor: pointer; min-width: 100px; background: #6c757d; color: white; border: 2px solid #6c757d;">Annuler</button>
                <button class="modal-btn modal-btn-primary" id="modal-ok" style="padding: 12px 28px; border: none; border-radius: 6px; font-size: 1em; font-weight: 600; cursor: pointer; min-width: 100px; background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);">OK</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        
        // Montrer l'overlay
        overlay.style.display = 'flex';
        overlay.style.opacity = '0';
        overlay.style.visibility = 'visible';
        
        // Force un reflow avant d'ajouter la classe show
        void overlay.offsetWidth;
        
        // Petit délai pour s'assurer que les styles sont appliqués
        requestAnimationFrame(() => {
            overlay.classList.add('show');
            overlay.style.opacity = '1';
        });
        
        // Focus et sélection du texte
        setTimeout(() => {
            const input = document.getElementById('modal-input');
            input?.focus();
            input?.select();
            
            input.style.transition = 'border-color 0.3s ease, box-shadow 0.3s ease';
            
            // Effets focus
            input.onfocus = () => {
                input.style.borderColor = '#007bff';
                input.style.boxShadow = '0 0 0 4px rgba(0, 123, 255, 0.15)';
            };
            input.onblur = () => {
                input.style.borderColor = '#ced4da';
                input.style.boxShadow = 'none';
            };
        }, 100);
        
        const closeModal = (result) => {
            closeOverlay(overlay, () => resolve(result));
        };
        
        const cancelBtn = document.getElementById('modal-cancel');
        const okBtn = document.getElementById('modal-ok');
        
        cancelBtn.style.transition = 'all 0.2s ease';
        okBtn.style.transition = 'all 0.2s ease';
        
        cancelBtn.onclick = () => closeModal(null);
        okBtn.onclick = () => {
            const value = document.getElementById('modal-input').value;
            closeModal(value);
        };
        
        // Effets hover
        cancelBtn.onmouseover = () => {
            cancelBtn.style.background = '#5a6268';
            cancelBtn.style.transform = 'translateY(-1px)';
        };
        cancelBtn.onmouseout = () => {
            cancelBtn.style.background = '#6c757d';
            cancelBtn.style.transform = 'translateY(0)';
        };
        
        okBtn.onmouseover = () => {
            okBtn.style.transform = 'translateY(-2px)';
            okBtn.style.boxShadow = '0 5px 20px rgba(0, 123, 255, 0.4)';
        };
        okBtn.onmouseout = () => {
            okBtn.style.transform = 'translateY(0)';
            okBtn.style.boxShadow = '0 2px 8px rgba(0, 123, 255, 0.3)';
        };
        
        // Fermer avec Escape (annuler) ou Enter (valider)
        const handleKey = (e) => {
            if (e.key === 'Escape') {
                closeModal(null);
                document.removeEventListener('keydown', handleKey);
            } else if (e.key === 'Enter') {
                const value = document.getElementById('modal-input').value;
                closeModal(value);
                document.removeEventListener('keydown', handleKey);
            }
        };
        document.addEventListener('keydown', handleKey);
    });
};

// Fonctions utilitaires

function closeOverlay(overlay, callback) {
    overlay.classList.remove('show');
    overlay.style.opacity = '0';
    overlay.style.visibility = 'hidden';
    setTimeout(() => {
        overlay.innerHTML = '';
        overlay.style.display = 'none';
        if (callback) callback();
    }, 300);
}

function getOrCreateOverlay() {
    let overlay = document.getElementById('modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.className = 'modal-overlay';
        document.body.appendChild(overlay);
    }
    
    // Force TOUJOURS les styles, même si l'overlay existe déjà
    overlay.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        margin: 0 !important;
        padding: 0 !important;
        z-index: 10000 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: rgba(0, 0, 0, 0.75) !important;
        backdrop-filter: blur(6px) !important;
    `;
    
    return overlay;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Remplacer les fonctions natives (optionnel - à activer avec window.useCustomModals = true)
if (window.useCustomModals) {
    window.alert = window.customAlert;
    window.confirm = window.customConfirm;
    window.prompt = window.customPrompt;
}

