// The 11 preference tasks used by `otw bench` (the "kept" tasks of experiments 4-12; scorers as fixed in experiment 5b).
// Each task needs a habit a model cannot know, so a pass means the saved correction was followed.
import { TASKS as ALL_PREF } from './tasks-base.mjs'
const KEPT = ['c006', 'c057', 'c082', 'c015', 'c114', 'c136', 'c124', 'c137', 'c104', 'c004', 'c033']
export const PREF = ALL_PREF.filter(t => KEPT.includes(t.pref))
