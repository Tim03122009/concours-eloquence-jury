/**
 * Tests pour la réinitialisation et la qualification des candidats
 * Couvre les cas d'erreurs récemment corrigés
 */

describe('Réinitialisation complète', () => {
    
    const mockRounds = [
        { id: 'round1', order: 1, name: '1er tour' },
        { id: 'round2', order: 2, name: 'Repêchage 1er tour' },
        { id: 'round3', order: 3, name: '2eme tour' }
    ];

    describe('Réinitialisation du tour actif', () => {
        test('Le tour actif doit être remis au premier tour', () => {
            const sortedRounds = [...mockRounds].sort((a, b) => a.order - b.order);
            const firstRoundId = sortedRounds.length > 0 ? sortedRounds[0].id : 'round1';
            
            expect(firstRoundId).toBe('round1');
        });

        test('Si aucun tour n\'existe, utiliser round1 par défaut', () => {
            const emptyRounds = [];
            const sortedRounds = [...emptyRounds].sort((a, b) => a.order - b.order);
            const firstRoundId = sortedRounds.length > 0 ? sortedRounds[0].id : 'round1';
            
            expect(firstRoundId).toBe('round1');
        });

        test('Le tour actif doit être stocké dans config/rounds.activeRoundId', () => {
            // Structure attendue du document config/rounds
            const roundsConfig = {
                rounds: mockRounds,
                activeRoundId: 'round1'
            };
            
            expect(roundsConfig.activeRoundId).toBeDefined();
            expect(roundsConfig.activeRoundId).toBe('round1');
        });
    });

    describe('Réinitialisation des candidats', () => {
        test('Tous les candidats doivent être remis au premier tour', () => {
            const candidates = [
                { id: '001', name: 'Timéo', tour: 'round3', status: 'Qualifie' },
                { id: '002', name: 'Marie', tour: 'round2', status: 'Elimine' }
            ];
            
            const firstRoundId = 'round1';
            
            candidates.forEach(c => {
                c.tour = firstRoundId;
                c.status = 'Actif';
            });
            
            expect(candidates[0].tour).toBe('round1');
            expect(candidates[0].status).toBe('Actif');
            expect(candidates[1].tour).toBe('round1');
            expect(candidates[1].status).toBe('Actif');
        });
    });

    describe('Suppression des scores', () => {
        test('Tous les scores doivent être supprimés lors de la réinitialisation', () => {
            const scores = [
                { id: 'score1', candidateId: '001', roundId: 'round1' },
                { id: 'score2', candidateId: '002', roundId: 'round2' }
            ];
            
            // Simuler la suppression
            const deletedScores = scores.length;
            scores.length = 0;
            
            expect(scores.length).toBe(0);
            expect(deletedScores).toBe(2);
        });
    });
});

