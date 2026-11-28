import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Header() {
  const { t } = useTranslation('common');

  return (
    <header className="app-header">
      <Link to="/" className="app-name">
        {t('appName')}
      </Link>
      <LanguageSwitcher />
    </header>
  );
}
