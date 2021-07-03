# api

## Article lifecycle

### Creation

1. Draft is created
3. Draft is modified
4. Draft is submitted for verification
    1. Draft is rejected (go to step 2.)
    2. Draft is accepted
        1. Article is created
        2. Draft is deleted

### Update

1. Draft is created
2. Draft is modified
3. Draft is submitted for verification
    1. Draft is rejected (go to step 2.)
    2. Draft is accepted
        1. Update is published
        2. Draft is deleted

## Test

### Set environment variables

```
NODE_ENV=development
PORT=4000


API_URL=http://localhost:4000
CLIENT_URL=http://localhost:4200
ELASTICSEARCH_URL=http://localhost:4571


DATABASE_URL=postgresql://{{ USER }}:{{ PASSWORD }}@{{ HOST }}:{{ PORT }}/{{ NAME }}?schema={{ SCHEMA }}


AUTH_COOKIE_ENCRYPTION_PASSWORD=

FACEBOOK_OAUTH_CLIENT_ID=
FACEBOOK_OAUTH_CLIENT_SECRET=

GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

TWITTER_OAUTH_CLIENT_ID=
TWITTER_OAUTH_CLIENT_SECRET=


STRIPE_SECRET_API_KEY=
STRIPE_WEBHOOK_SECRET=


AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

AWS_PUBLISHER_ICONS_BUCKET_NAME=publisher-icons


SENDGRID_API_KEY=
```

***Note:** `HOST` must be an IP address, and `not localhost`, because when running on the local lambda emulator the function will be in a Docker container, and so it won't have access to the host's network.*

### Serve locally

This will start a local server on `http://localhost:4000`.

```
npm start
```

### Deploy to localstack

Run

```
sls deploy
```

***Note:** if the deployment fails try to delete the `.build` folder.*

[nuntium]: https://github.com/nuntium-space/nuntium

