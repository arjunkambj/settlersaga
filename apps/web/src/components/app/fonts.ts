import { Plus_Jakarta_Sans } from "next/font/google";

/** Every piece of UI text: body 500, labels 600-700, titles and numbers 800. */
const jakartaSans = Plus_Jakarta_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-jakarta-sans",
  weight: ["500", "600", "700", "800"],
});

/** Classes for `<html>` that define the font variables the theme's font stacks read. */
export const fontVariables = jakartaSans.variable;
