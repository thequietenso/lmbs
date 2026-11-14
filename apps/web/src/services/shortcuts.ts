/** Slash is ordinary input inside a form; command-K is an explicit global action. */
export function shouldFocusSearch(key: string, command: boolean, typing: boolean): boolean {
  return (command && key.toLowerCase() === 'k') || (key === '/' && !typing);
}
