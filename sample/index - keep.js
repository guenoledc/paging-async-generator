
// ############################################################
// START LIBRARY
// AUTHOR: Guénolé de Cadoudal (guenoledc@yahoo.fr)
// Date: 26/06/1974
// ############################################################
const timer = require('timers/promises');
const defaultOptions = {
    isLast:(v)=>v==undefined,
    isError:(v)=>v instanceof Error,
    keepOrder: false
  }
  
async function* pageGenerator(
  asyncCallback, 
  page, pageSize, 
  options)
  {

  const opts = { ...defaultOptions, ...options};
  const results = [];
  let undefResult = 0;
  async function wrapCallback(p, index) {
    function add(obj) {
      if (options.keepOrder) {
        results[index] = obj;
      } else {
        results.push(obj);
      }
    }
    try {
      const v = await p;
      if ( opts.isError(v)) add({error: v, index});
      else if (! opts.isLast(v)) add({v,index});
      else  undefResult ++;
    } catch (error) {
      add({error, index});
    }
  }

  if (opts.keepOrder && false) {
    // we want the result of the promise in order of call
    // so first we make the promise all in //
    const promises = [];
    for (let i = 0; i < pageSize; i++) {
        console.log("> ", i)
        try {
            promises.push(asyncCallback(page, i))
        } catch (error) {
            promises.push(Promise.reject(error))
        }
    }
    // then we wait for the fist one to complete, then the second ...
    for (let i = 0; i < promises.length; i++) {
        console.log(">> ", i)
      await wrapCallback(promises[i], i);
    }

  } else {
    // initiate the calls to the promises but do not wait here
    for (let i = 0; i < pageSize; i++) {
        wrapCallback(asyncCallback(page, i),i)
    }
  }

  let count = 0;
  while(count+undefResult < pageSize) {
    // we can process 
    if (results.length>count && results[count]!==undefined) {
      // there is a result to return to the caller
      yield {
        value:results[count].v, 
        error:results[count].error, 
        done: false, 
        page, 
        index:results[count++].index
      }
    } 
    else {
      // no result yet, pause to work on other activities of the program
      await timer.setImmediate();
    }
  }
  // console.log("finished page");
  if (undefResult==0) return {done: false, page, value: undefined, error: undefined, index:-1}
  else return {done: true, page, value: undefined, error: undefined, index:-1}
}

async function* pagingGenerator(
    asyncCallback, 
    pageSize, 
    options = defaultOptions) {
  if (!pageSize || pageSize<=0) pageSize = 2;
  if (typeof asyncCallback !== "function") throw new Error("first parameter must be an async function")
  let page = 0;
  let it = pageGenerator(asyncCallback, page++, pageSize, options);
  
  let n = await it.next();
  while(true) {
    if (n.done) { // this page is completed
      if(n.value.done) { // no more page
        return {page, index:-1, value: undefined, error: undefined}
      } else { // there may be more pages
        it = pageGenerator(asyncCallback, page++, pageSize, options);
      }
    } else yield {value: n.value.value, error: n.value.error, page: n.value.page, index: n.value.index};
    n = await it.next();
  }
}

module.exports = {pagingGenerator}
