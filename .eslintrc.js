module.exports = {
  extends: 'standard',
  rules: {
    'space-before-function-paren': [
      'error', {
        anonymous: 'never',
        named: 'never',
        asyncArrow: 'always'
      }
    ],
    'one-var': 'off',
    indent: [2, 2, {
      VariableDeclarator: 'first'
    }],
    'no-unmodified-loop-condition': 'warn'
  }
}
