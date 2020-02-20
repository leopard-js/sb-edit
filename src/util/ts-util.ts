// General-purpose utility functions for TypeScript

// Gets a property from an object, asserting that the property exists within
// that object. Useful for cases where an undefined property should error,
// since those cases will be caught at compile rather than runtime.
//
// From:
// https://mariusschulz.com/blog/keyof-and-lookup-types-in-typescript
export function prop<T, K extends keyof T>(obj: T, key: K) {
  return obj[key];
}
