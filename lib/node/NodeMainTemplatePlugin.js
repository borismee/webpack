/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var Template = require("../Template");

function NodeMainTemplatePlugin(asyncChunkLoading) {
	this.asyncChunkLoading = asyncChunkLoading;
}
module.exports = NodeMainTemplatePlugin;
NodeMainTemplatePlugin.prototype.apply = function(mainTemplate) {
	var self = this;
	mainTemplate.plugin("local-vars", function(source, chunk) {
		if(chunk.chunks.length > 0) {
			return this.asString([
				source,
				"",
				"// object to store loaded chunks",
				"// \"1\" means \"already loaded\"",
				"var installedChunks = {",
				this.indent(
					chunk.ids.map(function(id) {
						return id + ":1";
					}).join(",\n")
				),
				"};"
			]);
		}
		return source;
	});
	mainTemplate.plugin("require-ensure", function(_, chunk, hash) {
		var filename = this.outputOptions.filename || "bundle.js";
		var chunkFilename = this.outputOptions.chunkFilename || "[id]." + filename;
		var chunkMaps = chunk.getChunkMaps();
		var insertMoreModules = [
			"var moreModules = chunk.modules, chunkIds = chunk.ids;",
			"for(var moduleId in moreModules) {",
			this.indent(this.renderAddModule(hash, chunk, "moduleId", "moreModules[moduleId]")),
			"}"
		];
		if(self.asyncChunkLoading) {
			return this.asString([
				"if(installedChunks[chunkId] === 1) callback.call(null, " + this.requireFn + ");",
				"else if(!installedChunks[chunkId]) {",
				this.indent([
					"installedChunks[chunkId] = [callback];",
					"var filename = __dirname + " + this.applyPluginsWaterfall("asset-path", JSON.stringify("/" + chunkFilename), {
						hash: "\" + " + this.renderCurrentHashCode(hash) + " + \"",
						hashWithLength: function(length) {
							return "\" + " + this.renderCurrentHashCode(hash, length) + " + \"";
						}.bind(this),
						chunk: {
							id: "\" + chunkId + \"",
							hash: "\" + " + JSON.stringify(chunkMaps.hash) + "[chunkId] + \"",
							hashWithLength: function(length) {
								var shortChunkHashMap = {};
								Object.keys(chunkMaps.hash).forEach(function(chunkId) {
									if(typeof chunkMaps.hash[chunkId] === "string")
										shortChunkHashMap[chunkId] = chunkMaps.hash[chunkId].substr(0, length);
								});
								return "\" + " + JSON.stringify(shortChunkHashMap) + "[chunkId] + \"";
							},
							name: "\" + (" + JSON.stringify(chunkMaps.name) + "[chunkId]||chunkId) + \""
						}
					}) + ";",
					"require('fs').readFile(filename, 'utf-8',  function(err, content) {",
					this.indent([
						"if(err) { if(" + this.requireFn + ".onError) return " + this.requireFn + ".onError(err); else throw err; }",
						"var chunk = {};",
						"require('vm').runInThisContext('(function(exports, require, __dirname, __filename) {' + content + '\\n})', filename)" +
						"(chunk, require, require('path').dirname(filename), filename);"
					].concat(insertMoreModules).concat([
						"var callbacks = [];",
						"for(var i = 0; i < chunkIds.length; i++) {",
						this.indent([
							"if(Array.isArray(installedChunks[chunkIds[i]]))",
							this.indent([
								"callbacks = callbacks.concat(installedChunks[chunkIds[i]]);"
							]),
							"installedChunks[chunkIds[i]] = 1;"
						]),
						"}",
						"for(i = 0; i < callbacks.length; i++)",
						this.indent("callbacks[i].call(null, " + this.requireFn + ");")
					])),
					"});"
				]),
				"} else installedChunks[chunkId].push(callback);"
			]);
		} else {
			var request = this.applyPluginsWaterfall("asset-path", JSON.stringify("./" + chunkFilename), {
				hash: "\" + " + this.renderCurrentHashCode(hash) + " + \"",
				hashWithLength: function(length) {
					return "\" + " + this.renderCurrentHashCode(hash, length) + " + \"";
				}.bind(this),
				chunk: {
					id: "\" + chunkId + \"",
					hash: "\" + " + JSON.stringify(chunkMaps.hash) + "[chunkId] + \"",
					hashWithLength: function(length) {
						var shortChunkHashMap = {};
						Object.keys(chunkMaps.hash).forEach(function(chunkId) {
							if(typeof chunkMaps.hash[chunkId] === "string")
								shortChunkHashMap[chunkId] = chunkMaps.hash[chunkId].substr(0, length);
						});
						return "\" + " + JSON.stringify(shortChunkHashMap) + "[chunkId] + \"";
					},
					name: "\" + (" + JSON.stringify(chunkMaps.name) + "[chunkId]||chunkId) + \""
				}
			});
			return this.asString([
				"// \"1\" is the signal for \"already loaded\"",
				"if(!installedChunks[chunkId]) {",
				this.indent([
					"var chunk = require(" + request + ");"
				].concat(insertMoreModules).concat([
					"for(var i = 0; i < chunkIds.length; i++)",
					this.indent("installedChunks[chunkIds[i]] = 1;")
				])),
				"}",
				"callback.call(null, " + this.requireFn + ");"
			]);
		}
	});
	mainTemplate.plugin("hot-bootstrap", function(source, chunk, hash) {
		var hotUpdateChunkFilename = this.outputOptions.hotUpdateChunkFilename;
		var hotUpdateMainFilename = this.outputOptions.hotUpdateMainFilename;
		var chunkMaps = chunk.getChunkMaps();
		var currentHotUpdateChunkFilename = this.applyPluginsWaterfall("asset-path", JSON.stringify(hotUpdateChunkFilename), {
			hash: "\" + " + this.renderCurrentHashCode(hash) + " + \"",
			hashWithLength: function(length) {
				return "\" + " + this.renderCurrentHashCode(hash, length) + " + \"";
			}.bind(this),
			chunk: {
				id: "\" + chunkId + \"",
				hash: "\" + " + JSON.stringify(chunkMaps.hash) + "[chunkId] + \"",
				hashWithLength: function(length) {
					var shortChunkHashMap = {};
					Object.keys(chunkMaps.hash).forEach(function(chunkId) {
						if(typeof chunkMaps.hash[chunkId] === "string")
							shortChunkHashMap[chunkId] = chunkMaps.hash[chunkId].substr(0, length);
					});
					return "\" + " + JSON.stringify(shortChunkHashMap) + "[chunkId] + \"";
				},
				name: "\" + (" + JSON.stringify(chunkMaps.name) + "[chunkId]||chunkId) + \""
			}
		});
		var currentHotUpdateMainFilename = this.applyPluginsWaterfall("asset-path", JSON.stringify(hotUpdateMainFilename), {
			hash: "\" + " + this.renderCurrentHashCode(hash) + " + \"",
			hashWithLength: function(length) {
				return "\" + " + this.renderCurrentHashCode(hash, length) + " + \"";
			}.bind(this)
		});
		return Template.getFunctionContent(self.asyncChunkLoading ? function() {
			/*global $hotChunkFilename$ $require$ hotAddUpdateChunk $hotMainFilename$ */
			function hotDownloadUpdateChunk(chunkId) { // eslint-disable-line no-unused-vars
				var filename = require("path").join(__dirname, $hotChunkFilename$);
				require("fs").readFile(filename, "utf-8", function(err, content) {
					if(err) {
						if($require$.onError)
							return $require$.onError(err);
						else
							throw err;
					}
					var chunk = {};
					require("vm").runInThisContext("(function(exports) {" + content + "\n})", filename)(chunk);
					hotAddUpdateChunk(chunk.id, chunk.modules);
				});
			}

			function hotDownloadManifest(callback) { // eslint-disable-line no-unused-vars
				var filename = require("path").join(__dirname, $hotMainFilename$);
				require("fs").readFile(filename, "utf-8", function(err, content) {
					if(err) return callback();
					try {
						var update = JSON.parse(content);
					} catch(e) {
						return callback(e);
					}
					callback(null, update);
				});
			}
		} : function() {
			/*global $hotChunkFilename$ $require$ hotAddUpdateChunk $hotMainFilename$ */
			function hotDownloadUpdateChunk(chunkId) { // eslint-disable-line no-unused-vars
				var chunk = require("./" + $hotChunkFilename$);
				hotAddUpdateChunk(chunk.id, chunk.modules);
			}

			function hotDownloadManifest(callback) { // eslint-disable-line no-unused-vars
				try {
					var update = require("./" + $hotMainFilename$);
				} catch(e) {
					return callback();
				}
				callback(null, update);
			}
		})
			.replace(/\$require\$/g, this.requireFn)
			.replace(/\$hotMainFilename\$/g, currentHotUpdateMainFilename)
			.replace(/\$hotChunkFilename\$/g, currentHotUpdateChunkFilename);
	});
	mainTemplate.plugin("hash", function(hash) {
		hash.update("node");
		hash.update("3");
		hash.update(this.outputOptions.filename + "");
		hash.update(this.outputOptions.chunkFilename + "");
	});
};
