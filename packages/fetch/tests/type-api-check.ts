import { Response } from '@whatwg-node/fetch';

let testObj = {
  a: 1,
};

let anotherObj = {
  b: 2,
};

const response = Response.json(anotherObj);

anotherObj = await response.json();

// @ts-expect-error - should not be assignable
testObj = await response.json();

console.log(testObj);
