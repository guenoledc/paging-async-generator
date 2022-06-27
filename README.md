# paging-async-generator

Provides a nice way to iterate over asynchronous calls without waiting for them while managing the size of the concurrent calls

This library has two special use cases that most has encountered when dealing with web pages or programs:
1. Having to load lots of ressources from remote servers or asynchronous source and facing the contention on the client side or server side
2. Having to load data in advance of the user needing it in a paginated environment

This library is relying on [async generator](https://javascript.info/async-iterators-generators) to allow the developer to freely iterate at its own speed and need through the content of the loaded resource

## Install
like any other library

```sh
npm install paging-async-generator
```

## Get started
Available in typescript, the library will be demonstrated in javascript for everybody convenience, assuming that typescript developpers will be able to translate.

```js
const {pagingGenerator: pIt} = require('paging-async-generator');

const http = axios.default.create({validateStatus: s=>s>=200 && s<300});
// replace with your function to access external resource
// it is an asynchronous function can optionally can receive the page and index of the call progress
async function todo(page, index) {
  const res = await http.get(`https://jsonplaceholder.typicode.com/todos/${page*10+index+1}`)
  return res.data && res.data.id? res.data : undefined;
}

// call the todo function by blocks of 5 items per page and make them available in the for
// continue until the return value of the todo function is undefined
for await (let res of pIt(todo, 5)) {
  // res contains the value, page, index and possibly and error
  if (res.error) console.error("on", res.page, res.index, "fail", res.error.message)
  else console.log("on", res.page, res.index, "task", res.value.id, res.value.title)
}
// this should list the 200 items of the todos' collection.
```

## Controlled iteration
With the same above example, say we need to read the items on reaction to the user action

```js
const {pagingGenerator: pIt} = require('paging-async-generator');

const http = axios.default.create({validateStatus: s=>s>=200 && s<300});
// replace with your function to access external resource
// it is an asynchronous function can optionally can receive the page and index of the call progress
async function todo(page, index) {
  const res = await http.get(`https://jsonplaceholder.typicode.com/todos/${page*10+index+1}`)
  return res.data && res.data.id? res.data : undefined;
}

// Page initialization
const pageSize = 10;
const cursor = pIt(todo, pageSize);

const el = document.getElementById("your-button")
el..addEventListener("click",  async ()=>{
  // executes on each user click
  const res = await cursor.next();
  if (res.done) return; // you have no more item to read
  if (res.value.error) console.error("The call failed", res.value.error.message)
  else console.log("new task", res.value.id, res.value.title)
})

```
You can easilly replace the click event by a page scrolling or anything else that fits your UI

## More advanced functions
The mode of execution of the iterator returned by `pIt` has the following logic
1. initiate a page
    * launch `pageSize` asynchronous request in //
    * wait for the first available value and returns it (yield)
    * wait for subsequent values in the submitted result and return (yield) them when requested
    * if all values of the pages have been retrieved, finish the page
    * if a returned value was the last (`islast()`) then finish the page and finish the iteration
2. if the iteraton is not finished, prepare a new page and continue on 1.

Yielded values are made of the actual result from the `asyncFunc`, possible error caught, page number and index in page. Errors can be silently processed (ie returned) or thrown depending on the options.


The function creating the iterator `pIt(asyncFunc, pageSize, options)` accepts a 3rd parameter `options`  that defaults as follow

```typescript
const defaultOptions:PagingOptions = {
  isLast:(v)=>v==undefined,         // called after each call of the `asyncFunc` with the result to determine if the value should be considered as the last to retrieved
  isError:(v)=>v instanceof Error,  // called after each call of the `asyncFunc` with the result to determine if the value is to be considered as an error
  keepOrder: false,                 // tells the iterator to return the result in the order they were called. If false, the results in a page appear in the order they completed (faster reponses first). If true, the results appear in the order they were made.
  maxErrors: -1,                   // the max numbers of errors to accept before the iterator returns an error. -1 means no error counting. 
  throwOnMaxError: false           // indicates to throw if more than maxErrors have been detected or to quietly finish the iteration.
}
```

