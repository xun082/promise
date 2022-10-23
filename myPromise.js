class myPromise {
  // 用static创建静态属性，用来管理状态
  static PENDING = "pending";
  static FULFILLED = "fulfilled";
  static REJECTED = "rejected";

  // 构造函数：通过new命令生成对象实例时，自动调用类的构造函数
  constructor(func) {
    // 给类的构造方法constructor添加一个参数func
    this.PromiseState = myPromise.PENDING; // 指定Promise对象的状态属性 PromiseState，初始值为pending
    this.PromiseResult = null; // 指定Promise对象的结果 PromiseResult
    this.onFulfilledCallbacks = []; // 保存成功回调
    this.onRejectedCallbacks = []; // 保存失败回调
    try {
      /**
       * func()传入resolve和reject，
       * resolve()和reject()方法在外部调用，这里需要用bind修正一下this指向
       * new 对象实例时，自动执行func()
       */
      func(this.resolve.bind(this), this.reject.bind(this));
    } catch (error) {
      // 生成实例时(执行resolve和reject)，如果报错，就把错误信息传入给reject()方法，并且直接执行reject()方法
      this.reject(error);
    }
  }

  resolve(result) {
    // result为成功态时接收的终值
    // 只能由pending状态 => fulfilled状态 (避免调用多次resolve reject)
    if (this.PromiseState === myPromise.PENDING) {
      this.PromiseState = myPromise.FULFILLED;
      this.PromiseResult = result;
      /**
       * 在执行resolve或者reject的时候，遍历自身的callbacks数组，
       * 看看数组里面有没有then那边 保留 过来的 待执行函数，
       * 然后逐个执行数组里面的函数，执行的时候会传入相应的参数
       */
      this.onFulfilledCallbacks.forEach((callback) => {
        callback(result);
      });
    }
  }

  reject(reason) {
    // reason为拒绝态时接收的终值
    // 只能由pending状态 => rejected状态 (避免调用多次resolve reject)
    if (this.PromiseState === myPromise.PENDING) {
      this.PromiseState = myPromise.REJECTED;
      this.PromiseResult = reason;
      this.onRejectedCallbacks.forEach((callback) => {
        callback(reason);
      });
    }
  }

  then(onFulfilled, onRejected) {
    // 2.2.7规范 then 方法必须返回一个 promise 对象
    let promise = new myPromise((resolve, reject) => {
      if (this.PromiseState === myPromise.FULFILLED) {
        setTimeout(() => {
          try {
            if (typeof onFulfilled !== "function") {
              // 2.2.7.3规范 如果 onFulfilled 不是函数且 promise1 成功执行， promise 必须成功执行并返回相同的值
              resolve(this.PromiseResult);
            } else {
              // 2.2.7.1规范 如果 onFulfilled 或者 onRejected 返回一个值 x ，则运行下面的 Promise 解决过程：[[Resolve]](promise, x)，即运行resolvePromise()
              let x = onFulfilled(this.PromiseResult);
              resolvePromise(promise, x, resolve, reject);
            }
          } catch (e) {
            // 2.2.7.2规范 如果 onFulfilled 或者 onRejected 抛出一个异常 e ，则 promise 必须拒绝执行，并返回拒因 e
            reject(e); // 捕获前面onFulfilled中抛出的异常
          }
        });
      } else if (this.PromiseState === myPromise.REJECTED) {
        setTimeout(() => {
          try {
            if (typeof onRejected !== "function") {
              // 2.2.7.4规范 如果 onRejected 不是函数且 promise1 拒绝执行， promise 必须拒绝执行并返回相同的据因
              reject(this.PromiseResult);
            } else {
              let x = onRejected(this.PromiseResult);
              resolvePromise(promise, x, resolve, reject);
            }
          } catch (e) {
            reject(e);
          }
        });
      } else if (this.PromiseState === myPromise.PENDING) {
        // pending 状态保存的 onFulfilled() 和 onRejected() 回调也要符合 2.2.7.1，2.2.7.2，2.2.7.3 和 2.2.7.4 规范
        this.onFulfilledCallbacks.push(() => {
          setTimeout(() => {
            try {
              if (typeof onFulfilled !== "function") {
                resolve(this.PromiseResult);
              } else {
                let x = onFulfilled(this.PromiseResult);
                resolvePromise(promise, x, resolve, reject);
              }
            } catch (e) {
              reject(e);
            }
          });
        });
        this.onRejectedCallbacks.push(() => {
          setTimeout(() => {
            try {
              if (typeof onRejected !== "function") {
                reject(this.PromiseResult);
              } else {
                let x = onRejected(this.PromiseResult);
                resolvePromise(promise, x, resolve, reject);
              }
            } catch (e) {
              reject(e);
            }
          });
        });
      }
    });

    return promise;
  }

  static resolve(value) {
    // 如果这个值是一个promise,那么则返回这个promise
    if (value instanceof myPromise) {
      return value;
    } else if (value instanceof Object && "then" in value) {
      // 如果这个值是thenable,返回promise会跟随这个thenable的对象,采用他的最终状态
      return new myPromise((resolve, reject) => {
        value.then(resolve, reject);
      });
    }

    return new myPromise((resolve) => {
      resolve(value);
    });
  }

  static reject(reason) {
    return new myPromise((resolve, reject) => {
      reject(reason);
    });
  }

  catch(onRejected) {
    return this.then(undefined, onRejected);
  }

  finally(callback) {
    return this.then(callback, callback);
  }

  static all(promises) {
    return new myPromise((resolve, reject) => {
      if (Array.isArray(promises)) {
        const result = [];
        let count = 0;

        if (promises.length === 0) {
          // 如果是空数组,则返回成功的结果
          return resolve(promises);
        }

        promises.forEach((item, index) => {
          // 判断传入的item是否promise类型的或者是不是对象,且对象中是否有then
          if (
            item instanceof myPromise ||
            (item instanceof Object && "then" in item)
          ) {
            myPromise.resolve(item).then(
              (value) => {
                count++;
                // 每个promise执行的结果存储在result中
                result[index] = value;
                count === promises.length && resolve(result);
              },
              (reason) => {
                // Promise.all 异步地将失败的那个结果给失败状态的回调函数，而不管其它 promise 是否完成
                reject(reason);
              }
            );
          } else {
            // 参数里中非Promise值，原样返回在数组里
            count++;
            result[index] = item;
            count === promises.length && resolve(result);
          }
        });
      } else {
        return reject(new TypeError("Argument is not iterable"));
      }
    });
  }
}

