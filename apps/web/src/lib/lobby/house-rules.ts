import { FRIENDLY_ROBBER_MAX_VICTORY_POINTS, type BaseGameSettings } from "@settersaga/game";

/** The on/off table rules, i.e. every boolean game setting. */
type HouseRule = {
  [Key in keyof BaseGameSettings]: BaseGameSettings[Key] extends boolean ? Key : never;
}[keyof BaseGameSettings];

export const HOUSE_RULE_OPTIONS = [
  {
    artSrc: "/game-assets/rules/friendly-robber.png",
    description: `The robber leaves players with ${FRIENDLY_ROBBER_MAX_VICTORY_POINTS} points or fewer alone.`,
    label: "Friendly Robber",
    value: "friendlyRobber",
  },
  {
    artSrc: "/game-assets/rules/balanced-dice.png",
    description: "Rolls are drawn from a shuffled deck of all 36 outcomes, so streaks are rare.",
    label: "Balanced Dice",
    value: "balancedDice",
  },
  {
    artSrc: "/game-assets/rules/hidden-bank.png",
    description: "Nobody can see how many cards the bank has left.",
    label: "Hidden Bank",
    value: "hideBankCards",
  },
] as const satisfies ReadonlyArray<{
  artSrc: string;
  description: string;
  label: string;
  value: HouseRule;
}>;
