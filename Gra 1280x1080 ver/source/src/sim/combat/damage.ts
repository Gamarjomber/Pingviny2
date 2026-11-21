import type { Rng } from '../../core/Rng';
import { COMBAT_CONFIG } from '../../data/combatConfig';
import type { Squad } from '../squad/Squad';

/**
 * Єдина точка, де базовий урон атаки стає фінальним: множник урону команди (бафи) і крит.
 * Крит-множник = базовий × модифікатор 'critMult'.
 */
export function rollDamage(base: number, squad: Squad, rng: Rng): number {
  let dmg = base * squad.modifiers.get('damage');
  if (rng.next() < COMBAT_CONFIG.critChance) dmg *= COMBAT_CONFIG.critMult * squad.modifiers.get('critMult');
  return dmg;
}
