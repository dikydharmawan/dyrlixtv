import { useEffect, useState } from 'react';

import { getEpg, subscribeEpg, type EpgGuide } from '@/services/epg';

/** Berlangganan guide EPG global sehingga komponen ikut ter-render saat guide siap. */
export function useEpg(): EpgGuide | null {
  const [guide, setGuide] = useState<EpgGuide | null>(getEpg);

  useEffect(() => subscribeEpg(setGuide), []);

  return guide;
}
