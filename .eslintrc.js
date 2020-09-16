module.exports = {
  parserOptions: {
    ecmaVersion: 2020
  },
  extends: [
    'prettier' // eslint-config-prettier
  ],
  plugins: [
    'prettier' // eslint-plugin-prettier
  ],
  rules: {
    "prettier/prettier": 'error'
  }
}
