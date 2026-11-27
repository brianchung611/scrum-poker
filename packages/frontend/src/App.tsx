import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './components/LanguageSwitcher';

export default function App() {
  const { t } = useTranslation('common');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '1rem',
        }}
      >
        <LanguageSwitcher />
      </header>
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '1rem',
        }}
      >
        <h1>{t('appName')}</h1>
        <p>{t('tagline')}</p>
      </main>
    </div>
  );
}
