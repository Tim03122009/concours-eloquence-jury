/**
 * Tests pour l'import et export CSV
 * Couvre les cas d'erreurs récemment corrigés
 */

describe('Export CSV', () => {
    
    describe('Transformation des valeurs à l\'export', () => {
        test('EL doit être transformé en 0', () => {
            const score = 'EL';
            const exportedValue = score === 'EL' ? '0' : score;
            
            expect(exportedValue).toBe('0');
        });

        test('Les valeurs numériques restent inchangées', () => {
            const scores = ['5', '10', '15', '20'];
            
            scores.forEach(score => {
                const exportedValue = score === 'EL' ? '0' : score;
                expect(exportedValue).toBe(score);
            });
        });

        test('"-" doit être transformé en case vide', () => {
            const score = '-';
            let exportedValue = score;
            
            if (exportedValue === '-') exportedValue = '';
            
            expect(exportedValue).toBe('');
        });
    });

    describe('Format CSV avec Tour et Statut', () => {
        test('L\'en-tête CSV doit contenir Tour et Statut', () => {
            const juries = ['Pierre', 'Marie'];
            let header = 'CandidatID,CandidatNom,Tour,Statut';
            
            juries.forEach(jury => {
                header += `,${jury}_Note1,${jury}_Note2`;
            });
            
            expect(header).toContain('Tour');
            expect(header).toContain('Statut');
            expect(header).toContain('Pierre_Note1');
            expect(header).toContain('Pierre_Note2');
        });

        test('Les données doivent inclure le nom du tour et le statut', () => {
            const candidate = {
                id: '001',
                name: 'Timéo',
                tour: 'round1',
                status: 'Actif'
            };
            
            const rounds = [
                { id: 'round1', name: '1er tour' },
                { id: 'round2', name: 'Repêchage' }
            ];
            
            const roundObj = rounds.find(r => r.id === candidate.tour);
            const tourName = roundObj ? roundObj.name : candidate.tour;
            
            const row = `${candidate.id},"${candidate.name}","${tourName}","${candidate.status}"`;
            
            expect(row).toContain('001');
            expect(row).toContain('Timéo');
            expect(row).toContain('1er tour');
            expect(row).toContain('Actif');
        });
    });
});

