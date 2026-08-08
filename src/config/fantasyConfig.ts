import type { LeagueDraftModeConfig } from '../domain/draftBoardMode'

export const fantasyConfig = {
  leagueDraftModes: {
    // ShaDynasty uses rookie drafts after startup, but the in-season board should stay full pool.
    '1357563614201933824': {
      activeDraft: 'rookieDraft',
      season: 'dynasty',
    },
  } as Record<string, LeagueDraftModeConfig>,
  season: '2026',
  sleeperLeagueIds: [
    '1312240875861979136',
    '1357563614201933824',
    '1389723007303307266',
  ],
  sleeperUsernames: ['boog', 'BooooooooG'],
} as const
