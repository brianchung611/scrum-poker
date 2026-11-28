import type { CardValue, VoteStats as Stats } from '@scrum-poker/shared';
import { useTranslation } from 'react-i18next';

interface Props {
  stats: Stats;
  cards: CardValue[];
  votes?: Record<string, CardValue>;
}

export function VoteStats({ stats, cards, votes }: Props) {
  const { t, i18n } = useTranslation('game');
  const format = (n: number | null) =>
    n === null ? '–' : new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(n);

  const items: [string, number | null][] = [
    [t('stats.average'), stats.average],
    [t('stats.median'), stats.median],
    [t('stats.min'), stats.min],
    [t('stats.max'), stats.max],
  ];

  // Decks without numbers (T-shirt sizes, custom words) have no average, so show a tally.
  const tally = cards
    .map((card) => [card, Object.values(votes ?? {}).filter((v) => v === card).length] as const)
    .filter(([, count]) => count > 0);

  return (
    <section className="panel" aria-labelledby="results-heading">
      <h2 id="results-heading">{t('results')}</h2>
      {stats.average === null ? (
        <ul className="tally">
          {tally.map(([card, count]) => (
            <li key={card}>
              <span className="tally-card">{card}</span>
              <span aria-label={t('tallyCount', { count })}>× {count}</span>
            </li>
          ))}
        </ul>
      ) : (
      <dl className="stats">
        {items.map(([name, value]) => (
          <div key={name} className="stat">
            <dt>{name}</dt>
            <dd>{format(value)}</dd>
          </div>
        ))}
      </dl>
      )}
    </section>
  );
}