/**
 * 对resolve()、reject() 进行改造增强 针对resolve()和reject()中不同值情况 进行处理
 * @param  {promise} promise promise1.then方法返回的新的promise对象
 * @param  {[type]} x         promise1中onFulfilled或onRejected的返回值
 * @param  {[type]} resolve   promise的resolve方法
 * @param  {[type]} reject    promise的reject方法
 */
function resolvePromise(promise, x, resolve, reject) {
  // 2.3.1规范 如果 promise 和 x 指向同一对象，以 TypeError 为据因拒绝执行 promise
  // 如果promise和x指向同一个对象,以 TypeError
  if (x === promise) {
    throw new TypeError("Chaining cycle detected for promise");
  }

  if (x instanceof myPromise) {
    //   如果 x 为promise,则继续执行promise,拿到一个y,还要继续解析y
    x.then((y) => {
      // 递归解析
      resolvePromise(promise, y, resolve, reject);
    }, reject);
  } else if (x !== null && (typeof x === "object" || typeof x === "function")) {
    // 如果 x 为对象或函数
    try {
      // 把 x.then 赋值给 then
      // 这里使用 var 定义全局变量
      var then = x.then;
    } catch (e) {
      // 2.3.3.2 如果取 x.then 的值时抛出错误 e ，则以 e 为据因拒绝 promise
      return reject(e);
    }

    /**
     * 如果 then 是函数，将 x 作为函数的作用域 this 调用
     * 传递两个回调函数作为参数，
     * 第一个参数叫做 `resolvePromise` ，第二个参数叫做 `rejectPromise`
     */
    if (typeof then === "function") {
      // 如果 resolvePromise 和 rejectPromise 均被调用，或者被同一参数调用了多次，则优先采用首次调用并忽略剩下的调用
      let called = false; // 避免多次调用
      try {
        then.call(
          x,
          // 如果 resolvePromise 以值 y 为参数被调用，则运行 [[Resolve]](promise, y)
          (y) => {
            //   如果已经调用了则返回
            if (called) return;
            called = true;
            resolvePromise(promise, y, resolve, reject);
          },
          // 如果 rejectPromise 以据因 r 为参数被调用，则以据因 r 拒绝 promise
          (r) => {
            if (called) return;
            called = true;
            reject(r);
          }
        );
      } catch (e) {
        /**
         * 如果调用 then 方法抛出了异常 e
         * 如果 resolvePromise 或 rejectPromise 已经被调用，则忽略之
         */
        if (called) return;
        called = true;

        // 否则以 e 为据因拒绝 promise
        reject(e);
      }
    } else {
      // 如果 then 不是函数，以 x 为参数执行 promise
      resolve(x);
    }
  } else {
    //  如果 x 不为对象或者函数，以 x 为参数执行 promise
    return resolve(x);
  }
}

// 官方测试要求需要有的,不关我事
myPromise.deferred = function () {
  let result = {};
  result.promise = new myPromise((resolve, reject) => {
    result.resolve = resolve;
    result.reject = reject;
  });
  return result;
};

module.exports = myPromise;

const p1 = Promise.resolve(3);
const p2 = {
  then: function (onFulfill) {
    onFulfill("then函数");
  },
};
const p3 = 42;

// Promise.all([p1, p2, p3]).then(
//   (result) => {
//     console.log("原生 all fulfilled :>> ", result);
//   },
//   (reason) => {
//     console.log("原生 all rejected :>> ", reason);
//   }
// );

myPromise.all([p1, p2, p3]).then(
  (res) => {
    console.log(res);
  },
  (reason) => {
    console.log(reason);
  }
);
