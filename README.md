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
// it is an asynchronous function than can optionally receive the page and index of the call progress
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

## Execution logic
The mode of execution of the iterator returned by `pIt` has the following logic
1. initiate a page
    * launch `pageSize` asynchronous request in //
    * wait for the first available value and returns it (yield)
    * wait for subsequent values in the submitted result and return (yield) them when requested
    * if all values of the pages have been retrieved, finish the page
    * if a returned value was the last (`islast()`) then finish the page and finish the iteration
2. if the iteraton is not finished, prepare a new page and continue on 1.

Yielded values are made of the actual result from the `asyncFunc`, possible error caught, page number and index in page. Errors can be silently processed (ie returned) or thrown depending on the options.

## Configuration options

The function creating the iterator `pIt(asyncFunc, pageSize, options)` accepts a 3rd parameter `options`  that defaults as follow

```typescript
const defaultOptions:PagingOptions = {
  isLast:(v)=>v==undefined,         // called after each call of the `asyncFunc` with the result to determine if the value should be considered as the last to retrieved
  isError:(v)=>v instanceof Error,  // called after each call of the `asyncFunc` with the result to determine if the value is to be considered as an error
  keepOrder: false,                 // tells the iterator to return the result in the order they were called. If false, the results in a page appear in the order they completed (faster reponses first). If true, the results appear in the order they were made.
  maxErrors: -1,                    // the max numbers of errors to accept before the iterator returns an error. -1 means no error counting. 
  throwOnMaxError: false            // indicates to throw if more than maxErrors have been detected or to quietly finish the iteration.
}
```

**Example using the errors configuration**
Using the maxErrors and throwOnMaxError is usefull when dealing with low quality servers or unexpectedly unavailable servers. It is often hard to make the difference between a connection problem and a server being down. So with this configuration you can keep testing the connection a few times before really failing.

This example has a function `randomFail()` that returns a value 90% of the time or an exception 

```js
const timer = require('timers/promises')
async function randomFail(page, index) {
  const random = Math.random()*1000;
  await timer.setTimeout(random)
  if (page>5) return undefined; // stop returning after 5 pages
  if (random < 100) throw new Error("Failed");
  return random;
}

const {pagingGenerator: pIt} = require('paging-async-generator');

try {
  const options = {
    maxErrors: 3,
    throwOnMaxError: true
  }
  for await (let res of pIt(randomFail, 10, options)) {
    if (res.error) console.error("error"); // error 1, 2 and 3 can captured here
    else console.log("Value", res.value);
  }
} catch(error) {
  console.error("Catch part", error.message); // too many errors raised just after the 3rd error
}

```
This will output something like this
```
0 9 Error
0 0 Value 182.48736758281137
0 1 Value 220.38580312813582
0 4 Value 308.9175972240954
0 3 Value 400.9297899326623
0 5 Value 488.29201828411703
0 2 Value 535.7719212554144
0 8 Value 568.9978143365527
0 7 Value 951.4650640197817
0 6 Value 985.1677185623045
1 0 Error
1 7 Value 409.609336297486
1 2 Value 482.0072511571525
1 1 Value 535.9657542279799
1 6 Value 573.3811808896756
1 8 Value 703.6885387235554
1 4 Value 722.9073244025273
1 9 Value 734.6408818444008
1 5 Value 866.4749323388459
1 3 Value 907.5992228641494
2 8 Error
Catch part max errors reached
```

## Passing an array of functions
In some case you may need to call different functions for each iteration while not necessarilly processing the response in the order they appear in the process.

Contrary to `Promise.all()` that calls all and only return when all are called, with the `paging-async-generator` you can start processing before all responses are available

In the below example, let's assume functions that are long to compute and are executed on cloud but some parts can be run in //

```js
function add(x, y) {
  return new Promise (r=>{
    setTimeout(()=>r(x+y), 100)
  })
}
function mul(x, y) {
  return new Promise (r=>{
    setTimeout(()=>r(x*y), 200) // multiplication takes longer
  })
}

const array = [
  add.bind(null, 1, 2), // 3
  add.bind(null, 5, 6), // 11
  mul.bind(null, 10, 10), // 100
  add.bind(null, 100, 10), // 110
];

for await (let v of pIt(array, array.length)) {
  console.log("computed:", v.value)
}
```
outputs: (note that the multiplication is displayed after the additions since it takes more time to compute and the results are not ordered)
```
computed: 3
computed: 11
computed: 110
computed: 100
```