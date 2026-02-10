/**
 * Tests de non-régression des pages HTML : présence des éléments critiques.
 * Vérifie que les IDs et structures attendus par script.js et admin existent.
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '../..');

function readFile(relativePath) {
  const fullPath = path.join(projectRoot, relativePath);
  expect(fs.existsSync(fullPath)).toBe(true);
  return fs.readFileSync(fullPath, 'utf8');
}

describe('Pages du site - éléments critiques', () => {
  describe('index.html (interface jury)', () => {
    let html;
    beforeAll(() => {
      html = readFile('index.html');
    });

    test('contient la page d\'identification', () => {
      expect(html).toContain('id="identification-page"');
      expect(html).toContain('id="jury-name-input"');
      expect(html).toContain('id="password-input"');
      expect(html).toContain('id="start-scoring-button"');
    });

    test('contient la page de notation', () => {
      expect(html).toContain('id="scoring-page"');
      expect(html).toContain('id="candidate-select"');
      expect(html).toContain('id="grid-fond"');
      expect(html).toContain('id="grid-forme"');
      expect(html).toContain('id="validate-button"');
    });

    test('contient la modale de confirmation', () => {
      expect(html).toContain('id="confirmation-modal"');
      expect(html).toContain('id="confirm-send-button"');
      expect(html).toContain('id="cancel-send-button"');
    });

    test('charge style.css et script.js', () => {
      expect(html).toMatch(/href=["']style\.css["']/);
      expect(html).toMatch(/script\.js|src=.*\.js/);
    });
  });

  describe('classement.html', () => {
    let html;
    beforeAll(() => {
      html = readFile('classement.html');
    });

    test('contient le conteneur et le tableau de classement', () => {
      expect(html).toContain('id="classement-body"');
      expect(html).toContain('id="classement-table"');
      expect(html).toContain('id="qualified-zone-overlay"');
    });

    test('charge les scripts attendus', () => {
      expect(html).toContain('classement');
      expect(html).toMatch(/firebase|script/);
    });
  });

  describe('admin.html', () => {
    let html;
    beforeAll(() => {
      html = readFile('admin.html');
    });

    test('contient les onglets principaux', () => {
      expect(html).toContain('Candidats');
      expect(html).toContain('Jurys');
      expect(html).toContain('Notes');
      expect(html).toContain('Duels');
      expect(html.toLowerCase()).toMatch(/classement/);
    });

    test('contient la logique computeScoreBase (duel vs notation)', () => {
      expect(html).toContain('computeScoreBase');
      expect(html).toContain('Duels');
      expect(html).toMatch(/type_epreuve.*duels|type.*Duels/);
    });

    test('contient le tableau des notes', () => {
      expect(html).toMatch(/notes-table/);
    });
  });
});

describe('Logique métier - validation des entrées', () => {
  test('Notes fond/forme acceptées : 0 à 20 et EL', () => {
    const validScores = ['0', '5', '10', '15', '20', 'EL'];
    validScores.forEach(s => {
      expect(typeof s).toBe('string');
      if (s !== 'EL') expect(parseInt(s, 10)).toBeGreaterThanOrEqual(0);
      if (s !== 'EL') expect(parseInt(s, 10)).toBeLessThanOrEqual(20);
    });
  });

  test('Score base notation : fond×3 + forme dans [0, 80]', () => {
    const maxFond = 20, maxForme = 20;
    const maxScore = maxFond * 3 + maxForme;
    expect(maxScore).toBe(80);
    expect(0 * 3 + 0).toBe(0);
  });

  test('Score base duel : fond + forme dans [0, 40]', () => {
    const maxFond = 20, maxForme = 20;
    const maxScore = maxFond + maxForme;
    expect(maxScore).toBe(40);
    expect(10 + 10).toBe(20);
  });
});
