module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'prettier'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended'
  ],
  "rules": {
    "prefer-const": "off",
    "@typescript-eslint/camelcase": "off",
    "@typescript-eslint/no-use-before-define": ["error", {"functions": false}],
    "@typescript-eslint/no-this-alias": "off"
  }
};
