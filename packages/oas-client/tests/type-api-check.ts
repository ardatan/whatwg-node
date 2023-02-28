import { createOASClient, Mutable } from '../src';
import { petstoreOas } from './fixtures/petstore';

async function main() {
  const a = createOASClient<Mutable<typeof petstoreOas>>({
    endpoint: 'http://localhost:3000',
  });

  const addTodoRes = await a['/todo'].put({
    json: {
      content: 'test',
      // @ts-expect-error - test is not a valid property
      test: 1,
    },
  });

  const addTodoJson = await addTodoRes.json();
  console.log(addTodoJson.id);
  // @ts-expect-error - foo is not a valid property
  console.log(addTodoJson.foo);

  const getTodosRes = await a['/todos'].get();
  const getTodosJson = await getTodosRes.json();
  console.log(getTodosJson[0].id);
  // @ts-expect-error - bar is not a valid property
  console.log(getTodosJson[0].bar);

  const getTodoRes = await a['/todo/{id}'].get({
    params: {
      id: '123',
      // @ts-expect-error - test is not a valid property
      name: 'test',
    },
    headers: {
      // @ts-expect-error - Authorization should be a string
      Authorization: 121312321,
    },
  });
  if (getTodoRes.status === 200) {
    const successfulBody = await getTodoRes.json();
    console.log(successfulBody.id);
  }
  if (getTodoRes.status === 404) {
    const errorBody = await getTodoRes.json();
    // @ts-expect-error - id is not a valid property for an error response
    console.log(errorBody.id);
    console.log(errorBody.message);
  }
}

main();
