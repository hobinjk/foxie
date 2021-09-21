const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './foxie.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'foxie.js',
  },
  plugins: [
    new CopyWebpackPlugin([{
      from: 'static',
      ignore: ['.*'], // ignore all hidden (git) files
    }]),
  ],
  mode: 'production',
};