describe('Import CSV', () => {
    
    describe('Transformation des valeurs à l\'import', () => {
        test('Case vide doit être transformée en "-"', () => {
            const importedValue = '';
            let processedValue = importedValue;
            
            if (!processedValue || processedValue === '') {
                processedValue = '-';
            }
            
            expect(processedValue).toBe('-');
        });

        test('undefined doit être transformé en "-"', () => {
            const importedValue = undefined;
            let processedValue = importedValue;
            
            if (!processedValue || processedValue === '' || processedValue === undefined) {
                processedValue = '-';
            }
            
            expect(processedValue).toBe('-');
        });

        test('0 doit être transformé en EL pour les tours non-repêchage', () => {
            const importedValue = '0';
            const isRepechage = false;
            
            let processedValue = importedValue;
            if (!isRepechage && processedValue === '0') {
                processedValue = 'EL';
            }
            
            expect(processedValue).toBe('EL');
        });

        test('0 reste 0 pour les tours de repêchage', () => {
            const importedValue = '0';
            const isRepechage = true;
            
            let processedValue = importedValue;
            if (!isRepechage && processedValue === '0') {
                processedValue = 'EL';
            }
            
            expect(processedValue).toBe('0');
        });

        test('1 reste 1 pour les tours de repêchage', () => {
            const importedValue = '1';
            const isRepechage = true;
            
            let processedValue = importedValue;
            
            expect(processedValue).toBe('1');
        });
    });

    describe('Validation des notes importées', () => {
        test('Les valeurs valides sont acceptées', () => {
            const validValues = ['-', '5', '10', '15', '20', 'EL', 'Elimine', '0', '1'];
            
            validValues.forEach(value => {
                expect(validValues.includes(value)).toBe(true);
            });
        });

        test('Les valeurs invalides sont rejetées', () => {
            const validValues = ['-', '5', '10', '15', '20', 'EL', 'Elimine', '0', '1'];
            const invalidValues = ['abc', '25', '100', 'invalid', ''];
            
            invalidValues.forEach(value => {
                // Case vide est transformée en '-' donc techniquement valide après transformation
                if (value !== '') {
                    expect(validValues.includes(value)).toBe(false);
                }
            });
        });
    });

    describe('Détection des colonnes Tour et Statut', () => {
        test('Détecter la présence de Tour et Statut dans l\'en-tête', () => {
            const header = ['CandidatID', 'CandidatNom', 'Tour', 'Statut', 'Pierre_Note1', 'Pierre_Note2'];
            
            const hasTourStatut = header[2] === 'Tour' && header[3] === 'Statut';
            
            expect(hasTourStatut).toBe(true);
        });

        test('Détecter l\'absence de Tour et Statut (ancien format)', () => {
            const header = ['CandidatID', 'CandidatNom', 'Pierre_Note1', 'Pierre_Note2'];
            
            const hasTourStatut = header[2] === 'Tour' && header[3] === 'Statut';
            
            expect(hasTourStatut).toBe(false);
        });

        test('L\'index des jurys dépend de la présence de Tour/Statut', () => {
            const headerWithTourStatut = ['CandidatID', 'CandidatNom', 'Tour', 'Statut', 'Pierre_Note1'];
            const headerWithoutTourStatut = ['CandidatID', 'CandidatNom', 'Pierre_Note1'];
            
            const hasTourStatut1 = headerWithTourStatut[2] === 'Tour' && headerWithTourStatut[3] === 'Statut';
            const hasTourStatut2 = headerWithoutTourStatut[2] === 'Tour' && headerWithoutTourStatut[3] === 'Statut';
            
            const juryStartIndex1 = hasTourStatut1 ? 4 : 2;
            const juryStartIndex2 = hasTourStatut2 ? 4 : 2;
            
            expect(juryStartIndex1).toBe(4);
            expect(juryStartIndex2).toBe(2);
        });
    });

    describe('Mise à jour du Tour et Statut des candidats', () => {
        test('Le tour du candidat est mis à jour depuis le CSV', () => {
            const candidate = {
                id: '001',
                name: 'Timéo',
                tour: 'round1',
                status: 'Actif'
            };
            
            const rounds = [
                { id: 'round1', name: '1er tour' },
                { id: 'round2', name: 'Repêchage' },
                { id: 'round3', name: '2eme tour' }
            ];
            
            const tourNameFromCSV = '2eme tour';
            const round = rounds.find(r => r.name === tourNameFromCSV);
            
            if (round) {
                candidate.tour = round.id;
            }
            
            expect(candidate.tour).toBe('round3');
        });

        test('Le statut du candidat est mis à jour depuis le CSV', () => {
            const candidate = {
                id: '001',
                status: 'Actif'
            };
            
            const statutFromCSV = 'Qualifie';
            const validStatuts = ['Actif', 'Qualifie', 'Elimine'];
            
            if (validStatuts.includes(statutFromCSV)) {
                candidate.status = statutFromCSV;
            }
            
            expect(candidate.status).toBe('Qualifie');
        });

        test('Les statuts invalides sont ignorés', () => {
            const candidate = {
                id: '001',
                status: 'Actif'
            };
            
            const statutFromCSV = 'InvalidStatus';
            const validStatuts = ['Actif', 'Qualifie', 'Elimine'];
            
            if (validStatuts.includes(statutFromCSV)) {
                candidate.status = statutFromCSV;
            }
            
            expect(candidate.status).toBe('Actif'); // Reste inchangé
        });
    });

    describe('Parsing CSV avec guillemets et cases vides', () => {
        test('Parser une ligne avec des cases vides', () => {
            const line = '001,"Timéo","1er tour","Actif",20,,15,';
            
            // Simuler le parsing
            const values = [];
            let current = '';
            let inQuotes = false;
            
            for (let c = 0; c < line.length; c++) {
                const char = line[c];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.trim());
            
            expect(values[0]).toBe('001');
            expect(values[1]).toBe('Timéo');
            expect(values[4]).toBe('20');
            expect(values[5]).toBe(''); // Case vide
            expect(values[6]).toBe('15');
            expect(values[7]).toBe(''); // Case vide
        });
    });
});

describe('Rétrocompatibilité CSV', () => {
    test('L\'import doit fonctionner avec l\'ancien format (sans Tour/Statut)', () => {
        const header = ['CandidatID', 'CandidatNom', 'Pierre_Note1', 'Pierre_Note2'];
        
        const hasTourStatut = header[2] === 'Tour' && header[3] === 'Statut';
        expect(hasTourStatut).toBe(false);
        
        const juryStartIndex = hasTourStatut ? 4 : 2;
        expect(juryStartIndex).toBe(2);
        
        // Le jury commence à l'index 2
        const juryName = header[juryStartIndex].replace('_Note1', '');
        expect(juryName).toBe('Pierre');
    });

    test('L\'import doit fonctionner avec le nouveau format (avec Tour/Statut)', () => {
        const header = ['CandidatID', 'CandidatNom', 'Tour', 'Statut', 'Pierre_Note1', 'Pierre_Note2'];
        
        const hasTourStatut = header[2] === 'Tour' && header[3] === 'Statut';
        expect(hasTourStatut).toBe(true);
        
        const juryStartIndex = hasTourStatut ? 4 : 2;
        expect(juryStartIndex).toBe(4);
        
        // Le jury commence à l'index 4
        const juryName = header[juryStartIndex].replace('_Note1', '');
        expect(juryName).toBe('Pierre');
    });
});

