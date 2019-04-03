/**
 *
 *
 * @export
 * @param {Function} func
 * @returns
 */
export function curryRight2(func: Function) {
  return function (arg2: any) {
    return function (arg1: any) {
      return func(arg1, arg2);
    };
  };
}


export function curryRight3(func: Function) {
  return function(arg3: any) {
    return function(arg2: any) {
      return function(arg1: any) {
        return func(arg1, arg2, arg3);
      };
    };
  }
}
