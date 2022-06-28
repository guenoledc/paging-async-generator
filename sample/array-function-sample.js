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
  add.bind(null, 1, 2), // 1+2
  add.bind(null, 5, 6), // 5+6
  mul.bind(null, 10, 10), // 10*10
  add.bind(null, 100, 10), // 110
];


const {pagingGenerator: pIt} = require('..');

async function run () {
  for await (let v of pIt(array, array.length)) {
    console.log("computed:", v.value)
  }
}
run()