# Bitbucket to Elastic Search

A utility to import the information from Bitbucket cloud to Elastic Search for analytics. Inspired on [github-to-es](https://github.com/grafana/github-to-es).

## Requirements

Requires node 10 or superior, because it uses async iterators.

## Installation and Usage

```
yarn global add bitbucket-to-elasticsearch
```

Create a `config.json` file like:

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

Then just run:

```
bitbucket-to-elasticsearch | bunyan
```

The `| bunyan` part is optional. It's to get nicer console logging (instead of the default json logger). To use bunyan install it first using `yarn global add bunyan`.

## License
MIT

## Copyright and Credits
2018 Devsu LLC. [An agile software development shop](https://devsu.com).