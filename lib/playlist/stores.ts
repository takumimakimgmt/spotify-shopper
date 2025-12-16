import type { StoreLinks, PlaylistRow } from '../types';
import { withBeatportAid } from '../affiliates/beatport';

const BEATPORT_A_AID = process.env.NEXT_PUBLIC_BEATPORT_A_AID;

export function normalizeStores(stores: StoreLinks, beatportAid: string | undefined = BEATPORT_A_AID): StoreLinks {
  return {
    beatport: withBeatportAid(stores?.beatport ?? '', beatportAid),
    bandcamp: stores?.bandcamp ?? '',
    itunes: stores?.itunes ?? '',
  };
}

export function getRecommendedStore(track: PlaylistRow): { name: string; url: string } | null {
  const stores = normalizeStores(track.stores);

  if (stores.beatport && stores.beatport.length > 0) {
    return { name: 'Beatport', url: stores.beatport };
  }
  if (stores.bandcamp && stores.bandcamp.length > 0) {
    return { name: 'Bandcamp', url: stores.bandcamp };
  }
  if (stores.itunes && stores.itunes.length > 0) {
    return { name: 'iTunes', url: stores.itunes };
  }
  return null;
}

export function getOtherStores(stores: StoreLinks, recommended: { name: string; url: string } | null): Array<{ name: string; url: string }> {
  const s = normalizeStores(stores);
  const others: Array<{ name: string; url: string }> = [];
  if (s.beatport && s.beatport.length > 0 && recommended?.name !== 'Beatport') {
    others.push({ name: 'Beatport', url: s.beatport });
  }
  if (s.bandcamp && s.bandcamp.length > 0 && recommended?.name !== 'Bandcamp') {
    others.push({ name: 'Bandcamp', url: s.bandcamp });
  }
  if (s.itunes && s.itunes.length > 0 && recommended?.name !== 'iTunes') {
    others.push({ name: 'iTunes', url: s.itunes });
  }
  return others;
}
