/**
 * Adapta uma função `async` para um ouvinte de evento ou callback que espera
 * `void`: a Promise não volta para o DOM, que a ignoraria de qualquer jeito.
 */
export const asyncListener =
  <Args extends unknown[]>(task: (...args: Args) => Promise<void>) =>
  (...args: Args): void => {
    void task(...args);
  };
