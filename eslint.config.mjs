import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
export default tseslint.config(
  { ignores: ['app/@engine/import/lib/**', 'app/@engine/model/composables/**', 'app/@engine/model/types/**', 'app/@engine/model/lib/**', '**/test/**', '**/tests/**'] },
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  { files: ['**/*.vue'], languageOptions: { parserOptions: { parser: tseslint.parser } } },
  { rules: { '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }], 'vue/multi-word-component-names': 'off', 'vue/max-attributes-per-line': 'off', 'vue/singleline-html-element-content-newline': 'off', 'vue/html-self-closing': 'off', 'vue/html-indent': 'off', 'vue/first-attribute-linebreak': 'off', 'vue/attribute-hyphenation': 'off' } }
);