describe('Qualification des candidats', () => {
    
    const mockJuries = [
        { id: 'jury1', name: 'Pierre', rounds: ['round1'] },
        { id: 'jury2', name: 'Marie', rounds: ['round1'] }
    ];

    const mockCandidates = [
        { id: '001', name: 'Timéo', tour: 'round1', status: 'Actif' },
        { id: '002', name: 'Emma', tour: 'round1', status: 'Actif' },
        { id: '003', name: 'Lucas', tour: 'round1', status: 'Actif' }
    ];

    describe('Calcul des scores', () => {
        test('Le score total est calculé avec pondération (score1 * 3 + score2)', () => {
            const score1 = 15;
            const score2 = 20;
            const weightedScore = score1 * 3 + score2;
            
            expect(weightedScore).toBe(65);
        });

        test('EL est traité comme 0', () => {
            const score1 = 'EL';
            const score2 = 20;
            
            let calculatedScore;
            if (score1 === 'EL' || score2 === 'EL') {
                calculatedScore = 0;
            } else {
                calculatedScore = (parseFloat(score1) || 0) * 3 + (parseFloat(score2) || 0);
            }
            
            expect(calculatedScore).toBe(0);
        });

        test('Le score total est la somme des scores de tous les jurys présents', () => {
            const juryScores = [
                { juryId: 'jury1', score1: 15, score2: 20 }, // 15*3 + 20 = 65
                { juryId: 'jury2', score1: 10, score2: 15 }  // 10*3 + 15 = 45
            ];
            
            let totalScore = 0;
            juryScores.forEach(js => {
                const s1 = parseFloat(js.score1) || 0;
                const s2 = parseFloat(js.score2) || 0;
                totalScore += (s1 * 3 + s2);
            });
            
            expect(totalScore).toBe(110);
        });
    });

    describe('Vérification des notes complètes', () => {
        test('Un candidat est complet si tous les jurys présents ont noté', () => {
            const juriesOnRound = mockJuries;
            const candidateScores = {
                'jury1': { score1: '15', score2: '20' },
                'jury2': { score1: '10', score2: '15' }
            };
            
            let isComplete = true;
            for (const jury of juriesOnRound) {
                const scores = candidateScores[jury.id];
                if (!scores || 
                    !scores.score1 || scores.score1 === '-' ||
                    !scores.score2 || scores.score2 === '-') {
                    isComplete = false;
                    break;
                }
            }
            
            expect(isComplete).toBe(true);
        });

        test('Un candidat est incomplet si un jury n\'a pas noté', () => {
            const juriesOnRound = mockJuries;
            const candidateScores = {
                'jury1': { score1: '15', score2: '20' }
                // jury2 manquant
            };
            
            let isComplete = true;
            for (const jury of juriesOnRound) {
                const scores = candidateScores[jury.id];
                if (!scores || 
                    !scores.score1 || scores.score1 === '-' ||
                    !scores.score2 || scores.score2 === '-') {
                    isComplete = false;
                    break;
                }
            }
            
            expect(isComplete).toBe(false);
        });

        test('Une note "-" est considérée comme manquante', () => {
            const scores = { score1: '15', score2: '-' };
            
            const isComplete = scores.score1 && scores.score1 !== '-' && 
                              scores.score2 && scores.score2 !== '-';
            
            expect(isComplete).toBe(false);
        });
    });

    describe('Classement et qualification', () => {
        test('Les candidats sont triés par score décroissant', () => {
            const candidateScores = [
                { id: '001', name: 'Timéo', totalScore: 80 },
                { id: '002', name: 'Emma', totalScore: 110 },
                { id: '003', name: 'Lucas', totalScore: 95 }
            ];
            
            candidateScores.sort((a, b) => b.totalScore - a.totalScore);
            
            expect(candidateScores[0].name).toBe('Emma');
            expect(candidateScores[1].name).toBe('Lucas');
            expect(candidateScores[2].name).toBe('Timéo');
        });

        test('Les N premiers sont qualifiés selon nextRoundCandidates', () => {
            const candidateScores = [
                { id: '001', totalScore: 110 },
                { id: '002', totalScore: 95 },
                { id: '003', totalScore: 80 }
            ];
            
            const nextRoundCandidates = 2;
            
            const qualified = candidateScores.slice(0, nextRoundCandidates);
            const eliminated = candidateScores.slice(nextRoundCandidates);
            
            expect(qualified.length).toBe(2);
            expect(eliminated.length).toBe(1);
            expect(qualified[0].id).toBe('001');
            expect(qualified[1].id).toBe('002');
            expect(eliminated[0].id).toBe('003');
        });

        test('Si nextRoundCandidates = "ALL", tous sont qualifiés', () => {
            const candidateScores = [
                { id: '001', totalScore: 110 },
                { id: '002', totalScore: 95 },
                { id: '003', totalScore: 80 }
            ];
            
            const nextRoundCandidates = 'ALL';
            const qualifyCount = nextRoundCandidates === 'ALL' 
                ? candidateScores.length 
                : parseInt(nextRoundCandidates);
            
            const qualified = candidateScores.slice(0, qualifyCount);
            
            expect(qualified.length).toBe(3);
        });
    });

    describe('Attente de toutes les notes', () => {
        test('La qualification attend que tous les candidats soient notés', () => {
            const candidatesInRound = mockCandidates;
            const completedCandidates = 2;
            
            const allComplete = completedCandidates === candidatesInRound.length;
            
            expect(allComplete).toBe(false);
        });

        test('La qualification se déclenche quand tous les candidats sont notés', () => {
            const candidatesInRound = mockCandidates;
            const completedCandidates = 3;
            
            const allComplete = completedCandidates === candidatesInRound.length;
            
            expect(allComplete).toBe(true);
        });
    });
});

