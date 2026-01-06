// ✅ CORRECT: Private helper functions (not exported)
function helperFunction() {
  /* ... */
}
function anotherHelper() {
  /* ... */
}

// ✅ CORRECT: Types exported as named exports alongside namespace
export interface ModuleConfig {
  /* ... */
}
export type ModuleResult = {
  /* ... */
};

// ✅ CORRECT: Public API exposed through const object
export const ModuleName = {
  method1: publicMethod1,
  method2: publicMethod2,
  init: initFunction,
};
