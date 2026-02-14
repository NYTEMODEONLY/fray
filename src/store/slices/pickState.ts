export const pickState = <State, Keys extends readonly (keyof State)[]>(
  state: State,
  keys: Keys
): Pick<State, Keys[number]> => {
  const picked: Partial<Pick<State, Keys[number]>> = {};

  for (const key of keys) {
    picked[key] = state[key];
  }

  return picked as Pick<State, Keys[number]>;
};
