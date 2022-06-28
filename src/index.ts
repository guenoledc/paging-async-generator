
// ############################################################
// START LIBRARY
// AUTHOR: Guénolé de Cadoudal (guenoledc@yahoo.fr)
// Date: 26/06/1974
// ############################################################

/**
 * Options for the pagingGenerator.    
 * Templated with type T being the type returned by the asynchronous callback function
 */
export interface PagingOptions<T = any> {
  /** called after each call of the `asyncFunc` with the result to determine if the value should be considered as the last to retrieved */
  isLast:(v:T)=>boolean;
  /** called after each call of the `asyncFunc` with the result to determine if the value is to be considered as an error */
  isError:(v:T)=>boolean;
  /** tells the iterator to return the result in the order they were called. If false, the results in a page appear in the order they completed (faster reponses first). If true, the results appear in the order they were made. */
  keepOrder: boolean;
  /** the max numbers of errors to accept before the iterator returns an error. -1 means no error counting.  */
  maxErrors: number;
  /** indicates to throw if more than maxErrors have been detected or to quietly finish the iteration. */
  throwOnMaxError: boolean;
}

// default options when a field is not specified
const defaultOptions:PagingOptions = {
  isLast:(v)=>v==undefined,
  isError:(v)=>v instanceof Error,
  keepOrder: false,
  maxErrors: -1,
  throwOnMaxError: false
}

/**
 * Type of function that takes
 * @param page : receives the page index, from zero
 * @param index : receive the index of the call in the page
 * @returns A promise of type T
 * This function type is the format of the function that is expected to be called by the pagingGenerator
 */
export type PagingAsyncCallback<T = any> = (page?:number, index?:number) => Promise<T>;

/**
 * The structure that the iterator created by the pagingGenerator returns when using `it.next().value` 
 */
export interface PagingResult<T = any>{
  /** The value returned by the `PagingAsyncCallback<T>` */
  value: T | undefined;
  /** Any error raised by the `PagingAsyncCallback<T>` */
  error: any;
  /** the page index when calling the async callback */
  page: number;
  /** the index in the page when calling the async callback */
  index: number;
}

interface PagingResultIntermediary<T = any> extends PagingResult<T> {
  done: boolean;
}

type PagingAsyncGeneratorIntermediary<T> = AsyncGenerator<PagingResultIntermediary<T>, PagingResultIntermediary<T>, PagingResultIntermediary<T>>
type PagingAsyncGenerator<T> = AsyncGenerator<PagingResult<T>, PagingResult<T>, PagingResult<T>>

/**
 * Error class for the `pagingGenerator`. It contains the `page` index and the `index` in the page
 */
export class PagingError extends Error {
  constructor(message: string, public page:number, public index: number) {
    super(message)
  }
}


function makePagingAsyncCallbackFromArray<T>(array: PagingAsyncCallback<T>[]): PagingAsyncCallback<T> {
  const iterator = array.values();
  return async (page, index) => {
    const ret = iterator.next();
    if (ret.done) return (undefined as unknown as T);
    else {
      if (typeof ret.value !== "function") throw new PagingError("functions in array must be an async function", 0, -1);
      return await ret.value(page, index)
    }
  }
}

async function* pageGenerator<T = any>(
  asyncCallback:PagingAsyncCallback<T>, 
  page: number, pageSize: number, 
  options:Partial<PagingOptions<T>>)
    : PagingAsyncGeneratorIntermediary<T>
  {
  const opts:PagingOptions<T> = { ...defaultOptions, ...options};
  const results:{v?:T, error?:any, index:number}[] = [];
  let undefResult = 0;
  async function wrapCallback(p: Promise<T>, index: number) {
    function add(obj: any) {
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

  // initiate the calls to the promises but do not wait here
  for (let i = 0; i < pageSize; i++) {
      wrapCallback(asyncCallback(page, i),i)
  }

  let count = 0;
  while(count+undefResult < pageSize) {
    // test if we have result to read and the next result is available (for keepOrder)
    if (results.length>count && results[count] != undefined) {
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
      await new Promise( r=>setImmediate(r) );
    }
  }
  // console.log("finished page");
  if (undefResult==0) return {done: false, page, value: undefined, error: undefined, index:-1}
  else return {done: true, page, value: undefined, error: undefined, index:-1}
}


/**
 * Creates an iterator that calls `asyncCallback` in advance by group of `pageSize` and delivers them one by one and continue on the next page (or group)
 * @param asyncCallback an synchronous function that will be called until its result is considered as the last (see `isLast()` in the options). Or an array of these functions each being called only once.
 * @param pageSize The number of calls to perform in parallel in advance of the value being read
 * @param options The options to configure the behaviour of the iterator. @see PagingOptions
 * @returns An AsyncGenerator that can be iterated over with `for await(let res of pagingGenerator(..)) {}` of with `it = pagingGenerator(..); await it.next(); await it.next(); ...`
 */
export async function* pagingGenerator<T>(
    asyncCallback: PagingAsyncCallback<T>|PagingAsyncCallback<T>[], 
    pageSize: number, 
    options:Partial<PagingOptions<T>> = defaultOptions): PagingAsyncGenerator<T> {
  // transform the array of callbacks into a single function that will iterate over the array
  if (Array.isArray(asyncCallback)) asyncCallback = makePagingAsyncCallbackFromArray(asyncCallback);
  const opts:PagingOptions<T> = { ...defaultOptions, ...options};
  if (!pageSize || pageSize<=0) pageSize = 2;
  if (typeof asyncCallback !== "function") throw new PagingError("first parameter must be an async function", 0, -1);
  let page = 0;
  let it = pageGenerator<T>(asyncCallback, page++, pageSize, opts);
  let errorCount = 0;

  let n = await it.next();
  while(true) {
    if (n.done) { // this page is completed
      if(n.value.done) { // no more page
        return {page, index:-1, value: undefined, error: undefined}
      } else { // there may be more pages
        it = pageGenerator(asyncCallback, page++, pageSize, opts);
      }
    } else {
      // yied the value, even if it is an error
      yield {
        value: n.value.value, 
        error: n.value.error, 
        page: n.value.page, 
        index: n.value.index
      };
      // if there is an error and the error counting is activated => increase
      if (n.value.error !== undefined && opts.maxErrors>=0) errorCount++;
      // if we reached more error than allowed and error counting is activated ==> return on next()
      if (errorCount>=opts.maxErrors && opts.maxErrors>=0) {
        if (opts.throwOnMaxError) {
          throw new PagingError("max errors reached", n.value.page, n.value.index)
        } else {
          return {
            value:undefined, 
            error: "max errors reached", 
            page: n.value.page, 
            index: n.value.index
          }
        }
      }
    }
    n = await it.next();
  }
}