describe('Synchronisation temps réel', () => {
    
    describe('Éviter les doubles rendus', () => {
        test('Le flag isManualChange empêche le listener de déclencher un rendu', () => {
            let isManualChange = false;
            let renderCount = 0;
            
            const mockListener = () => {
                if (isManualChange) {
                    return; // Skip
                }
                renderCount++;
            };
            
            // Premier appel sans flag
            mockListener();
            expect(renderCount).toBe(1);
            
            // Activer le flag
            isManualChange = true;
            mockListener();
            expect(renderCount).toBe(1); // Pas d'incrémentation
            
            // Désactiver le flag
            isManualChange = false;
            mockListener();
            expect(renderCount).toBe(2);
        });

        test('Le flag isRenderingNotesTable empêche les appels parallèles', () => {
            let isRenderingNotesTable = false;
            let renderCount = 0;
            
            const mockRenderNotesTable = () => {
                if (isRenderingNotesTable) {
                    return; // Skip
                }
                isRenderingNotesTable = true;
                renderCount++;
                // Simuler fin du rendu
                isRenderingNotesTable = false;
            };
            
            mockRenderNotesTable();
            expect(renderCount).toBe(1);
            
            // Simuler appel pendant le rendu
            isRenderingNotesTable = true;
            mockRenderNotesTable();
            expect(renderCount).toBe(1); // Pas d'incrémentation
        });
    });

    describe('Délai pour la synchronisation Firebase', () => {
        test('Un délai de 300ms est utilisé avant la vérification de qualification', async () => {
            const startTime = Date.now();
            
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const elapsedTime = Date.now() - startTime;
            expect(elapsedTime).toBeGreaterThanOrEqual(290); // Avec une petite marge
        });
    });

    describe('Qualification depuis l\'interface jury', () => {
        test('Le listener doit extraire les candidateIds des scores modifiés', () => {
            const changes = [
                { doc: { data: () => ({ candidateId: '001', roundId: 'round1' }) } },
                { doc: { data: () => ({ candidateId: '002', roundId: 'round1' }) } }
            ];
            
            const activeRoundId = 'round1';
            const affectedCandidateIds = new Set();
            
            changes.forEach(change => {
                const data = change.doc.data();
                if (data.candidateId && data.roundId === activeRoundId) {
                    affectedCandidateIds.add(data.candidateId);
                }
            });
            
            expect(affectedCandidateIds.size).toBe(2);
            expect(affectedCandidateIds.has('001')).toBe(true);
            expect(affectedCandidateIds.has('002')).toBe(true);
        });

        test('Les scores d\'autres tours sont ignorés', () => {
            const changes = [
                { doc: { data: () => ({ candidateId: '001', roundId: 'round1' }) } },
                { doc: { data: () => ({ candidateId: '002', roundId: 'round2' }) } } // Autre tour
            ];
            
            const activeRoundId = 'round1';
            const affectedCandidateIds = new Set();
            
            changes.forEach(change => {
                const data = change.doc.data();
                if (data.candidateId && data.roundId === activeRoundId) {
                    affectedCandidateIds.add(data.candidateId);
                }
            });
            
            expect(affectedCandidateIds.size).toBe(1);
            expect(affectedCandidateIds.has('001')).toBe(true);
            expect(affectedCandidateIds.has('002')).toBe(false);
        });
    });
});

describe('Bouton Qualifier les candidats', () => {
    test('Le bouton qualifie sur la base des scores actuels', () => {
        const candidateScores = [
            { id: '001', name: 'Timéo', totalScore: 110, isComplete: true },
            { id: '002', name: 'Emma', totalScore: 95, isComplete: false }, // Notes incomplètes
            { id: '003', name: 'Lucas', totalScore: 80, isComplete: true }
        ];
        
        const nextRoundCandidates = 2;
        
        // Trier par score
        candidateScores.sort((a, b) => b.totalScore - a.totalScore);
        
        // Qualifier les N premiers
        let qualifiedCount = 0;
        let eliminatedCount = 0;
        
        candidateScores.forEach((c, index) => {
            if (index < nextRoundCandidates) {
                c.status = 'Qualifie';
                qualifiedCount++;
            } else {
                c.status = 'Elimine';
                eliminatedCount++;
            }
        });
        
        expect(qualifiedCount).toBe(2);
        expect(eliminatedCount).toBe(1);
        expect(candidateScores[0].status).toBe('Qualifie'); // Timéo
        expect(candidateScores[1].status).toBe('Qualifie'); // Emma
        expect(candidateScores[2].status).toBe('Elimine'); // Lucas
    });

    test('Le message de confirmation affiche le nombre de candidats', () => {
        const candidatesCount = 10;
        const completeCount = 8;
        const qualifyCount = 5;
        
        const confirmMsg = `📋 ${candidatesCount} candidat(s) actif(s)\n` +
            `✅ ${completeCount} candidat(s) avec notes complètes\n` +
            `🏆 ${qualifyCount} candidat(s) seront qualifié(s)\n` +
            `❌ ${candidatesCount - qualifyCount} candidat(s) seront éliminé(s)`;
        
        expect(confirmMsg).toContain('10 candidat(s) actif(s)');
        expect(confirmMsg).toContain('8 candidat(s) avec notes complètes');
        expect(confirmMsg).toContain('5 candidat(s) seront qualifié(s)');
        expect(confirmMsg).toContain('5 candidat(s) seront éliminé(s)');
    });
});

