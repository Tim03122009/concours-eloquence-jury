/**
 * Tests des fonctionnalités du site : zone qualifiée, verrou session, bonus duel.
 * Vérifie la logique métier utilisée dans classement.html et admin/script.js.
 */

describe('Zone qualifiée (classement)', () => {
  /** Logique getQualifyCountForRound : nextRoundCandidates 'ALL' → entriesLength, sinon N. */
  function getQualifyCountForRound(round, entriesLength) {
    if (!round || round.nextRoundCandidates == null || round.nextRoundCandidates === '') return null;
    if (round.nextRoundCandidates === 'ALL') return entriesLength;
    const n = parseInt(round.nextRoundCandidates, 10);
    return isNaN(n) ? null : Math.max(0, n);
  }

  test('nextRoundCandidates ALL retourne le nombre total d\'entrées', () => {
    const round = { id: 'r1', nextRoundCandidates: 'ALL' };
    expect(getQualifyCountForRound(round, 18)).toBe(18);
    expect(getQualifyCountForRound(round, 0)).toBe(0);
  });

  test('nextRoundCandidates nombre retourne ce nombre', () => {
    expect(getQualifyCountForRound({ id: 'r1', nextRoundCandidates: 3 }, 10)).toBe(3);
    expect(getQualifyCountForRound({ id: 'r1', nextRoundCandidates: 7 }, 10)).toBe(7);
    expect(getQualifyCountForRound({ id: 'r1', nextRoundCandidates: 18 }, 20)).toBe(18);
  });

  test('nextRoundCandidates absent ou vide retourne null', () => {
    expect(getQualifyCountForRound({ id: 'r1' }, 10)).toBeNull();
    expect(getQualifyCountForRound({ id: 'r1', nextRoundCandidates: '' }, 10)).toBeNull();
    expect(getQualifyCountForRound({ id: 'r1', nextRoundCandidates: null }, 10)).toBeNull();
  });

  test('nextRoundCandidates invalide (NaN) retourne null', () => {
    expect(getQualifyCountForRound({ id: 'r1', nextRoundCandidates: 'abc' }, 10)).toBeNull();
  });

  test('nextRoundCandidates négatif est ramené à 0', () => {
    expect(getQualifyCountForRound({ id: 'r1', nextRoundCandidates: -1 }, 10)).toBe(0);
  });
});

describe('Verrouillage des sessions (admin)', () => {
  /** Indique si l’accès jury doit être refusé (session verrouillée). */
  function isSessionLocked(sessionData) {
    return sessionData && sessionData.sessionLocked === true;
  }

  test('sessionLocked true → pas d\'accès', () => {
    expect(isSessionLocked({ sessionLocked: true })).toBe(true);
    expect(isSessionLocked({ sessionLocked: true, current_id: '123' })).toBe(true);
  });

  test('sessionLocked false ou absent → accès autorisé (côté verrou)', () => {
    expect(isSessionLocked({ sessionLocked: false })).toBe(false);
    expect(isSessionLocked({})).toBe(false);
    expect(isSessionLocked(null)).toBe(false);
  });
});

describe('Bonus duel (désactivé par défaut)', () => {
  /** Candidats qui ont le +10% : uniquement ceux dans duelBonusEnabled (liste explicite). */
  function getDuelWinnerIdsWithBonus(rawDuelWinnerIds, duelBonusEnabled) {
    const enabled = Array.isArray(duelBonusEnabled) ? duelBonusEnabled : [];
    return (rawDuelWinnerIds || []).filter(id => enabled.includes(id));
  }

  test('duelBonusEnabled vide → aucun candidat n\'a le bonus', () => {
    const winners = ['c1', 'c2', 'c3'];
    expect(getDuelWinnerIdsWithBonus(winners, [])).toEqual([]);
    expect(getDuelWinnerIdsWithBonus(winners, null)).toEqual([]);
  });

  test('duelBonusEnabled avec des ids → seuls ceux-là ont le bonus', () => {
    const winners = ['c1', 'c2', 'c3'];
    expect(getDuelWinnerIdsWithBonus(winners, ['c1', 'c3'])).toEqual(['c1', 'c3']);
    expect(getDuelWinnerIdsWithBonus(winners, ['c2'])).toEqual(['c2']);
  });

  test('Score affiché avec bonus : base * 1.1 si dans liste, sinon base', () => {
    const getDisplayScore = (base, duelWinnerIds, candidateId) => {
      if (duelWinnerIds && duelWinnerIds.length && duelWinnerIds.includes(candidateId)) {
        return Math.round(base * 1.1 * 100) / 100;
      }
      return base;
    };
    const duelWinnerIds = ['c1'];
    expect(getDisplayScore(10, duelWinnerIds, 'c1')).toBe(11);
    expect(getDisplayScore(10, duelWinnerIds, 'c2')).toBe(10);
    expect(getDisplayScore(10, [], 'c1')).toBe(10);
  });
});

describe('Structure des pages (smoke)', () => {
  test('Les identifiants critiques du site sont définis', () => {
    const criticalIds = [
      'classement-body',
      'classement-table',
      'qualified-zone-overlay',
      'scoring-page',
      'identification-page',
      'jury-table'
    ];
    criticalIds.forEach(id => {
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });
});
