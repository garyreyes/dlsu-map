import {
  Check,
  CloudDownload,
  CloudOff,
  LoaderCircle,
  Map as MapIcon,
  Tag,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import type { InfoOffline } from '@/features/offline';
import { IconButton } from '@/shared/ui/IconButton';
import { readableDate, versionText } from '../version';
import { useMapDate } from './useMapDate';

interface Props {
  /** Whether the map works here with no signal, and if not, why (`useInfoOffline`). */
  offline: InfoOffline;
  onClose: () => void;
}

/** One info row (DESIGN.md, Lists and rows): an icon, a semibold title and a Mid Ink line under it. */
function Row({
  icon: Icon,
  accent,
  title,
  children,
}: {
  icon: LucideIcon;
  accent?: boolean;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex min-h-14 items-start gap-3.5 py-3">
      <Icon
        className={`mt-0.5 size-6 flex-none ${accent ? 'text-accent' : 'text-ink-3'}`}
        strokeWidth={accent ? 2.5 : 2}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="m-0 font-semibold text-ink">{title}</p>
        {children && <p className="m-0 text-ink-2">{children}</p>}
      </div>
    </li>
  );
}

/** The offline line's words: "Ready offline" is the one confirmation; the rest say what isn't saved and what to do. */
const OFFLINE: Record<InfoOffline, { icon: LucideIcon; title: string; line: string }> = {
  ready: { icon: Check, title: 'Ready offline', line: 'Works with no signal, even in airplane mode.' },
  saving: { icon: CloudDownload, title: 'Saving for offline…', line: 'Keep the app open with internet for a minute.' },
  'saving-paused': { icon: CloudOff, title: 'Saving paused', line: "It finishes when you're back online." },
  checking: { icon: LoaderCircle, title: 'Checking the offline copy…', line: 'This takes a moment.' },
  'not-saved': { icon: CloudOff, title: 'Not saved offline', line: 'Open with internet to save again.' },
  'cannot-save': {
    icon: CloudOff,
    title: "This browser can't save the map",
    line: 'Open it in a normal (not private) Safari or Chrome tab.',
  },
};

function OfflineRow({ offline }: { offline: InfoOffline }) {
  const { icon, title, line } = OFFLINE[offline];
  return (
    <Row icon={icon} accent={offline === 'ready'} title={title}>
      {line}
    </Row>
  );
}

/** The OSM credit the data licence requires (D4). The link's tap area reaches past the word to 48px tall. */
function CreditRow() {
  const mapDate = useMapDate();
  const credit = (
    <>
      Map data ©{' '}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="relative text-accent underline after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']"
      >
        OpenStreetMap
      </a>{' '}
      contributors
    </>
  );
  return (
    <Row icon={MapIcon} title={credit}>
      {mapDate && `Campus map as of ${readableDate(mapDate)}`}
    </Row>
  );
}

/**
 * S10, the ⓘ sheet (user-flows §5): whether the map works offline here (or O3), the credits, the beta label and the
 * version. Report a problem joins it once the team's Google Form exists (D24).
 */
export function InfoSheet({ offline, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <section aria-labelledby="info-title" className="pb-2">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pt-3">
          <h2 id="info-title" className="m-0 text-lg font-semibold text-ink">
            DLSU 3D Campus Navigator
          </h2>
          <span className="rounded-tag bg-accent-wash px-1.5 py-0.5 text-sm font-semibold tracking-[0.02em] text-accent">
            Beta
          </span>
        </div>
        <IconButton label="Close" onClick={onClose}>
          <X className="size-6" strokeWidth={2} />
        </IconButton>
      </div>
      <ul className="m-0 mt-2 list-none p-0">
        <OfflineRow offline={offline} />
        <CreditRow />
        <Row icon={Users} title="Student project, not an official DLSU app.">
          Still in beta, so some rooms or routes may be wrong.
        </Row>
        <Row icon={Tag} title={versionText(__APP_COMMIT__, __APP_BUILT__)} />
      </ul>
    </section>
  );
}
