module.exports = function (api) {
	api.cache(true);

	const presets = [
		[
			"@babel/preset-env",
			{
				targets: {
					node: "current"
				}
			}
		]
	];
	const plugins = [
		//["transform-async-to-module-method", {
		//"module": "bluebird",
		//"method": "coroutine"
		//}]
	];

	return {
		presets,
		plugins
	};
};
