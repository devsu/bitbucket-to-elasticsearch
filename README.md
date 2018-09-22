# Bitbucket to Elastic Search

A utility to import the information from Bitbucket cloud to Elastic Search for analytics.

## Status

Under development, not working yet

## Installation and Usage

```
yarn global add bitbucket-to-elasticsearch
```

To index

```
bitbucket-to-elasticsearch index | bunyan
```

To update the index:

```
bitbucket-to-elasticsearch update | bunyan
```

The `| bunyan` part is optional. It's to get nicer console logging (instead of the default json logger). To use bunyan install it first using `yarn global add bunyan`.

## License
MIT

## Copyright and Credits
2018 Devsu LLC. [An agile software development shop](https://devsu.com).