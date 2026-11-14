import { Lilita_One, Plus_Jakarta_Sans } from "next/font/google";

/** Body text, labels and log lines: body 500, labels 600-700, strong 800. */
const jakartaSans = Plus_Jakarta_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-jakarta-sans",
  weight: ["500", "600", "700", "800"],
});

/**
 * The chunky game face: titles, points, turn calls and the main buttons. It has one weight,
 * and is drawn with the dark game outline (`.game-type` in styles.css).
 */
const lilitaOne = Lilita_One({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-lilita-one",
  weight: "400",
});

/** Classes for `<html>` that define the font variables the theme's font stacks read. */
export const fontVariables = `${jakartaSans.variable} ${lilitaOne.variable}`;
