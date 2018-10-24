# Bitbucket to Elastic Search

A utility to import the information from Bitbucket cloud to Elastic Search for analytics. Inspired on [github-to-es](https://github.com/grafana/github-to-es).

## Requirements

Requires node 10 or superior, because it uses async iterators.

## Installation and Usage

### Installation

```
yarn global add bitbucket-to-elasticsearch
```

or

```
npm i -g bitbucket-to-elasticsearch
```

To configure, you can create a `config.json` file or use environment variables.

### Configure using JSON file

```
{
  "bitbucket": {
    "username": "my-username",
    "clientId": "my-client-id",
    "clientSecret": "my-client-secret"
  },
  "elasticsearch": {
    "host": "127.0.0.1:9200"
  }
}
```

### Or Configure using environment variables

- `BB2ES_BITBUCKET_USERNAME`
- `BB2ES_BITBUCKET_CLIENT_ID`
- `BB2ES_BITBUCKET_CLIENT_SECRET`
- `BB2ES_BITBUCKET_CLIENT_SECRET`

To get the full list of environment variables that can be set check `src/config.js`.

### Run

Then just run:

```
bitbucket-to-elasticsearch | bunyan
```

The `| bunyan` part is optional. It's to get nicer console logging (instead of the default json logger). To use bunyan install it first using `yarn global add bunyan`.

## License
MIT

## Copyright and Credits
2018 Devsu LLC. [An agile software development shop](https://devsu.com).