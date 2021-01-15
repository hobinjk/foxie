const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './toxie.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'toxie.js',
  },
  plugins: [
    new CopyWebpackPlugin([{
      from: 'static',
      ignore: ['.*'], // ignore all hidden (git) files
    }]),
  ],
  mode: 'production',
};

