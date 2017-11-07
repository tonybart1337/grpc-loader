const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: path.join(__dirname, 'entry.js'),
  externals: [nodeExternals()],
  target: 'node',
  output: {
    path: path.join(__dirname, 'out'),
    filename: 'index.js'
  },
  module: {
    rules: [{
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['env', {
                targets: {
                  node: 'current',
                },
              }],
            ],
          }
        }
      },
      {
        test: /\.proto$/,
        loader: path.join(__dirname, ".."),
        options: {
          // both methods are static internally
          // but result api differs
          // https://github.com/grpc/grpc/tree/master/examples/node
          static: false,

          // grpc props
          // https://github.com/grpc/grpc-node/blob/master/packages/grpc-protobufjs/index.js#L37-L42
          //  convertFieldsToCamelCase,
          //  binaryAsBase64,
          //  longsAsStrings,
          //  enumsAsStrings,
        },
      }
    ]
  }
};
