import { TIMER_PRESETS_SECONDS } from '@scrum-poker/shared';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { startTimer, stopTimer } from '../store/useRoomStore';

interface Props {
  /** Local epoch ms when the countdown ends, or null if none is running. */
  endsAt: number | null;
  isFacilitator: boolean;
}

function format(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TimerPanel({ endsAt, isFacilitator }: Props) {
  const { t } = useTranslation('game');
  const [now, setNow] = useState(Date.now());
  const [seconds, setSeconds] = useState<number>(TIMER_PRESETS_SECONDS[1]);
  const selectId = useId();

  useEffect(() => {
    if (endsAt === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  // Participants only see the timer while it's relevant; the facilitator always gets the controls.
  if (endsAt === null && !isFacilitator) return null;

  const remainingMs = endsAt === null ? null : Math.max(0, endsAt - now);
  const secondsLeft = remainingMs === null ? null : Math.ceil(remainingMs / 1000);
  const timeUp = remainingMs === 0;

  return (
    <section className="panel timer" aria-label={t('timer')}>
      {secondsLeft !== null && (
        <>
          {/* No live announcements every second; only "time's up" is announced. */}
          <span
            role="timer"
            className={`timer-display${timeUp ? ' timer-up' : secondsLeft <= 10 ? ' timer-low' : ''}`}
          >
            {format(secondsLeft)}
          </span>
          <span role="status" className={timeUp ? 'timer-up' : 'sr-only'}>
            {timeUp ? t('timeUp') : ''}
          </span>
        </>
      )}
      {isFacilitator && (
        <div className="timer-controls">
          {endsAt === null ? (
            <>
              <label htmlFor={selectId} className="sr-only">
                {t('timerDuration')}
              </label>
              <select
                id={selectId}
                value={seconds}
                onChange={(event) => setSeconds(Number(event.target.value))}
              >
                {TIMER_PRESETS_SECONDS.map((s) => (
                  <option key={s} value={s}>
                    {t(`timerPreset.${s}`)}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => startTimer(seconds)}>
                {t('timerStart')}
              </button>
            </>
          ) : (
            <button type="button" onClick={stopTimer}>
              {t('timerStop')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
