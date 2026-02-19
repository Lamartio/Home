/* eslint-disable @typescript-eslint/naming-convention */
const path = require('path');

/** @type {import('webpack').Configuration} */
module.exports = {
  target: 'webworker',
  entry: './src/web/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist', 'web'),
    filename: 'extension.js',
    libraryTarget: 'commonjs'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [{ loader: 'ts-loader' }]
      }
    ]
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  performance: {
    hints: false
  },
  devtool: 'source-map'
};
