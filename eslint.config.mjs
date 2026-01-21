import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "src/__tests__/tsconfig.json"]
      }
    },
    rules: {
      "prefer-const": "off",
      "@typescript-eslint/camelcase": "off",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      // TODO: remove this rule. Currently, many conditionals are reported as
      // unnecessary because many block input types are incorrectly too narrow:
      // https://github.com/leopard-js/sb-edit/issues/100
      "@typescript-eslint/no-unnecessary-condition": "off",

      "@typescript-eslint/ban-types": [
        "error",
        {
          types: {
            "{}": false
          },

          extendDefaults: true
        }
      ],

      "no-console": [
        "error",
        {
          allow: ["warn", "error"]
        }
      ]
    }
  },
  {
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked]
  }
);
