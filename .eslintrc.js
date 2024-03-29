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
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:prettier/recommended'
  ],
  "rules": {
    "prefer-const": "off",
    "@typescript-eslint/camelcase": "off",
    "@typescript-eslint/no-use-before-define": "off",
    "@typescript-eslint/no-this-alias": "off",
    "@typescript-eslint/ban-types": [
      "error",
      {
        "types": {
          "{}": false
        },
        "extendDefaults": true
      }
    ],
    "no-console": ["error", {"allow": ["warn", "error"]}]
  },
  parserOptions: {
    'project': ['./tsconfig.json', './src/__tests__/tsconfig.json']
  },
};
