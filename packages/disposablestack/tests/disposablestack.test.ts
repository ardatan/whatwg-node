import { AsyncDisposableStack, DisposableStack, DisposableSymbols, patchSymbols } from '../src';

function createTestCases<
  TStack extends DisposableStack | AsyncDisposableStack,
  TSymbol extends TStack extends DisposableStack
    ? (typeof DisposableSymbols)['dispose']
    : (typeof DisposableSymbols)['asyncDispose'],
>(
  disposeFnSymbol: TSymbol,
): Record<
  string,
  {
    run(stack: TStack, disposeFn: jest.Mock): void | Promise<void>;
    check(disposeFn: jest.Mock): void;
  }
> {
  return {
    use: {
      run(stack: TStack, disposeFn: jest.Mock) {
        // @ts-expect-error - TODO: fix this
        stack.use({
          [disposeFnSymbol as TSymbol]: disposeFn,
        });
      },
      check(disposeFn: jest.Mock) {
        expect(disposeFn).toBeCalled();
      },
    },
    adopt: {
      run(stack: TStack, disposeFn: jest.Mock) {
        const value = 'TEST';
        expect(stack.adopt(value, disposeFn)).toBe(value);
      },
      check(disposeFn: jest.Mock) {
        expect(disposeFn).toBeCalledWith('TEST');
      },
    },
    defer: {
      run(stack: TStack, disposeFn: jest.Mock) {
        stack.defer(disposeFn);
      },
      check(disposeFn: jest.Mock) {
        expect(disposeFn).toBeCalled();
      },
    },
    move: {
      async run(stack: TStack, disposeFn: jest.Mock) {
        stack.defer(disposeFn);
        const stack2 = stack.move();
        if ('dispose' in stack2) {
          stack2.dispose();
        } else {
          await stack2.disposeAsync();
        }
      },
      check(disposeFn: jest.Mock) {
        expect(disposeFn).toHaveBeenCalledTimes(1);
      },
    },
  };
}

const stacks: Record<
  string,
  {
    ctor: new () => DisposableStack | AsyncDisposableStack;
    symbol: (typeof DisposableSymbols)['dispose'] | (typeof DisposableSymbols)['asyncDispose'];
    disposeMethod: 'dispose' | 'disposeAsync';
  }
> = {
  AsyncDisposableStack: {
    ctor: AsyncDisposableStack,
    symbol: DisposableSymbols.asyncDispose,
    disposeMethod: 'disposeAsync',
  },
  DisposableStack: {
    ctor: DisposableStack,
    symbol: DisposableSymbols.dispose,
    disposeMethod: 'dispose',
  },
};

patchSymbols();

for (const stackName in stacks) {
  describe(stackName, () => {
    const StackCtor = stacks[stackName].ctor;
    const disposeFnSymbol = stacks[stackName].symbol;
    const disposeMethod = stacks[stackName].disposeMethod;
    const testCases = createTestCases(disposeFnSymbol);
    describe('using syntax', () => {
      for (const testCaseName in testCases) {
        const testCase = testCases[testCaseName];
        it(testCaseName, async () => {
          const disposeFn = jest.fn();
          {
            await using stack = new StackCtor();
            await testCase.run(stack, disposeFn);
          }
          testCase.check(disposeFn);
        });
      }
    });
    describe(`.${disposeMethod}()`, () => {
      for (const testCaseName in testCases) {
        const testCase = testCases[testCaseName];
        it(testCaseName, async () => {
          const disposeFn = jest.fn();
          const stack = new StackCtor();
          await testCase.run(stack, disposeFn);
          // @ts-expect-error - TODO: fix this
          await stack[disposeMethod]();
          testCase.check(disposeFn);
        });
      }
    });
  });
}
