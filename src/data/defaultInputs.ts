import { modelNotes } from './generated/modelNotes'
import { modelProjections } from './generated/modelProjections'
import { modelRankings } from './generated/modelRankings'
import type { PlayerNote, Projection, Ranking } from '../domain/types'

export const defaultRankings: Ranking[] = modelRankings

export const defaultProjections: Projection[] = modelProjections

export const defaultPlayerNotes: PlayerNote[] = modelNotes
