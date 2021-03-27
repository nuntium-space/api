# nuntium API

nuntium's API

## Errors

How to throw an error:

*Note: here we are using `badRequest` and `badImplementation` but this applies to all other methods*

```typescript

throw Boom.badRequest(undefined, [
    {
        field: "field",
        error: "error message",
    },
]);

// or, for a generic error

throw Boom.badImplementation();

```
Params:

- The first param is `undefined` so that `Hapi` uses its default value (for example: `Bad Request`) for the generic error message

- The second param is additional error data passed to the client
  - `field`: The field that caused the error, if this is a request with no fields from the client, such as `DELETE` requests, the field is the name of the resource (for example: `user`)
  - `error`: The error message that will be displayed on the client
