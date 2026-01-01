// Mock Firebase pour les tests

const mockData = {
  candidates: [],
  scores: [],
  accounts: [],
  config: {}
};

const mockFirestore = {
  collection: jest.fn((collectionName) => ({
    doc: jest.fn((docId) => ({
      get: jest.fn(() => Promise.resolve({
        exists: () => true,
        data: () => mockData[collectionName] || {}
      })),
      set: jest.fn(() => Promise.resolve()),
      update: jest.fn(() => Promise.resolve()),
      delete: jest.fn(() => Promise.resolve())
    })),
    add: jest.fn(() => Promise.resolve({ id: 'mock-id' })),
    get: jest.fn(() => Promise.resolve({
      docs: mockData[collectionName]?.map((item, index) => ({
        id: `doc-${index}`,
        data: () => item,
        exists: true
      })) || []
    })),
    where: jest.fn(() => mockFirestore.collection(collectionName))
  })),
  doc: jest.fn((path) => ({
    get: jest.fn(() => Promise.resolve({
      exists: () => true,
      data: () => mockData
    })),
    set: jest.fn(() => Promise.resolve()),
    onSnapshot: jest.fn((callback) => {
      callback({
        exists: () => true,
        data: () => mockData
      });
      return jest.fn(); // unsubscribe
    })
  }))
};

const mockAuth = {
  signInWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: { uid: 'test-uid' } })),
  signOut: jest.fn(() => Promise.resolve()),
  onAuthStateChanged: jest.fn((callback) => {
    callback({ uid: 'test-uid' });
    return jest.fn(); // unsubscribe
  })
};

module.exports = {
  initializeApp: jest.fn(),
  getFirestore: jest.fn(() => mockFirestore),
  getAuth: jest.fn(() => mockAuth),
  collection: mockFirestore.collection,
  doc: mockFirestore.doc,
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => true, data: () => ({}) })),
  setDoc: jest.fn(() => Promise.resolve()),
  addDoc: jest.fn(() => Promise.resolve({ id: 'mock-id' })),
  deleteDoc: jest.fn(() => Promise.resolve()),
  query: jest.fn((...args) => args),
  where: jest.fn((...args) => args),
  onSnapshot: jest.fn((q, callback) => {
    callback({ docs: [], docChanges: () => [] });
    return jest.fn(); // unsubscribe
  }),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn(() => Promise.resolve())
  })),
  mockData // Exposer pour modification dans les tests
};

