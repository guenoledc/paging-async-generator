const timer = require('timers/promises')
async function randomFail(page, index) {
  const random = Math.random()*1000;
  await timer.setTimeout(random)
  if (page>5) return undefined; // stop returning after 5 pages
  if (random < 100) throw new Error("Failed");
  return random;
}

const {pagingGenerator: pIt} = require('..');

async function run () {
  try {
    const options = {
      maxErrors: 3,
      throwOnMaxError: true
    }
    for await (let res of pIt(randomFail, 10, options)) {
      if (res.error) console.error(res.page, res.index, "Error"); // error 1, 2 and 3 can captured here
      else console.log(res.page, res.index, "Value", res.value);
    }
  } catch(error) {
    console.error("Catch part", error.message); // too many errors raised just after the 3rd error
  }
}
run()
/* Execution example
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
*/