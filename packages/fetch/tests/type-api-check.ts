import { Response } from '@whatwg-node/fetch';

let testObj = {
    a: 1,
}

const anotherObj = {
    b: 2,
}

const response = Response.json(anotherObj);

// @ts-expect-error - should not be assignable
testObj = await response.json();
