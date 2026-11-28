import type { VoteStats as Stats } from '@scrum-poker/shared';
import { useTranslation } from 'react-i18next';

export function VoteStats({ stats }: { stats: Stats }) {
  const { t, i18n } = useTranslation('game');
  const format = (n: number | null) =>
    n === null ? '–' : new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(n);

  const items: [string, number | null][] = [
    [t('stats.average'), stats.average],
    [t('stats.median'), stats.median],
    [t('stats.min'), stats.min],
    [t('stats.max'), stats.max],
  ];

  return (
    <section className="panel" aria-labelledby="results-heading">
      <h2 id="results-heading">{t('results')}</h2>
      <dl className="stats">
        {items.map(([name, value]) => (
          <div key={name} className="stat">
            <dt>{name}</dt>
            <dd>{format(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
