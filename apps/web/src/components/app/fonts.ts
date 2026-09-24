import { DM_Sans, Lilita_One } from "next/font/google";

const dmSans = DM_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const lilitaOne = Lilita_One({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-lilita-one",
  weight: "400",
});

/** Classes for `<html>` that define the font variables the theme's font stacks read. */
export const fontVariables = `${dmSans.variable} ${lilitaOne.variable}`;
