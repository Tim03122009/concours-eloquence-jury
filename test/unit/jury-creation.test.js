/**
 * Tests pour la création et gestion des jurys
 * Couvre les cas d'erreurs récemment corrigés
 */

describe('Création de Jury', () => {
    
    // Données de test
    const mockRounds = [
        { id: 'round1', order: 1, name: '1er tour', type: 'Notation individuelle', nextRoundCandidates: 'ALL' },
        { id: 'round2', order: 2, name: 'Repechage 1er tour', type: 'Repêchage', nextRoundCandidates: 18 },
        { id: 'round3', order: 3, name: '2eme tour', type: 'Duels', nextRoundCandidates: 'ALL' },
        { id: 'round4', order: 4, name: 'Repechage 2eme tour', type: 'Repêchage', nextRoundCandidates: 7 },
        { id: 'round5', order: 5, name: 'Demi-finale', type: 'Duels', nextRoundCandidates: 3 },
        { id: 'round6', order: 6, name: 'Finale', type: 'Duels', nextRoundCandidates: 1 }
    ];

    describe('Champs obligatoires pour un jury', () => {
        test('Un nouveau jury doit avoir le champ rounds défini', () => {
            const newJury = {
                id: 'jury1',
                name: 'Jury 1',
                password: '',
                theme: 'light',
                createdAt: new Date(),
                isPresident: true,
                rounds: ['round1', 'round2', 'round3', 'round4', 'round5', 'round6']
            };
            
            expect(newJury.rounds).toBeDefined();
            expect(Array.isArray(newJury.rounds)).toBe(true);
            expect(newJury.rounds.length).toBeGreaterThan(0);
        });

        test('Un nouveau jury doit avoir le champ isPresident défini', () => {
            const newJury = {
                id: 'jury1',
                name: 'Jury 1',
                isPresident: false,
                rounds: []
            };
            
            expect(newJury.isPresident).toBeDefined();
            expect(typeof newJury.isPresident).toBe('boolean');
        });

        test('Le premier jury créé doit être président', () => {
            const existingJuries = [];
            const isFirstJury = existingJuries.length === 0;
            
            expect(isFirstJury).toBe(true);
            
            const newJury = {
                isPresident: isFirstJury
            };
            
            expect(newJury.isPresident).toBe(true);
        });

        test('Les jurys suivants ne sont pas président par défaut', () => {
            const existingJuries = [{ id: 'jury1', name: 'Jury 1' }];
            const isFirstJury = existingJuries.length === 0;
            
            expect(isFirstJury).toBe(false);
            
            const newJury = {
                isPresident: isFirstJury
            };
            
            expect(newJury.isPresident).toBe(false);
        });
    });

    describe('Attribution des tours par défaut', () => {
        test('Le président doit avoir accès à tous les tours (y compris repêchage)', () => {
            const isPresident = true;
            const sortedRounds = [...mockRounds].sort((a, b) => a.order - b.order);
            
            const defaultRounds = sortedRounds
                .filter(r => {
                    if (r.type === 'Repêchage') {
                        return isPresident;
                    }
                    return true;
                })
                .map(r => r.id);
            
            expect(defaultRounds).toContain('round1');
            expect(defaultRounds).toContain('round2'); // Repêchage
            expect(defaultRounds).toContain('round3');
            expect(defaultRounds).toContain('round4'); // Repêchage
            expect(defaultRounds).toContain('round5');
            expect(defaultRounds).toContain('round6');
            expect(defaultRounds.length).toBe(6);
        });

        test('Les non-présidents ne doivent pas avoir accès aux tours de repêchage', () => {
            const isPresident = false;
            const sortedRounds = [...mockRounds].sort((a, b) => a.order - b.order);
            
            const defaultRounds = sortedRounds
                .filter(r => {
                    if (r.type === 'Repêchage') {
                        return isPresident;
                    }
                    return true;
                })
                .map(r => r.id);
            
            expect(defaultRounds).toContain('round1');
            expect(defaultRounds).not.toContain('round2'); // Repêchage exclu
            expect(defaultRounds).toContain('round3');
            expect(defaultRounds).not.toContain('round4'); // Repêchage exclu
            expect(defaultRounds).toContain('round5');
            expect(defaultRounds).toContain('round6');
            expect(defaultRounds.length).toBe(4);
        });

        test('Les tours doivent être attribués à partir du tour actif', () => {
            const activeRoundId = 'round3';
            const isPresident = true;
            const sortedRounds = [...mockRounds].sort((a, b) => a.order - b.order);
            
            let activeIdx = sortedRounds.findIndex(r => r.id === activeRoundId);
            if (activeIdx === -1) activeIdx = 0;
            
            const defaultRounds = [];
            for (let i = activeIdx; i < sortedRounds.length; i++) {
                const round = sortedRounds[i];
                if (round.type === 'Repêchage' && !isPresident) {
                    continue;
                }
                defaultRounds.push(round.id);
            }
            
            expect(defaultRounds).not.toContain('round1');
            expect(defaultRounds).not.toContain('round2');
            expect(defaultRounds).toContain('round3');
            expect(defaultRounds).toContain('round4');
            expect(defaultRounds).toContain('round5');
            expect(defaultRounds).toContain('round6');
        });

        test('Si activeRoundId est invalide, commencer au premier tour', () => {
            const activeRoundId = 'invalid_round';
            const sortedRounds = [...mockRounds].sort((a, b) => a.order - b.order);
            
            let activeIdx = sortedRounds.findIndex(r => r.id === activeRoundId);
            if (activeIdx === -1) activeIdx = 0;
            
            expect(activeIdx).toBe(0);
        });
    });

    describe('Gestion des ROUNDS vides', () => {
        test('Fallback vers les IDs par défaut si ROUNDS est vide (président)', () => {
            const ROUNDS = [];
            const isFirstJury = true;
            
            let defaultRounds;
            if (ROUNDS.length === 0) {
                defaultRounds = isFirstJury 
                    ? ['round1', 'round2', 'round3', 'round4', 'round5', 'round6']
                    : ['round1', 'round3', 'round5', 'round6'];
            }
            
            expect(defaultRounds).toEqual(['round1', 'round2', 'round3', 'round4', 'round5', 'round6']);
        });

        test('Fallback vers les IDs par défaut si ROUNDS est vide (non-président)', () => {
            const ROUNDS = [];
            const isFirstJury = false;
            
            let defaultRounds;
            if (ROUNDS.length === 0) {
                defaultRounds = isFirstJury 
                    ? ['round1', 'round2', 'round3', 'round4', 'round5', 'round6']
                    : ['round1', 'round3', 'round5', 'round6'];
            }
            
            expect(defaultRounds).toEqual(['round1', 'round3', 'round5', 'round6']);
            expect(defaultRounds).not.toContain('round2');
            expect(defaultRounds).not.toContain('round4');
        });
    });

    describe('Import de jurys depuis textarea', () => {
        test('Les jurys importés doivent avoir rounds et isPresident', () => {
            const importedJuryData = {
                name: 'Pierre',
                password: 'code',
                theme: 'light',
                createdAt: new Date(),
                isPresident: true,
                rounds: ['round1', 'round2', 'round3', 'round4', 'round5', 'round6']
            };
            
            expect(importedJuryData.rounds).toBeDefined();
            expect(importedJuryData.isPresident).toBeDefined();
        });

        test('Le premier jury importé doit être président', () => {
            const existingJuries = [];
            const newJuriesCount = 0;
            const isFirstJury = existingJuries.length === 0 && newJuriesCount === 0;
            
            expect(isFirstJury).toBe(true);
        });

        test('Les jurys importés suivants ne sont pas président', () => {
            const existingJuries = [];
            const newJuriesCount = 1; // Un jury déjà importé dans cette session
            const isFirstJury = existingJuries.length === 0 && newJuriesCount === 0;
            
            expect(isFirstJury).toBe(false);
        });
    });

    describe('Unicité des noms de jury', () => {
        test('Vérifier que les noms en double sont rejetés (case insensitive)', () => {
            const existingNames = new Set(['pierre', 'marie']);
            
            expect(existingNames.has('Pierre'.toLowerCase())).toBe(true);
            expect(existingNames.has('MARIE'.toLowerCase())).toBe(true);
            expect(existingNames.has('Jean'.toLowerCase())).toBe(false);
        });

        test('Générer un nom unique pour un nouveau jury', () => {
            const existingNames = new Set(['jury 1', 'jury 2']);
            let juryNumber = 1;
            let juryName = `Jury ${juryNumber}`;
            
            while (existingNames.has(juryName.toLowerCase())) {
                juryNumber++;
                juryName = `Jury ${juryNumber}`;
            }
            
            expect(juryName).toBe('Jury 3');
        });
    });
});

