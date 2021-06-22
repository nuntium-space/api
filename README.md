# nuntium API

nuntium's API

## Article lifecycle

### Creation

1. Draft is created
2. Article is created (`is_published = false`)
3. Draft is modified
4. Draft is submitted for verification
    1. Draft is rejected (go to step 2.)
    2. Draft is accepted
        1. Article is published
        2. Draft is deleted

### Update

1. Draft is created
2. Draft is modified
3. Draft is submitted for verification
    1. Draft is rejected (go to step 2.)
    2. Draft is accepted
        1. Update is published
        2. Draft is deleted

## Response

These should be the default response codes for successful requests.\
Currently the API does not follow these rules but in the coming months a complete transition will happen.

- `GET`: `200 OK` -> { *obj* }
- `POST`: `201 Created` -> { id: *resource_id* }
- `PATCH`: `200 OK` -> { *obj* }
- `PUT`: `204 No Content` -> *void*
- `DELETE`: `204 No Content` -> *void*

### Errors

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
