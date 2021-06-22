# nuntium API

nuntium's API

## Article lifecycle

### Article created

1. Draft is created
2. Article is created (`is_published = false`)
3. Draft is modified
4. Draft is submitted for verification
    1. Draft is rejected (go to step 2.)
    2. Draft is accepted
        1. Article is published
        2. Draft is deleted

### Article updated

1. Draft is created
2. Draft is modified
3. Draft is submitted for verification
    1. Draft is rejected (go to step 2.)
    2. Draft is accepted
        1. Update is published
        2. Draft is deleted

## Errors

How to throw an error:

*Note: here we are using `badRequest` and `badImplementation` but this applies to all other methods*

```typescript

/**
 * SPECIFIC ERROR
 * 
 * "undefined" so that Hapi uses its default
 * error message (for example: "Bad Request")
 */
throw Boom.badRequest(undefined, [
    {
        /**
         * The field that caused the error, if this is a request with
         * no fields from the client, such as "DELETE" requests, the
         * field is the name of the resource (for example: "user")
         */
        field: "field",
        /**
         * The error message that will be displayed on the client
         */
        error: "error message",
    },
]);

/**
 * GENERIC ERROR
 */
throw Boom.badImplementation();

```
