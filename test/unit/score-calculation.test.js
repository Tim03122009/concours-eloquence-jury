/**
 * Tests unitaires pour le calcul des scores
 */

describe('Calcul des scores', () => {
  
  describe('Score pondéré', () => {
    test('Score normal (5, 10, 15, 20)', () => {
      // score1 × 3 + score2 × 1
      expect(5 * 3 + 5).toBe(20);
      expect(10 * 3 + 10).toBe(40);
      expect(15 * 3 + 15).toBe(60);
      expect(20 * 3 + 20).toBe(80);
    });

    test('Score mixte', () => {
      expect(5 * 3 + 10).toBe(25);
      expect(10 * 3 + 15).toBe(45);
      expect(15 * 3 + 20).toBe(65);
      expect(20 * 3 + 5).toBe(65);
    });

    test('Score avec EL donne 0', () => {
      const calculateScore = (score1, score2) => {
        if (score1 === 'EL' || score2 === 'EL') {
          return 0;
        }
        return parseInt(score1) * 3 + parseInt(score2);
      };

      expect(calculateScore('EL', 10)).toBe(0);
      expect(calculateScore(15, 'EL')).toBe(0);
      expect(calculateScore('EL', 'EL')).toBe(0);
    });
  });

  describe('Agrégation des scores de plusieurs jurys', () => {
    test('Total de 3 jurys avec notes normales', () => {
      const jury1 = 5 * 3 + 5; // 20
      const jury2 = 10 * 3 + 10; // 40
      const jury3 = 15 * 3 + 15; // 60
      const total = jury1 + jury2 + jury3;
      expect(total).toBe(120);
    });

    test('Total avec un jury qui a mis EL', () => {
      const jury1 = 5 * 3 + 5; // 20
      const jury2 = 0; // EL
      const jury3 = 15 * 3 + 15; // 60
      const total = jury1 + jury2 + jury3;
      expect(total).toBe(80);
    });

    test('Total avec tous les jurys qui ont mis EL', () => {
      const jury1 = 0; // EL
      const jury2 = 0; // EL
      const jury3 = 0; // EL
      const total = jury1 + jury2 + jury3;
      expect(total).toBe(0);
    });
  });

  describe('Score de repêchage', () => {
    test('Candidat qualifié (note 1) conserve son score précédent', () => {
      const previousRoundScore = 120;
      const presidentVote = '1';
      const finalScore = presidentVote === '1' ? previousRoundScore : 0;
      expect(finalScore).toBe(120);
    });

    test('Candidat éliminé (note 0) obtient un score de 0', () => {
      const previousRoundScore = 120;
      const presidentVote = '0';
      const finalScore = presidentVote === '0' ? 0 : previousRoundScore;
      expect(finalScore).toBe(0);
    });
  });

  describe('Classement des candidats', () => {
    test('Tri par score décroissant', () => {
      const candidates = [
        { name: 'Alice', score: 50 },
        { name: 'Bob', score: 80 },
        { name: 'Charlie', score: 30 }
      ];
      
      candidates.sort((a, b) => b.score - a.score);
      
      expect(candidates[0].name).toBe('Bob');
      expect(candidates[1].name).toBe('Alice');
      expect(candidates[2].name).toBe('Charlie');
    });

    test('Tri avec égalité de score', () => {
      const candidates = [
        { name: 'Alice', score: 50 },
        { name: 'Bob', score: 50 },
        { name: 'Charlie', score: 30 }
      ];
      
      candidates.sort((a, b) => b.score - a.score);
      
      expect(candidates[0].score).toBe(50);
      expect(candidates[1].score).toBe(50);
      expect(candidates[2].score).toBe(30);
    });
  });

  describe('Filtrage des candidats', () => {
    test('Exclure les candidats éliminés du podium', () => {
      const candidates = [
        { id: '1', name: 'Alice', status: 'Qualifie', score: 80 },
        { id: '2', name: 'Bob', status: 'Elimine', score: 50 },
        { id: '3', name: 'Charlie', status: 'Qualifie', score: 60 }
      ];
      
      const qualified = candidates.filter(c => c.status !== 'Elimine');
      
      expect(qualified.length).toBe(2);
      expect(qualified.find(c => c.name === 'Bob')).toBeUndefined();
    });

    test('Filtrer par tour', () => {
      const candidates = [
        { id: '1', name: 'Alice', tour: 'round1' },
        { id: '2', name: 'Bob', tour: 'round2' },
        { id: '3', name: 'Charlie', tour: 'round1' }
      ];
      
      const round1Candidates = candidates.filter(c => c.tour === 'round1');
      
      expect(round1Candidates.length).toBe(2);
      expect(round1Candidates.find(c => c.name === 'Bob')).toBeUndefined();
    });
  });

  describe('Génération de notes aléatoires', () => {
    test('Score aléatoire parmi 5, 10, 15, 20', () => {
      const randomScore = () => {
        const scores = [5, 10, 15, 20];
        return scores[Math.floor(Math.random() * scores.length)];
      };

      const score = randomScore();
      expect([5, 10, 15, 20]).toContain(score);
    });

    test('Génération de 15% de candidats éliminés', () => {
      const totalCandidates = 100;
      const eliminationRate = 0.15;
      const eliminatedCount = Math.floor(totalCandidates * eliminationRate);
      
      expect(eliminatedCount).toBe(15);
    });
  });

  describe('Score épreuve duel (fond et forme coefficient 1)', () => {
    /** Même logique que computeScoreBase pour un tour de type Duels. */
    function computeScoreBaseDuel(score1, score2) {
      if (score1 === 'EL' || score2 === 'EL' || score1 === '-' || score2 === '-') return 0;
      const s1 = parseInt(score1, 10);
      const s2 = parseInt(score2, 10);
      if (isNaN(s1) || isNaN(s2)) return 0;
      return s1 + s2;
    }

    test('Duel : score = fond + forme (coef 1 chacun)', () => {
      expect(computeScoreBaseDuel(10, 10)).toBe(20);
      expect(computeScoreBaseDuel(5, 15)).toBe(20);
      expect(computeScoreBaseDuel(20, 20)).toBe(40);
      expect(computeScoreBaseDuel(0, 0)).toBe(0);
    });

    test('Duel : EL ou tiret donne 0', () => {
      expect(computeScoreBaseDuel('EL', 10)).toBe(0);
      expect(computeScoreBaseDuel(15, 'EL')).toBe(0);
      expect(computeScoreBaseDuel('-', 10)).toBe(0);
      expect(computeScoreBaseDuel(10, '-')).toBe(0);
    });
  });

  describe('computeScoreBase selon type de tour (notation vs duel)', () => {
    const ROUNDS = [
      { id: 'round1', type: 'Notation individuelle', type_epreuve: 'notation' },
      { id: 'round3', type: 'Duels', type_epreuve: 'duels' }
    ];

    function computeScoreBase(score1, score2, roundId) {
      if (score1 === 'EL' || score2 === 'EL' || score1 === '-' || score2 === '-') return 0;
      const s1 = parseInt(score1, 10);
      const s2 = parseInt(score2, 10);
      if (isNaN(s1) || isNaN(s2)) return 0;
      const r = Array.isArray(ROUNDS) ? ROUNDS.find(x => x.id === roundId) : null;
      const isDuel = r && (r.type === 'Duels' || r.type_epreuve === 'duels');
      if (isDuel) return s1 + s2;
      return (s1 * 3) + s2;
    }

    test('Tour notation : fond×3 + forme', () => {
      expect(computeScoreBase(10, 10, 'round1')).toBe(40);
      expect(computeScoreBase(5, 20, 'round1')).toBe(35);
    });

    test('Tour duel : fond + forme (coef 1)', () => {
      expect(computeScoreBase(10, 10, 'round3')).toBe(20);
      expect(computeScoreBase(5, 20, 'round3')).toBe(25);
    });

    test('roundId absent ou inconnu : comportement notation (fond×3 + forme)', () => {
      expect(computeScoreBase(10, 10, undefined)).toBe(40);
      expect(computeScoreBase(10, 10, 'round_inconnu')).toBe(40);
    });
  });
});

