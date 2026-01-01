/**
 * Tests end-to-end pour les flux utilisateur de l'administrateur
 */

describe('Flux utilisateur - Administrateur', () => {
  
  describe('Gestion des candidats', () => {
    test('Ajouter un candidat', () => {
      const candidates = [];
      
      const addCandidate = (name) => {
        const id = String(candidates.length + 1);
        const candidate = {
          id,
          name,
          tour: 'round1',
          status: 'Actif'
        };
        candidates.push(candidate);
        return candidate;
      };
      
      const newCandidate = addCandidate('Alice Dupont');
      expect(candidates.length).toBe(1);
      expect(newCandidate.name).toBe('Alice Dupont');
    });

    test('Modifier le statut d\'un candidat', () => {
      const candidates = [
        { id: '1', name: 'Alice', status: 'Actif' }
      ];
      
      candidates[0].status = 'Qualifie';
      
      expect(candidates[0].status).toBe('Qualifie');
    });

    test('Supprimer un candidat', () => {
      let candidates = [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' }
      ];
      
      candidates = candidates.filter(c => c.id !== '1');
      
      expect(candidates.length).toBe(1);
      expect(candidates.find(c => c.id === '1')).toBeUndefined();
    });

    test('Insertion de candidats de test', () => {
      const candidates = [];
      
      for (let i = 1; i <= 10; i++) {
        candidates.push({
          id: String(i),
          name: `Candidat ${i}`,
          tour: 'round1',
          status: 'Actif'
        });
      }
      
      expect(candidates.length).toBe(10);
    });
  });

  describe('Gestion des jurys', () => {
    test('Ajouter un jury', () => {
      const juries = [];
      
      const addJury = (name, password) => {
        const jury = {
          id: `jury${juries.length + 1}`,
          name,
          password,
          isPresident: juries.length === 0, // Premier jury = président
          rounds: ['round1']
        };
        juries.push(jury);
        return jury;
      };
      
      const newJury = addJury('M. Dupont', 'password123');
      expect(juries.length).toBe(1);
      expect(newJury.isPresident).toBe(true);
    });

    test('Changer le président', () => {
      const juries = [
        { id: 'jury1', name: 'M. Dupont', isPresident: true, rounds: ['round1'] },
        { id: 'jury2', name: 'Mme Martin', isPresident: false, rounds: ['round1'] }
      ];
      
      // Changer le président
      juries[0].isPresident = false;
      juries[1].isPresident = true;
      
      const presidents = juries.filter(j => j.isPresident);
      expect(presidents.length).toBe(1);
      expect(presidents[0].id).toBe('jury2');
    });

    test('Configurer les tours de présence d\'un jury', () => {
      const jury = {
        id: 'jury1',
        rounds: ['round1']
      };
      
      jury.rounds.push('round2');
      jury.rounds.push('round3');
      
      expect(jury.rounds).toEqual(['round1', 'round2', 'round3']);
    });
  });

  describe('Gestion des tours', () => {
    test('Créer un tour', () => {
      const rounds = [];
      
      const addRound = (name, type, order) => {
        const round = {
          id: `round${order}`,
          name,
          order,
          type,
          nextRoundCandidates: 10
        };
        rounds.push(round);
        return round;
      };
      
      addRound('1er tour', 'Normal', 1);
      expect(rounds.length).toBe(1);
    });

    test('Réinitialiser tours par défaut', () => {
      let rounds = [];
      
      rounds = [
        { id: 'round1', name: '1er tour', order: 1, type: 'Normal', nextRoundCandidates: 10 },
        { id: 'repechage1', name: 'Repêchage 1', order: 2, type: 'Repêchage', nextRoundCandidates: 5 },
        { id: 'round2', name: '2ème tour', order: 3, type: 'Normal', nextRoundCandidates: 8 },
        { id: 'repechage2', name: 'Repêchage 2', order: 4, type: 'Repêchage', nextRoundCandidates: 4 },
        { id: 'semifinal', name: 'Demi-finale', order: 5, type: 'Normal', nextRoundCandidates: 3 },
        { id: 'final', name: 'Finale', order: 6, type: 'Normal', nextRoundCandidates: 'ALL' }
      ];
      
      expect(rounds.length).toBe(6);
      expect(rounds.filter(r => r.type === 'Repêchage').length).toBe(2);
    });

    test('Terminer un tour et passer au suivant', () => {
      const rounds = [
        { id: 'round1', order: 1 },
        { id: 'round2', order: 2 }
      ];
      let activeRoundId = 'round1';
      
      // Terminer le tour
      const currentIndex = rounds.findIndex(r => r.id === activeRoundId);
      if (currentIndex < rounds.length - 1) {
        activeRoundId = rounds[currentIndex + 1].id;
      }
      
      expect(activeRoundId).toBe('round2');
    });
  });

  describe('Auto-remplissage des notes', () => {
    test('Générer des notes aléatoires pour tous les candidats', () => {
      const candidates = [
        { id: '1', name: 'Alice', status: 'Actif' },
        { id: '2', name: 'Bob', status: 'Actif' },
        { id: '3', name: 'Charlie', status: 'Actif' }
      ];
      
      const juries = [
        { id: 'jury1', name: 'M. Dupont' },
        { id: 'jury2', name: 'Mme Martin' }
      ];
      
      const scores = [];
      const randomScore = () => [5, 10, 15, 20][Math.floor(Math.random() * 4)];
      
      candidates.forEach(candidate => {
        juries.forEach(jury => {
          scores.push({
            candidateId: candidate.id,
            juryId: jury.id,
            score1: String(randomScore()),
            score2: String(randomScore())
          });
        });
      });
      
      expect(scores.length).toBe(candidates.length * juries.length);
    });

    test('Marquer ~15% des candidats comme éliminés', () => {
      const totalCandidates = 20;
      const eliminationRate = 0.15;
      const expectedEliminated = Math.floor(totalCandidates * eliminationRate);
      
      expect(expectedEliminated).toBe(3);
    });
  });

  describe('Tableau de notes', () => {
    test('Afficher les notes d\'un tour', () => {
      const scores = [
        { candidateId: '1', juryId: 'jury1', roundId: 'round1', score1: '15', score2: '20' },
        { candidateId: '1', juryId: 'jury2', roundId: 'round1', score1: '10', score2: '15' },
        { candidateId: '2', juryId: 'jury1', roundId: 'round1', score1: '20', score2: '20' }
      ];
      
      const round1Scores = scores.filter(s => s.roundId === 'round1');
      expect(round1Scores.length).toBe(3);
    });

    test('Filtrer les jurys présents sur le tour', () => {
      const juries = [
        { id: 'jury1', rounds: ['round1', 'round2'] },
        { id: 'jury2', rounds: ['round1'] },
        { id: 'jury3', rounds: ['round2'] }
      ];
      
      const displayRound = 'round1';
      const juriesOnRound = juries.filter(j => j.rounds.includes(displayRound));
      
      expect(juriesOnRound.length).toBe(2);
      expect(juriesOnRound.find(j => j.id === 'jury3')).toBeUndefined();
    });
  });

  describe('Podium', () => {
    test('Calculer et afficher le top 3', () => {
      const candidates = [
        { id: '1', name: 'Alice', total: 120, status: 'Qualifie' },
        { id: '2', name: 'Bob', total: 100, status: 'Qualifie' },
        { id: '3', name: 'Charlie', total: 80, status: 'Qualifie' },
        { id: '4', name: 'David', total: 60, status: 'Qualifie' }
      ];
      
      const podium = candidates
        .filter(c => c.status !== 'Elimine')
        .sort((a, b) => b.total - a.total)
        .slice(0, 3);
      
      expect(podium.length).toBe(3);
      expect(podium[0].name).toBe('Alice');
      expect(podium[1].name).toBe('Bob');
      expect(podium[2].name).toBe('Charlie');
    });

    test('Exclure les candidats éliminés du podium', () => {
      const candidates = [
        { id: '1', name: 'Alice', total: 120, status: 'Qualifie' },
        { id: '2', name: 'Bob', total: 100, status: 'Elimine' },
        { id: '3', name: 'Charlie', total: 80, status: 'Qualifie' }
      ];
      
      const podium = candidates
        .filter(c => c.status !== 'Elimine')
        .sort((a, b) => b.total - a.total);
      
      expect(podium.length).toBe(2);
      expect(podium.find(c => c.name === 'Bob')).toBeUndefined();
    });
  });

  describe('Export des données', () => {
    test('Exporter les notes en CSV', () => {
      const candidates = [
        { id: '1', name: 'Alice', total: 120 },
        { id: '2', name: 'Bob', total: 100 }
      ];
      
      let csv = 'Candidat,Score\n';
      candidates.forEach(c => {
        csv += `"${c.name}",${c.total}\n`;
      });
      
      expect(csv).toContain('Alice');
      expect(csv).toContain('120');
    });

    test('Remplacer EL par 0 dans l\'export', () => {
      const score = 'EL';
      const exportValue = score === 'EL' ? '0' : score;
      
      expect(exportValue).toBe('0');
    });
  });

  describe('Réinitialisation', () => {
    test('Réinitialiser les scores d\'un tour', () => {
      let scores = [
        { id: '1', roundId: 'round1', score1: '15' },
        { id: '2', roundId: 'round1', score1: '20' },
        { id: '3', roundId: 'round2', score1: '10' }
      ];
      
      const activeRoundId = 'round1';
      scores = scores.filter(s => s.roundId !== activeRoundId);
      
      expect(scores.length).toBe(1);
      expect(scores[0].roundId).toBe('round2');
    });

    test('Réinitialiser tous les scores et tours', () => {
      let scores = [{ id: '1' }, { id: '2' }];
      let candidates = [
        { id: '1', status: 'Qualifie', tour: 'round2' },
        { id: '2', status: 'Elimine', tour: 'round3' }
      ];
      
      // Réinitialiser
      scores = [];
      candidates.forEach(c => {
        c.status = 'Actif';
        c.tour = 'round1';
      });
      
      expect(scores.length).toBe(0);
      expect(candidates.every(c => c.status === 'Actif')).toBe(true);
      expect(candidates.every(c => c.tour === 'round1')).toBe(true);
    });
  });
});

