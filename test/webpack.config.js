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
		loaders: [
			{
				test: /\.proto$/,
				loader: path.join(__dirname, "..")
			}
		]
	}
};
