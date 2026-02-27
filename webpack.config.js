const path = require('path');

module.exports = {
  entry: {
    app: './src/app.js',
  },
  devServer: {
    static: {
      directory: path.join(__dirname, './'),
    },
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: [/node_modules/],
        options: {
          presets: ['@babel/preset-env'],
        },
      },
    ],
  },
  output: {
    filename: 'bundle.js',
    path: path.join(__dirname, './'),
  },
  plugins: [],
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development', // eslint-disable-line
};
