export function generateId(): string {
  let id = "";
  for (let i = 0; i < 24; i++) {
    id += Math.floor(Math.random() * 36).toString(36);
  }
  return id;
}