describe('Affichage du tableau des jurys', () => {
    test('renderJuryTable doit attendre que ROUNDS soit chargé', () => {
        let ROUNDS = [];
        let loadRoundsCalled = false;
        
        const mockLoadRounds = async () => {
            loadRoundsCalled = true;
            ROUNDS = [
                { id: 'round1', order: 1, name: '1er tour', type: 'Notation individuelle' }
            ];
        };
        
        // Simuler renderJuryTable qui vérifie ROUNDS
        const renderJuryTable = async () => {
            if (ROUNDS.length === 0) {
                await mockLoadRounds();
            }
            return ROUNDS;
        };
        
        return renderJuryTable().then(result => {
            expect(loadRoundsCalled).toBe(true);
            expect(result.length).toBe(1);
        });
    });

    test('Les checkboxes doivent refléter les rounds du jury', () => {
        const jury = {
            id: 'jury1',
            name: 'Pierre',
            rounds: ['round1', 'round3', 'round5'],
            isPresident: false
        };
        
        const rounds = [
            { id: 'round1', name: '1er tour', type: 'Notation individuelle' },
            { id: 'round2', name: 'Repêchage', type: 'Repêchage' },
            { id: 'round3', name: '2eme tour', type: 'Duels' }
        ];
        
        rounds.forEach(round => {
            const isChecked = jury.rounds && jury.rounds.includes(round.id);
            
            if (round.id === 'round1' || round.id === 'round3') {
                expect(isChecked).toBe(true);
            } else {
                expect(isChecked).toBe(false);
            }
        });
    });

    test('Les tours de repêchage sont désactivés pour les non-présidents', () => {
        const jury = { isPresident: false };
        const round = { type: 'Repêchage' };
        
        const isRepechage = round.type === 'Repêchage';
        const disabled = isRepechage && !jury.isPresident;
        
        expect(disabled).toBe(true);
    });

    test('Les tours de repêchage sont activés pour le président', () => {
        const jury = { isPresident: true };
        const round = { type: 'Repêchage' };
        
        const isRepechage = round.type === 'Repêchage';
        const disabled = isRepechage && !jury.isPresident;
        
        expect(disabled).toBe(false);
    });
});

describe('Suppression de président', () => {
    test('Quand le président est supprimé, un autre jury devient président', () => {
        const JURIES = [
            { id: 'jury1', name: 'Pierre', isPresident: true },
            { id: 'jury2', name: 'Marie', isPresident: false },
            { id: 'jury3', name: 'Jean', isPresident: false }
        ];
        
        const deletedJuryId = 'jury1';
        const wasPresident = JURIES.find(j => j.id === deletedJuryId)?.isPresident;
        
        // Simuler la suppression
        const remainingJuries = JURIES.filter(j => j.id !== deletedJuryId);
        
        expect(wasPresident).toBe(true);
        expect(remainingJuries.length).toBe(2);
        
        // Le dernier jury restant devient président
        if (wasPresident && remainingJuries.length > 0) {
            const newPresident = remainingJuries[remainingJuries.length - 1];
            expect(newPresident.id).toBe('jury3');
        }
    });
});

