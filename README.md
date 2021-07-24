# api

[![Deployment](https://github.com/nuntium-space/api/actions/workflows/cd.yml/badge.svg)](https://github.com/nuntium-space/api/actions/workflows/cd.yml)
[![Format](https://github.com/nuntium-space/api/actions/workflows/format.yml/badge.svg)](https://github.com/nuntium-space/api/actions/workflows/format.yml)
[![Lint](https://github.com/nuntium-space/api/actions/workflows/lint.yml/badge.svg)](https://github.com/nuntium-space/api/actions/workflows/lint.yml)

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

## Article lifecycle

### Creation

1. Draft is created
2. Draft is modified
3. Draft is submitted for verification
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

AWS_PROFILE_IMAGES_BUCKET_NAME=profile-images


SENDGRID_API_KEY=
```

*__Note:__ `HOST` must be an IP address, and `not localhost`, because when running on the local lambda emulator the function will be in a Docker container, and so it won't have access to the host's network.*

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

*__Note:__ if the deployment fails try to delete the `.build` folder.*
