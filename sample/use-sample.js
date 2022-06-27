
const timer = require('timers/promises')
const fetch = require('node-fetch')
const axios = require('axios')
const {pagingGenerator: pIt} = require('..')

let maxItems;
async function fetchDataParam(delayFactor, page, index) {
  if (maxItems==0) return undefined;
  maxItems--;
  const delay = Math.random()*delayFactor;
  if (maxItems%6 == 0) throw new Error("I failed "+delay)
  await timer.setTimeout(delay)
  return delay
}

async function todo(page, index) {
  maxItems--;
  if (maxItems<=0) return {};
  const res = await fetch(`https://jsonplaceholder.typicode.com/todos/${page*10+index+1}`)
  return await res.json();
}
async function todo2() {
  maxItems--;
  const res = await fetch(`https://jsonplaceholder.typicode.com/todos/${maxItems}`)
  return await res.json();
}
const http = axios.default.create({validateStatus: s=>s>=200 && s<300});
async function todo3() {
  maxItems--;
  const res = await http.get(`https://jsonplaceholder.typicode.com/todos/${maxItems}`)
  return res.data;
}

(async ()=>{
  const options = {
    isLast: (v)=>v.id==undefined,
    isError: (v)=>v.id==12 || v.id==15,
    keepOrder:false,
    maxErrors: 20
  }
  // maxItems = 21
  // for await (const {value, error, page, index} of pIt(async (page, index)=>todo(page, index), 10, options)) {
  //   if (error) console.error(page, index, "Failure:", error.message||error.id)
  //   else console.log(page, index , value.userId, value.id, value.title );
  // }
  // console.log("===========");
  // maxItems = 3
  // for await (let r of pIt(todo2, 5, options)) {
  //   if (r.error) console.error(r.page, r.index, "Failure:", r.error.message||r.error.id)
  //   else console.log(r.page, r.index , r.value.userId, r.value.id, r.value.title );
  // }
  
  // console.log("===========");
  // // console.log(await todo3());
  // maxItems = 22
  // try {
    
  //   const cursor = pIt(todo3, 10, {...options, throwOnMaxError: true}); 
  //   let n = await cursor.next();
  //   while( !n.done ) {
  //     if (n.value.error) console.log("XX>", n.value.error.message)
  //     else console.log("==>", JSON.stringify(n.value.value));
  //     n = await cursor.next();
  //   }
  //   console.log("##>", n.value)
  // } catch (error) {
  //   console.log("Caught>", error.message, error.page, error.index)
    
  // }
  
  // console.log("===========");
  // maxItems = 40;
  // for await (let r of pIt(()=>fetchDataParam(1000), 5, {keepOrder: true, maxErrors:6}) ) {
  //   if (r.error) console.error(r.page, r.index, r.error.message);
  //   else console.log(r.page, r.index, r.value);
  // }
  
  console.log("===========");
  const array = [
    // todo.bind(undefined, 1, 1),
    // todo.bind(undefined, 1, 2),
    // todo.bind(undefined, 1, 3),
    // todo.bind(undefined, 2, 1),
    // todo.bind(undefined, 2, 2),
    // todo.bind(undefined),
    ...new Array(100).fill(1).map((v,i)=>todo.bind(undefined, 0, i))
  ]
  for await (let r  of pIt(array, 8, {keepOrder:false})) {
    if (r.error) console.log("Fail", r.error.message)
    else console.log("Processed call", r.page, r.index, r.value.id, r.value.title);
  }

})()