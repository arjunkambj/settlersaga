import type { DiceRoll } from "./types";

interface RandomValue {
  nextIndex: number;
  value: number;
}

function hash32(value: string) {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2_246_822_507);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3_266_489_909);
  hash ^= hash >>> 16;

  return hash >>> 0;
}

export function deterministicInteger(
  seed: string,
  randomIndex: number,
  maximum: number,
): RandomValue {
  if (!Number.isInteger(maximum) || maximum <= 0) {
    throw new Error("maximum must be a positive integer");
  }

  return {
    nextIndex: randomIndex + 1,
    value: hash32(`${seed}:${randomIndex}`) % maximum,
  };
}

function shuffleFrom<Value>(values: readonly Value[], seed: string, randomIndex: number) {
  const shuffled = [...values];
  let nextIndex = randomIndex;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const draw = deterministicInteger(seed, nextIndex, index + 1);
    nextIndex = draw.nextIndex;
    [shuffled[index], shuffled[draw.value]] = [shuffled[draw.value]!, shuffled[index]!];
  }

  return { nextIndex, values: shuffled };
}

export function deterministicShuffle<Value>(values: readonly Value[], seed: string): Value[] {
  return shuffleFrom(values, seed, 0).values;
}

export function createBalancedDiceBag(seed: string, randomIndex: number) {
  const rolls: DiceRoll[] = Array.from({ length: 36 }, (_, index) => {
    const first = Math.floor(index / 6) + 1;
    const second = (index % 6) + 1;
    return { first, second, sum: first + second };
  });
  const { nextIndex, values } = shuffleFrom(rolls, seed, randomIndex);
  return { bag: values, nextIndex };
}
