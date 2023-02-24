import { createRouterSDK } from '@whatwg-node/router';
import type { router } from '.';

const sdk = createRouterSDK<typeof router>();

const someTodosToAdd = ['Drink coffee', 'Write some code', 'Drink more coffee', 'Write more code'];

(async () => {
  // Adding some todos
  for (const todo of someTodosToAdd) {
    const addTodoRes = await sdk['/todo'].put({
      JSONBody: {
        content: todo,
      },
    });

    const addTodoJson = await addTodoRes.json();
    console.log(addTodoJson.id);
  }

  // Getting all todos
  const getTodosRes = await sdk['/todos'].get();
  const getTodosJson = await getTodosRes.json();
  console.table(getTodosJson);

  // Deleting the first todo
  const deleteTodoRes = await sdk['/todo/:id'].delete({
    PathParams: {
      id: getTodosJson[0].id,
    },
  });
  console.log(deleteTodoRes.status);
})();
