import { createOASClient, Mutable } from '@whatwg-node/oas-client';
import type oas from './saved_openapi';

const client = createOASClient<Mutable<typeof oas>>({
  endpoint: 'http://localhost:3000',
});

const someTodosToAdd = ['Drink coffee', 'Write some code', 'Drink more coffee', 'Write more code'];

(async () => {
  // Adding some todos
  for (const todo of someTodosToAdd) {
    const addTodoRes = await client['/todo'].put({
      JSONBody: {
        content: todo,
      },
    });

    const addTodoJson = await addTodoRes.json();
    console.log(addTodoJson.id);
  }

  // Getting all todos
  const getTodosRes = await client['/todos'].get();
  const getTodosJson = await getTodosRes.json();
  console.table(getTodosJson);

  // Deleting the first todo
  const deleteTodoRes = await client['/todo/{id}'].delete({
    PathParams: {
      id: getTodosJson[0].id,
    },
  });
  console.log(deleteTodoRes.status);
})();
