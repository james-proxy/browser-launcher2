var spawn = require( 'child_process' ).spawn,
	winDetect = require( 'win-detect-browsers' ),
	darwin = require( './darwin' ),
	assign = require('lodash/assign'),
	omit = require('lodash/omit'),
	flatten = require('lodash/flatten'),
	isEqual = require('lodash/isEqual'),
	uniqWith = require('lodash/uniqWith');
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

function getVariants(type) {
	var browser = browsers[type],
		variants = [];

	function addVariant(name, type, command) {
		variants.push(assign({
			name: name,
			type: type,
			command: command
		}, omit(browser, 'variants')));
	}

	if (typeof browser.variants === 'string') {

		// For browsers like "phantomjs", where its only variant is the command `phantomjs`
		addVariant(type, type, browser.variants);
	} else {
		Object.keys(browser.variants).forEach(function(name) {

			// For things like "chrome", where there's "chrome", "chrome-beta", and "chrome-canary", which are all "Chromes"
			if (typeof browser.variants[name] === 'string') {
				addVariant(name, type, browser.variants[name]);
				return;
			}

			// For when a variant can be launched with different commands, like `chromium` or `chromium-browser`
			browser.variants[name].forEach(addVariant.bind(undefined, name, type));
		});
	}

	return variants;
}

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
 * @param {Object}   variant  browser variant
 * @param {Function} callback Callback function
 */
function checkDarwin( variant, callback ) {
	var name = variant.name;

	if ( darwin[ name ] ) {
		if ( darwin[ name ].all ) {
			darwin[ name ].all( function( err, available ) {
				if ( err ) {
					callback( 'failed to get version for ' + name );
				} else {
					callback( err, available );
				}
			} );
		} else {
			darwin[ name ].version( function( err, version ) {
				if ( version ) {
					darwin[ name ].path( function( err, p ) {
						if ( err ) {
							return callback( 'failed to get path for ' + name );
						}

						callback( null, version, p );
					} );
				} else {
					callback( 'failed to get version for ' + name );
				}
			} );
		}
	} else {
		checkOthers( variant, callback );
	}
}

/**
 * Check if the given browser is available (on Unix systems).
 * Pass its version to the callback function if found.
 * @param {Object}   variant  browser variant
 * @param {Function} callback callback function
 */
function checkOthers( variant, callback ) {
	var process = spawn( variant.command, [ '--version' ] ),
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

		var match = variant.regex.exec( data );

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
	var available = [],
		browserVariants,
		check;

	if ( process.platform === 'win32' ) {
		return detectWindows( callback );
	} else if ( process.platform === 'darwin' ) {
		check = checkDarwin;
	} else {
		check = checkOthers;
	}


	browserVariants = flatten(Object.keys( browsers ).map( getVariants ));

	function next() {
		var variant = browserVariants.shift();

		if ( !variant ) {
			return callback(uniqWith(available, isEqual));
		}

		check(variant, function( err, version, path ) {
			if ( err === null ) {
				if ( Array.isArray( version ) ) {
					version.forEach( function( item ) {
						available.push( assign({
							command: item.path,
							version: item.version
						}, variant ));
					} );
				} else {
					available.push(assign({
						version: version,
						command: path || variant.command
					}, variant));
				}
			}

			next();
		});
	}

	next();
};

module.exports.variants = getVariants;