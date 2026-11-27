import { SUPPORTED_LOCALES } from '@scrum-poker/shared';
import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation('common');

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <span aria-hidden="true">🌐</span>
      <select
        aria-label={t('language')}
        value={i18n.resolvedLanguage}
        onChange={(event) => {
          void i18n.changeLanguage(event.target.value);
        }}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {t(`languages.${locale}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
