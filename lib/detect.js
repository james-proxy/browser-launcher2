var spawn = require( 'child_process' ).spawn,
	winDetect = require( 'win-detect-browsers' ),
	darwin = require( './darwin' ),
	omit = require( 'lodash' ).omit,
	browsers = { // List of commands and version regex for Linux and Mac
		chrome: {
			regex: /Google Chrome (\S+)/,
			profile: true,
			variants: {
				'chrome': [ 'google-chrome', 'google-chrome-stable' ],
				'chrome-beta': 'google-chrome-beta',
				'chrome-canary': 'google-chrome-canary'
			}
		},
		chromium: {
			regex: /Chromium (\S+)/,
			profile: true,
			variants: {
				'chromium': [ 'chromium', 'chromium-browser' ]
			}
		},
		firefox: {
			regex: /Mozilla Firefox (\S+)/,
			profile: true,
			variants: {
				'firefox': 'firefox',
				'firefox-developer': 'firefox-developer'
			}
		},
		phantomjs: {
			regex: /(\S+)/,
			profile: false,
			headless: true,
			variants: 'phantomjs'
		},
		safari: {
			profile: false,
			variants: 'safari'
		},
		ie: {
			profile: false,
			variants: 'ie'
		},
		opera: {
			regex: /Opera (\S+)/,
			profile: true,
			variants: 'opera'
		}
	};

/**
 * Detect all available browsers on Windows systems.
 * Pass an array of detected browsers to the callback function when done.
 * @param {Function} callback Callback function
 */
function detectWindows( callback ) {
	winDetect( function( found ) {
		var available = found.map( function( browser ) {
			return {
				name: browser.name,
				type: browser.name,
				command: browser.path,
				version: browser.version
			};
		} );

		callback( available );
	} );
}

/**
 * Check if the given browser is available (on OSX systems).
 * Pass its version and path to the callback function if found.
 * @param {String}   name     Name of a browser
 * @param {Function} callback Callback function
 */
function checkDarwin(name, callback) {
	if (darwin[name].all) {
		darwin[name].all(function (err, available) {
			if (err) {
				callback('failed to get version for ' + name);
			} else {
				callback(err, available);
			}
		});
	} else {
		darwin[name].version(function (err, version) {
			if (version) {
				darwin[name].path(function (err, p) {
					if (err) {
						return callback('failed to get path for ' + name);
					}

					callback(null, version, p);
				});
			} else {
				callback('failed to get version for ' + name);
			}
		});
	}
}

/**
 * Check if the given browser is available (on Unix systems).
 * Pass its version to the callback function if found.
 * @param {String}   name     Name of a browser
 * @param {RegExp}	 regex    Version matching regex
 * @param {Function} callback Callback function
 */
function checkOthers( name, regex, callback ) {
	var process = spawn( name, [ '--version' ] ),
		data = '';

	process.stdout.on( 'data', function( buf ) {
		data += buf;
	} );

	process.on( 'error', function() {
		callback( 'not installed' );
		callback = null;
	} );

	process.on( 'close', function( code ) {
		if ( !callback ) {
			return;
		}

		if ( code !== 0 ) {
			return callback( 'not installed' );
		}

		var match = regex.exec( data );

		if ( match ) {
			callback( null, match[ 1 ] );
		} else {
			callback( null, data.trim() );
		}
	} );
}

/**
 * Detect all available web browsers.
 * Pass an array of available browsers to the callback function when done.
 * @param {Function} callback Callback function
 */
module.exports = function detect( callback ) {
	if (process.platform === 'win32' ) {
		return detectWindows( callback );
	}

	var isOsx = process.platform === 'darwin';
	var flatBrowsers = [];

	function useDarwinCheck(name) {
		return isOsx && darwin[ name ];
	}

	Object.keys(browsers).forEach(function(type) {
		var multiBrowser = browsers[type];
		var regex = multiBrowser.regex;

		function pushCheck(func, name, type, command) {
			var properties = omit(multiBrowser, 'variants');
			properties.name = name;
			properties.type = type;
			properties.command = command;
			flatBrowsers.push({func, properties});
		}

		if (typeof browsers[type].variants === 'string') {
			var check = useDarwinCheck(type) ?
				checkDarwin.bind(undefined, type) :
				checkOthers.bind(undefined, browsers[type].variants, regex);
			pushCheck(check, type, type, browsers[type].variants);
			return;
		}

		Object.keys(multiBrowser.variants).forEach(function(name) {
			var variant = multiBrowser.variants[name];

			if ( useDarwinCheck( name ) ) {
				pushCheck(checkDarwin.bind(undefined, name), type, name);
				return;
			}

			// if variant is a single command
			if (typeof variant === 'string') {
				pushCheck(checkOthers.bind(undefined, variant, regex), type, name, variant);
				return;
			}

			// variant must be a list of commands
			variant.forEach(function(command) {
				pushCheck(checkOthers.bind(undefined, command, regex), type, name, command);
			});
		});
	});

	var checksComplete = 0;
	var available = [];

	flatBrowsers.forEach(function(flatBrowser) {
		var properties = flatBrowser.properties;
		function cb( err, version, path ) {
			if ( !err ) {
				if ( Array.isArray( version ) ) {
					// If `version` is an array, then it's actually a "darwin check" returning multiple browswers.
					// See `darwin/firefox.js`
					version.forEach( function( item ) {
						available.push({
							name: properties.name,
							type: properties.type,
							version: item.version,
							command: item.path || properties.command
						});
					} );
				} else {
					available.push({
						name: properties.name,
						type: properties.type,
						version: version,
						command: path || properties.command
					});
				}
			}

			checksComplete++;
			if (checksComplete === flatBrowsers.length) {
				callback(available);
			}
		}

		flatBrowser.func(cb);
	});
};
