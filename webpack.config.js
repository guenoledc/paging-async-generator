//webpack.config.js
const path = require("path");

module.exports = {
  mode: "production",
  //devtool: "inline-source-map",
  // target: ["web", "es5"],
  entry: {
    main: "./src/index.ts",
  },
  output: {
    path: path.resolve(__dirname, "./dist"),
    filename: "index.js", // <--- Will be compiled to this single file
    library: { name: "paging-async-generator", type: "umd" },
    globalObject: "this", // Hyper important field
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  externals: {
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
      },
    ],
  },
};
