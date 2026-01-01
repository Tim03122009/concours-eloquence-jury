// Configuration globale pour Jest

// Simuler localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock;

// Simuler alert, confirm, prompt
global.alert = jest.fn();
global.confirm = jest.fn(() => true);
global.prompt = jest.fn(() => 'test');

// Nettoyer les mocks après chaque test
afterEach(() => {
  jest.clearAllMocks();
});

