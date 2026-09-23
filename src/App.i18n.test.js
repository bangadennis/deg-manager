import i18n from '@dhis2/d2-i18n';

// Regression test for a real bug: src/locales/index.js is regenerated on
// every build from i18n/*.po and calls i18n.addResourceBundle(...), but
// nothing actually loads that module unless something imports it — it's not
// wired up automatically by the build tooling or the DHIS2 app-shell. If the
// `import './locales'` side-effect import is ever removed from App.jsx, every
// i18n.t() call silently falls back to its raw English key, in every locale,
// with no error anywhere. (The real app-shell's @dhis2/app-adapter package
// separately calls i18n.setDefaultNamespace('default') at import time, which
// is why the resource bundle below must be registered under 'default' too —
// reproduced here so this test matches production namespace behavior.)
test('importing App registers the fr resource bundle under the namespace the app-shell expects', async () => {
  i18n.setDefaultNamespace('default');
  expect(i18n.hasResourceBundle('fr', 'default')).toBe(false);

  require('./App.jsx');

  expect(i18n.hasResourceBundle('fr', 'default')).toBe(true);
  await i18n.changeLanguage('fr');
  expect(i18n.t('Cancel')).toBe('Annuler');
});
