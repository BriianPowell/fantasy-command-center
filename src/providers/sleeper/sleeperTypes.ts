export interface SleeperLeague {
  league_id: string
  name: string
  season: string
  draft_id?: string
  total_rosters: number
  roster_positions?: string[]
  scoring_settings?: Record<string, number>
  settings?: {
    playoff_week_start?: number
  }
}

export interface SleeperUser {
  user_id: string
  display_name?: string
  username?: string
  avatar?: string
  metadata?: {
    team_name?: string
  }
}

export interface SleeperRoster {
  roster_id: number
  owner_id?: string
  players?: string[]
  starters?: string[]
  taxi?: string[]
}

export interface SleeperNflState {
  week: number
  display_week?: number
  season: string
  season_type: string
  league_season?: string
  previous_season?: string
  leg?: number
}

export interface SleeperMatchup {
  roster_id: number
  matchup_id?: number
  points?: number
  players?: string[]
  starters?: string[]
  players_points?: Record<string, number>
  starters_points?: number[]
}

export interface SleeperTransaction {
  transaction_id: string
  type?: string
  status?: string
  roster_ids?: number[]
  adds?: Record<string, number>
  drops?: Record<string, number>
  waiver_budget?: {
    sender: number
    receiver: number
    amount: number
  }[]
  draft_picks?: SleeperTradedPick[]
}

export interface SleeperTradedPick {
  season: string
  round: number
  roster_id: number
  owner_id?: number
  previous_owner_id?: number
}

export interface SleeperDraft {
  draft_id: string
  type?: string
  status?: string
  settings?: {
    rounds?: number
  }
  metadata?: {
    scoring_type?: string
  }
}

export interface SleeperPick {
  pick_no: number
  round: number
  roster_id?: number
  player_id?: string
  picked_by?: string
  metadata?: {
    first_name?: string
    last_name?: string
    position?: string
    team?: string
  }
}

export interface SleeperPlayer {
  player_id: string
  first_name?: string
  last_name?: string
  full_name?: string
  team?: string
  fantasy_positions?: string[]
  position?: string
  age?: number
  years_exp?: number
  injury_body_part?: string
  injury_notes?: string
  injury_start_date?: string
  injury_status?: string
  bye_week?: number
  search_rank?: number
  active?: boolean
}

export interface SleeperTrendingPlayer {
  player_id: string
  count: number
}
