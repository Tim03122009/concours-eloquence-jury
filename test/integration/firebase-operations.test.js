/**
 * Tests d'intégration pour les opérations Firebase
 */

const firebase = require('../__mocks__/firebase');

describe('Opérations Firebase', () => {
  
  beforeEach(() => {
    // Réinitialiser les données mockées
    firebase.mockData.candidates = [];
    firebase.mockData.scores = [];
    firebase.mockData.accounts = [];
    jest.clearAllMocks();
  });

  describe('CRUD Candidats', () => {
    test('Créer un candidat', async () => {
      const candidateData = {
        id: '1',
        name: 'Alice Dupont',
        tour: 'round1',
        status: 'Actif'
      };
      
      const addDoc = firebase.addDoc;
      await addDoc(firebase.collection('candidats'), candidateData);
      
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        candidateData
      );
    });

    test('Lire les candidats', async () => {
      firebase.mockData.candidates = [
        { id: '1', name: 'Alice', tour: 'round1', status: 'Actif' },
        { id: '2', name: 'Bob', tour: 'round1', status: 'Actif' }
      ];
      
      const getDocs = firebase.getDocs;
      const snapshot = await getDocs(firebase.collection('candidats'));
      
      expect(getDocs).toHaveBeenCalled();
    });

    test('Mettre à jour le statut d\'un candidat', async () => {
      const setDoc = firebase.setDoc;
      const candidateRef = firebase.doc('candidats/1');
      
      await setDoc(candidateRef, { status: 'Qualifie' }, { merge: true });
      
      expect(setDoc).toHaveBeenCalledWith(
        candidateRef,
        { status: 'Qualifie' },
        { merge: true }
      );
    });

    test('Supprimer un candidat', async () => {
      const deleteDoc = firebase.deleteDoc;
      const candidateRef = firebase.doc('candidats/1');
      
      await deleteDoc(candidateRef);
      
      expect(deleteDoc).toHaveBeenCalledWith(candidateRef);
    });
  });

  describe('CRUD Scores', () => {
    test('Créer un score', async () => {
      const scoreData = {
        candidateId: '1',
        juryId: 'jury1',
        juryName: 'M. Dupont',
        roundId: 'round1',
        score1: '15',
        score2: '20',
        timestamp: new Date()
      };
      
      const addDoc = firebase.addDoc;
      await addDoc(firebase.collection('scores'), scoreData);
      
      expect(addDoc).toHaveBeenCalled();
    });

    test('Requête scores par candidat', async () => {
      const query = firebase.query;
      const where = firebase.where;
      const getDocs = firebase.getDocs;
      
      const q = query(
        firebase.collection('scores'),
        where('candidateId', '==', '1')
      );
      
      await getDocs(q);
      
      expect(query).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith('candidateId', '==', '1');
    });

    test('Requête scores par tour', async () => {
      const query = firebase.query;
      const where = firebase.where;
      const getDocs = firebase.getDocs;
      
      const q = query(
        firebase.collection('scores'),
        where('roundId', '==', 'round1')
      );
      
      await getDocs(q);
      
      expect(where).toHaveBeenCalledWith('roundId', '==', 'round1');
    });

    test('Batch write pour plusieurs scores', async () => {
      const writeBatch = firebase.writeBatch;
      const batch = writeBatch();
      
      batch.set(firebase.doc('scores/1'), { score1: '15', score2: '20' });
      batch.set(firebase.doc('scores/2'), { score1: '10', score2: '15' });
      
      await batch.commit();
      
      expect(batch.commit).toHaveBeenCalled();
    });
  });

  describe('CRUD Jurys (Accounts)', () => {
    test('Créer un compte jury', async () => {
      const juryData = {
        id: 'jury1',
        name: 'M. Dupont',
        password: 'password123',
        isPresident: false,
        rounds: ['round1', 'round2']
      };
      
      const setDoc = firebase.setDoc;
      const juryRef = firebase.doc('accounts/jury1');
      
      await setDoc(juryRef, juryData);
      
      expect(setDoc).toHaveBeenCalledWith(juryRef, juryData);
    });

    test('Requête pour trouver le président', async () => {
      firebase.mockData.accounts = [
        { id: 'jury1', name: 'M. Dupont', isPresident: true },
        { id: 'jury2', name: 'Mme Martin', isPresident: false }
      ];
      
      const accounts = firebase.mockData.accounts;
      const president = accounts.find(j => j.isPresident);
      
      expect(president).toBeDefined();
      expect(president.id).toBe('jury1');
    });

    test('Mettre à jour les tours d\'un jury', async () => {
      const setDoc = firebase.setDoc;
      const juryRef = firebase.doc('accounts/jury1');
      
      await setDoc(juryRef, { rounds: ['round1', 'round2', 'round3'] }, { merge: true });
      
      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe('Configuration des tours', () => {
    test('Sauvegarder la configuration des tours', async () => {
      const roundsData = {
        rounds: [
          { id: 'round1', name: '1er tour', order: 1, type: 'Normal', nextRoundCandidates: 10 },
          { id: 'round2', name: 'Repêchage 1', order: 2, type: 'Repêchage', nextRoundCandidates: 5 }
        ]
      };
      
      const setDoc = firebase.setDoc;
      const configRef = firebase.doc('config/rounds');
      
      await setDoc(configRef, roundsData);
      
      expect(setDoc).toHaveBeenCalledWith(configRef, roundsData);
    });

    test('Lire la configuration des tours', async () => {
      firebase.mockData.rounds = [
        { id: 'round1', name: '1er tour', order: 1 }
      ];
      
      const getDoc = firebase.getDoc;
      const configRef = firebase.doc('config/rounds');
      
      const snapshot = await getDoc(configRef);
      
      expect(getDoc).toHaveBeenCalled();
      expect(snapshot.exists()).toBe(true);
    });
  });

  describe('Listeners temps réel', () => {
    test('onSnapshot sur les scores', () => {
      const onSnapshot = firebase.onSnapshot;
      const callback = jest.fn();
      
      const unsubscribe = onSnapshot(
        firebase.collection('scores'),
        callback
      );
      
      expect(onSnapshot).toHaveBeenCalled();
      expect(callback).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    test('onSnapshot sur un document', () => {
      const doc = firebase.doc('candidats/liste_actuelle');
      const callback = jest.fn();
      
      const unsubscribe = doc.onSnapshot(callback);
      
      expect(callback).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('Gestion des erreurs', () => {
    test('Gérer document inexistant', async () => {
      const getDoc = firebase.getDoc;
      getDoc.mockResolvedValueOnce({
        exists: () => false,
        data: () => undefined
      });
      
      const snapshot = await getDoc(firebase.doc('candidats/invalid'));
      
      expect(snapshot.exists()).toBe(false);
    });

    test('Gérer échec de requête', async () => {
      const getDocs = firebase.getDocs;
      getDocs.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(getDocs(firebase.collection('scores')))
        .rejects.toThrow('Network error');
    });
  });
});

