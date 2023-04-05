module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'promise'],
  root: true,
  parserOptions: {
    project: ['./tsconfig.json'],
  },
  
  rules: {
    "@typescript-eslint/no-floating-promises": "error"
  }
};
  