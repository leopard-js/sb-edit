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
    "object-literal-sort-keys": "off",
    "no-shadowed-variable": "off",
    "prefer-const": "off",
    "max-classes-per-file": "off",
    "ordered-imports": "off",
    "@typescript-eslint/camelcase": "off"
  }
};
